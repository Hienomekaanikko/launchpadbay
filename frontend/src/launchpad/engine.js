import {
  initAudio,
  initChannelProcessors,
  loadPadVoice,
  replaceLoopSource,
  stopSource,
  resetAudio,
  padVoices,
  audioCtx,
  channelGains,
  channelFilters,
} from './audio.js'
import {
  CHANNEL_COUNT,
  channelOfPad,
  slotOfPad,
  padDomId,
} from './pads.js'
import {
  updateStutterBtn,
  applyThemeColors,
  startProgressLoop,
  renderPad,
  renderChannel,
} from './ui.js'
import { createClock } from './clock.js'
import { createSplitControl } from './split.js'
import { createStutterControl } from './stutter.js'
import {
  createChannels,
  applyChannelEvent,
  anyChannelActive,
  setPadFlags,
  getPadVisual,
  setAllPadsLoading,
} from './channel.js'
import { createUiTimers } from './uiTimers.js'
import { bindLaunchpadControls } from './bindings.js'

export function mountLaunchpad(container, themes) {
  let isUnmounted = false
  const uiTimers = createUiTimers()

  const clock = createClock()
  const channels = createChannels(CHANNEL_COUNT)

  const channelLevels = {}
  for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++)
    channelLevels[channelId] = 1

  initAudio()
  initChannelProcessors()

  const byId = (domId) => container.querySelector(`#${domId}`)
  const padEl = (pad) => byId(padDomId(pad))

  // --- channel lights ---

  function lightChannel(channelId, event) {
    channels[channelId] = applyChannelEvent(channels[channelId], event)
    renderChannel(padEl, channels[channelId])
    return channels[channelId]
  }

  function setPadLoading(channelId, pad, loading) {
    setPadFlags(channels[channelId], pad, { loading })
    renderPad(padEl, getPadVisual(channels[channelId], slotOfPad(pad)))
  }

  // --- clip playback ---

  function clearPadVoice(pad, options) {
    if (!options)
      options = {}
    const stop = options.stop !== false

    const voice = padVoices[pad]
    if (!voice)
      return null
    if (voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }
    if (stop && voice.source) {
      stopSource(voice.source)
      voice.source = null
    }
    return voice
  }

  function cancelHandoff(channelId) {
    const channel = channels[channelId]
    if (channel.state !== 'queued' || channel.queuedPad == null)
      return

    clearPadVoice(channel.queuedPad)
    lightChannel(channelId, { type: 'CANCEL_HANDOFF' })
  }

  function scheduleClipAt(pad, when, options) {
    if (!options)
      options = {}

    const voice = padVoices[pad]
    if (!voice)
      return

    const channelId = channelOfPad(pad)

    voice.source = replaceLoopSource(
      channelId,
      voice.buffer,
      clock.getLoopLength(),
      when,
      voice.source,
    )

    if (options.onSchedule)
      options.onSchedule(channelId)

    const delayMs = ((when - audioCtx.currentTime) * 1000) | 0
    voice.uiStartTimerId = uiTimers.track(() => {
      voice.uiStartTimerId = null
      if (isUnmounted)
        return
      if (options.requireSource && !voice.source)
        return

      if (options.onFire)
        options.onFire(channelId)
      if (options.onStarted)
        options.onStarted(channelId)
    }, delayMs)
  }

  function armThenStartOpts(pad) {
    return {
      requireSource: true,
      onSchedule: (channelId) =>
        lightChannel(channelId, { type: 'ARM', pad }),
      onStarted: (channelId) =>
        launchCue({ type: 'CLIP_STARTED', channelId, pad }),
    }
  }

  function launchClip(pad) {
    const voice = padVoices[pad]
    if (!voice)
      return

    const now = audioCtx.currentTime
    let startTime
    if (!clock.isRunning()) {
      startTime = clock.start(now, voice.buffer.duration)
    } else {
      startTime = clock.getNextGrid(now)
    }

    scheduleClipAt(pad, startTime, armThenStartOpts(pad))
  }

  // Fade later: ramp channelGain → 0 over N ms, stop after, restore to
  // channelLevels; on next launch reset gain to channelLevels at `when`.
  function stopClip(pad) {
    const voice = clearPadVoice(pad)
    if (!voice)
      return

    const channelId = channelOfPad(pad)
    lightChannel(channelId, { type: 'STOP' })

    if (!anyChannelActive(channels)) {
      split.cancelPendingSplit()
      clock.clear()
    }
  }

  function queueClip(channelId, pad, handoffTime) {
    cancelHandoff(channelId)

    scheduleClipAt(pad, handoffTime, {
      onSchedule: () =>
        lightChannel(channelId, { type: 'QUEUE_HANDOFF', pad, when: handoffTime }),
      onFire: () => {
        const outgoing = channels[channelId].activePad
        if (!outgoing || outgoing === pad)
          return
        const outVoice = padVoices[outgoing]
        if (outVoice && outVoice.source) {
          stopSource(outVoice.source)
          outVoice.source = null
        }
      },
      onStarted: () =>
        launchCue({ type: 'CLIP_STARTED', channelId, pad }),
    })
  }

  // --- split / stutter ---

  function ensureAudioRunning() {
    if (audioCtx.state === 'suspended')
      audioCtx.resume()
  }

  const split = createSplitControl({
    clock,
    channels,
    padVoices,
    uiTimers,
    getCurrentTime: () => audioCtx.currentTime,
    isUnmounted: () => isUnmounted,
  })

  const stutter = createStutterControl({
    clock,
    channels,
    padVoices,
    getCurrentTime: () => audioCtx.currentTime,
    lightChannel,
    updateBtn: (channelId, depth, activeDepth) =>
      updateStutterBtn(byId, channelId, depth, activeDepth),
    resumeClipAt: (pad, when) => {
      scheduleClipAt(pad, when, armThenStartOpts(pad))
    },
    ensureAudioRunning,
  })

  // --- cues / ui actions ---

  function resolvePadLaunch(pad) {
    const channelId = channelOfPad(pad)
    const channel = channels[channelId]

    if (channel.activePad === pad) {
      return [
        { type: 'CANCEL_HANDOFF', channelId },
        { type: 'STOP_CLIP', pad },
      ]
    }

    if (channel.state === 'queued' && channel.queuedPad === pad) {
      return [{ type: 'CANCEL_HANDOFF', channelId }]
    }

    if (channel.state === 'idle') {
      return [{ type: 'ARM_CLIP', pad }]
    }

    return [{
      type: 'QUEUE_HANDOFF',
      channelId,
      pad,
      when: channel.queuedAt ?? clock.getNextGrid(audioCtx.currentTime),
    }]
  }

  function launchCue(cue) {
    switch (cue.type) {
      case 'RELEASE_STUTTER':
        stutter.end(cue.channelId)
        break
      case 'CANCEL_HANDOFF':
        cancelHandoff(cue.channelId)
        break
      case 'ARM_CLIP':
        launchClip(cue.pad)
        break
      case 'STOP_CLIP':
        stopClip(cue.pad)
        break
      case 'QUEUE_HANDOFF':
        queueClip(cue.channelId, cue.pad, cue.when)
        break
      case 'CLIP_STARTED':
        lightChannel(cue.channelId, { type: 'STARTED', pad: cue.pad })
        break
      default:
        break
    }
  }

  function handleUiAction(action) {
    switch (action.type) {
      case 'PAD_HIT': {
        ensureAudioRunning()
        const channelId = channelOfPad(action.pad)
        if (channels[channelId].stutter.activeDepth !== 0) {
          launchCue({ type: 'RELEASE_STUTTER', channelId })
        }
        for (const cue of resolvePadLaunch(action.pad))
          launchCue(cue)
        break
      }
      case 'SPLIT_TOGGLE': {
        const active = split.toggleSplit()
        const splitBtn = byId('split-btn')
        if (splitBtn)
          splitBtn.classList.toggle('active', active)
        break
      }
      case 'STUTTER_TAP':
        stutter.tap(action.channelId)
        break
      case 'STUTTER_CYCLE':
        stutter.cycleDepth(action.channelId)
        break
      case 'SET_GAIN':
        channelLevels[action.channelId] = action.value / 100
        channelGains[action.channelId].gain.setValueAtTime(
          action.value / 100,
          audioCtx.currentTime,
        )
        break
      case 'SET_FILTER':
        channelFilters[action.channelId].frequency.setValueAtTime(
          200 * Math.pow(100, action.value / 100),
          audioCtx.currentTime,
        )
        break
      default:
        break
    }
  }

  // --- themes ---

  async function loadThemeSounds(theme) {
    stutter.stopAll()

    for (const key of Object.keys(padVoices)) {
      const pad = Number(key)
      const voice = padVoices[pad]
      if (voice && voice.source)
        stopClip(pad)
    }
    for (const key of Object.keys(padVoices))
      delete padVoices[key]

    for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
      const keptDepth = channels[channelId].stutter.depth
      lightChannel(channelId, { type: 'RESET' })
      channels[channelId].stutter.depth = keptDepth
      setAllPadsLoading(channels[channelId], true)
      renderChannel(padEl, channels[channelId])
      stutter.refreshBtn(channelId)
    }

    split.cancelPendingSplit()
    clock.clear()

    await Promise.all(
      Object.entries(theme.sampleUrls).map(([key, url]) => {
        const pad = Number(key)
        const channelId = channelOfPad(pad)
        return loadPadVoice(pad, url)
          .finally(() => {
            if (isUnmounted)
              return
            setPadLoading(channelId, pad, false)
          })
      })
    )

    if (isUnmounted)
      return

    if (Object.keys(theme.sampleUrls).length === 0) {
      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
        setAllPadsLoading(channels[channelId], false)
        renderChannel(padEl, channels[channelId])
      }
    }
  }

  // --- mount / destroy ---

  applyThemeColors(themes[0])
  const { knobCleanups } = bindLaunchpadControls({
    byId,
    padEl,
    trackUiTimer: uiTimers.track,
    handleUiAction,
  })
  const stopProgress = startProgressLoop(byId('master-bar-fill'), () =>
    clock.getPhase(audioCtx.currentTime)
  )
  loadThemeSounds(themes[0]).catch((err) => {
    console.error('Launchpad init error:', err)
  })

  function destroy() {
    isUnmounted = true

    stopProgress()
    split.cancelPendingSplit()
    stutter.stopAll()
    uiTimers.clearAll()

    for (const off of knobCleanups)
      off()
    knobCleanups.length = 0

    resetAudio()
    clock.clear()

    document.body.style.backgroundImage = ''
    themes.forEach((theme) =>
      theme.bodyClass && document.body.classList.remove(theme.bodyClass))
  }

  return { destroy }
}
