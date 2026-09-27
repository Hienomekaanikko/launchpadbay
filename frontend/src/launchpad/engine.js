import {
  initAudio,
  initChannelChain,
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

  let currentFadeTime = 0
  const channelLevels = {}
  for (let id = 1; id <= CHANNEL_COUNT; id++) channelLevels[id] = 1

  initAudio()
  initChannelChain()

  const byId = (id) => container.querySelector(`#${id}`)
  const padEl = (pad) => byId(padDomId(pad))

  function ensureAudioRunning() {
    if (audioCtx.state === 'suspended') audioCtx.resume()
  }

  /** Apply a channel FSM event and light the pads. */
  function lightChannel(id, event) {
    channels[id] = applyChannelEvent(channels[id], event)
    renderChannel(padEl, channels[id])
    return channels[id]
  }

  function setPadLoading(channelId, pad, loading) {
    setPadFlags(channels[channelId], pad, { loading })
    renderPad(padEl, getPadVisual(channels[channelId], slotOfPad(pad)))
  }

  const split = createSplitControl({
    clock,
    channels,
    padVoices,
    uiTimers,
    getCurrentTime: () => audioCtx.currentTime,
    isUnmounted: () => isUnmounted,
  })

  // resumeClipAt closes over scheduleClipAt (function declaration, hoisted).
  const stutter = createStutterControl({
    clock,
    channels,
    padVoices,
    getCurrentTime: () => audioCtx.currentTime,
    lightChannel,
    updateBtn: (channelId, depth, activeDepth) =>
      updateStutterBtn(byId, channelId, depth, activeDepth),
    resumeClipAt: (pad, when) => {
      scheduleClipAt(pad, when, {
        resetGain: true,
        requireSource: true,
        onSchedule: (channelId) => lightChannel(channelId, { type: 'ARM', pad }),
        onStarted: (channelId) =>
          launchCue({ type: 'CLIP_STARTED', channelId, pad }),
      })
    },
    ensureAudioRunning,
  })

  // --- Cue dispatcher: handleUiAction → resolve → launchCue ---

  function resolvePadLaunch(pad) {
    const channelId = channelOfPad(pad)
    const ch = channels[channelId]

    if (ch.activePad === pad) {
      return [
        { type: 'CANCEL_HANDOFF', channelId },
        { type: 'STOP_CLIP', pad },
      ]
    }

    if (ch.state === 'queued' && ch.queuedPad === pad) {
      return [{ type: 'CANCEL_HANDOFF', channelId }]
    }

    if (ch.state === 'idle') {
      return [{ type: 'ARM_CLIP', pad }]
    }

    return [{
      type: 'QUEUE_HANDOFF',
      channelId,
      pad,
      at: ch.queuedAt ?? clock.getNextGrid(audioCtx.currentTime),
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
        stopClip(cue.pad, cue.skipFade)
        break
      case 'QUEUE_HANDOFF':
        queueClip(cue.channelId, cue.pad, cue.at)
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
        for (const cue of resolvePadLaunch(action.pad)) launchCue(cue)
        break
      }
      case 'SPLIT_TOGGLE': {
        const active = split.toggleSplit()
        const splitBtn = byId('split-btn')
        if (splitBtn) splitBtn.classList.toggle('active', active)
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

  // --- Audio functions ---

  function cancelHandoff(channelId) {
    const ch = channels[channelId]
    if (ch.state !== 'queued' || ch.queuedPad == null) return

    const queuedPad = ch.queuedPad
    const voice = padVoices[queuedPad]
    if (voice && voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }
    if (voice && voice.source) {
      stopSource(voice.source)
      voice.source = null
    }

    lightChannel(channelId, { type: 'CANCEL_HANDOFF' })
  }

  // Shared: schedule a clip at `at`; FSM (armed/queued → playing) drives lights.
  function scheduleClipAt(pad, at, options) {
    if (!options) options = {}

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)

    if (options.resetGain) {
      const gain = channelGains[channelId]
      if (gain) {
        gain.gain.cancelScheduledValues(at)
        gain.gain.setValueAtTime(channelLevels[channelId], at)
      }
    }

    voice.source = replaceLoopSource(
      channelId,
      voice.buffer,
      clock.getLoopLength(),
      at,
      voice.source,
    )

    if (options.onSchedule) options.onSchedule(channelId)

    const delayMs = ((at - audioCtx.currentTime) * 1000) | 0
    voice.uiStartTimerId = uiTimers.track(() => {
      voice.uiStartTimerId = null
      if (isUnmounted) return
      if (options.requireSource && !voice.source) return

      if (options.onFire) options.onFire(channelId)
      if (options.onStarted) options.onStarted(channelId)
    }, delayMs)
  }

  function launchClip(pad) {
    const voice = padVoices[pad]
    if (!voice) return

    const now = audioCtx.currentTime
    let startTime
    if (!clock.isRunning()) {
      // Seed full bar from buffer; split selects full vs half via getLoopLength.
      startTime = clock.start(now, voice.buffer.duration)
    } else {
      startTime = clock.getNextGrid(now)
    }

    scheduleClipAt(pad, startTime, {
      resetGain: true,
      requireSource: true,
      onSchedule: (channelId) => lightChannel(channelId, { type: 'ARM', pad }),
      onStarted: (channelId) =>
        launchCue({ type: 'CLIP_STARTED', channelId, pad }),
    })
  }

  function stopClip(pad, skipFade) {
    if (skipFade == null) skipFade = false

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)

    if (voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }

    lightChannel(channelId, { type: 'STOP' })

    if (!anyChannelActive(channels)) {
      split.cancelPendingSplit()
      clock.clear()
    }

    if (voice.source) {
      const gain = channelGains[channelId]
      if (!skipFade && currentFadeTime > 0 && gain) {
        gain.gain.cancelScheduledValues(audioCtx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime)
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + currentFadeTime)
        const source = voice.source
        voice.source = null
        const delayMs = currentFadeTime * 1000 + 50
        uiTimers.track(() => {
          stopSource(source)
          if (!isUnmounted) channelGains[channelId].gain.setValueAtTime(channelLevels[channelId], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(channelLevels[channelId], audioCtx.currentTime)
        }
        stopSource(voice.source)
        voice.source = null
      }
    }
  }

  function queueClip(channelId, pad, handoffTime) {
    cancelHandoff(channelId)

    scheduleClipAt(pad, handoffTime, {
      onSchedule: () =>
        lightChannel(channelId, { type: 'QUEUE_HANDOFF', pad, at: handoffTime }),
      onFire: () => {
        const outgoing = channels[channelId].activePad
        if (!outgoing || outgoing === pad) return
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

  // --- Theme voice loading ---
  async function loadThemeSounds(theme) {
    stutter.stopAll()

    for (const key of Object.keys(padVoices)) {
      const pad = Number(key)
      const voice = padVoices[pad]
      if (voice && voice.source) stopClip(pad, true)
    }
    for (const key of Object.keys(padVoices)) delete padVoices[key]

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
            if (isUnmounted) return
            setPadLoading(channelId, pad, false)
          })
      })
    )

    if (isUnmounted) return

    if (Object.keys(theme.sampleUrls).length === 0) {
      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
        setAllPadsLoading(channels[channelId], false)
        renderChannel(padEl, channels[channelId])
      }
    }
  }

  // --- Bootstrap ---
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

  // --- Destroy ---
  function destroy() {
    isUnmounted = true

    stopProgress()
    split.cancelPendingSplit()
    stutter.stopAll()
    uiTimers.clearAll()

    for (const off of knobCleanups) off()
    knobCleanups.length = 0

    resetAudio()
    clock.clear()

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
