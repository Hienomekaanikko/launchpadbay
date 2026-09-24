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
  const stutterSources = {}
  const STUTTER_DEPTHS = [4, 8, 16]

  let currentFadeTime = 0
  const channelVolumes = {}
  for (let id = 1; id <= CHANNEL_COUNT; id++) channelVolumes[id] = 1

  initAudio()
  initChannelChain()

  const split = createSplitControl({
    clock,
    channels,
    padVoices,
    uiTimers,
    getCurrentTime: () => audioCtx.currentTime,
    isUnmounted: () => isUnmounted,
  })

  const byId = (id) => container.querySelector(`#${id}`)
  const padEl = (pad) => byId(padDomId(pad))

  function ensureAudioRunning() {
    if (audioCtx.state === 'suspended') audioCtx.resume()
  }

  function dispatchChannelEvent(id, event) {
    channels[id] = applyChannelEvent(channels[id], event)
    renderChannel(padEl, channels[id])
    return channels[id]
  }

  function setPadLoading(channelId, pad, loading) {
    setPadFlags(channels[channelId], pad, { loading })
    renderPad(padEl, getPadVisual(channels[channelId], slotOfPad(pad)))
  }

  function stopStutterSource(channelId, when) {
    stopSource(stutterSources[channelId], when)
    delete stutterSources[channelId]
  }

  function refreshStutterBtn(channelId) {
    const { depth, activeDepth } = channels[channelId].stutter
    updateStutterBtn(byId, channelId, depth, activeDepth)
  }

  function endStutter(channelId, options) {
    if (!options) options = {}
    stopStutterSource(channelId)
    if (options.resume) {
      const pad = channels[channelId].activePad
      // startLoop → ARM from stuttering (clears activeDepth, blinks until boundary)
      if (pad) startLoop(pad)
    } else {
      dispatchChannelEvent(channelId, { type: 'STUTTER_OFF' })
    }
    refreshStutterBtn(channelId)
  }

  function armStutterSource(channelId, voice, depth, startTime) {
    stutterSources[channelId] = replaceLoopSource(
      channelId,
      voice.buffer,
      clock.getLoopLength() / depth,
      startTime,
      stutterSources[channelId],
    )
    dispatchChannelEvent(channelId, { type: 'STUTTER_ON', depth })
  }

  // --- Audio functions ---

  function cancelPendingLoop(channelId) {
    const ch = channels[channelId]
    if (ch.state !== 'pending' || ch.pendingPad == null) return

    const pendingPad = ch.pendingPad
    const voice = padVoices[pendingPad]
    if (voice && voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }
    if (voice && voice.source) {
      stopSource(voice.source)
      voice.source = null
    }

    dispatchChannelEvent(channelId, { type: 'CANCEL_PENDING' })
  }

  // Shared: schedule a loop at `at`; FSM (armed/pending → playing) drives lights.
  function scheduleLoopAt(pad, at, options) {
    if (!options) options = {}

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)

    if (options.resetGain) {
      const gain = channelGains[channelId]
      if (gain) {
        gain.gain.cancelScheduledValues(at)
        gain.gain.setValueAtTime(channelVolumes[channelId], at)
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

  function startLoop(pad) {
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

    scheduleLoopAt(pad, startTime, {
      resetGain: true,
      requireSource: true,
      onSchedule: (channelId) => dispatchChannelEvent(channelId, { type: 'ARM', pad }),
      onStarted: (channelId) => dispatchChannelEvent(channelId, { type: 'STARTED', pad }),
    })
  }

  function stopLoop(pad, skipFade) {
    if (skipFade == null) skipFade = false

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)

    if (voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }

    dispatchChannelEvent(channelId, { type: 'STOP' })

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
          if (!isUnmounted) channelGains[channelId].gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }
        stopSource(voice.source)
        voice.source = null
      }
    }
  }

  function queueLoop(channelId, pad, handoffTime) {
    cancelPendingLoop(channelId)

    scheduleLoopAt(pad, handoffTime, {
      onSchedule: () =>
        dispatchChannelEvent(channelId, { type: 'QUEUE_HANDOFF', pad, at: handoffTime }),
      onFire: () => {
        const outgoing = channels[channelId].activePad
        if (!outgoing || outgoing === pad) return
        const outVoice = padVoices[outgoing]
        if (outVoice && outVoice.source) {
          stopSource(outVoice.source)
          outVoice.source = null
        }
      },
      onStarted: () => dispatchChannelEvent(channelId, { type: 'STARTED', pad }),
    })
  }

  function toggleLoop(pad) {
    ensureAudioRunning()

    const channelId = channelOfPad(pad)
    const ch = channels[channelId]

    if (ch.stutter.activeDepth !== 0) {
      endStutter(channelId)
    }

    const current = channels[channelId]

    // Active pad pressed → stop (also drops any queued handoff).
    if (current.activePad === pad) {
      cancelPendingLoop(channelId)
      stopLoop(pad)
      return
    }

    // Pending pad pressed again → cancel the queued handoff only.
    if (current.state === 'pending' && current.pendingPad === pad) {
      cancelPendingLoop(channelId)
      return
    }

    if (current.state === 'idle') {
      startLoop(pad)
      return
    }

    let handoffTime = current.pendingAt
    if (handoffTime == null) handoffTime = clock.getNextGrid(audioCtx.currentTime)
    queueLoop(channelId, pad, handoffTime)
  }

  function tapStutter(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    if (ch.stutter.activeDepth !== 0) {
      endStutter(channelId, { resume: true })
    } else {
      startStutter(channelId, ch.stutter.depth)
      if (stutterSources[channelId]) refreshStutterBtn(channelId)
    }
  }

  function cycleStutterDepth(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    const idx = STUTTER_DEPTHS.indexOf(ch.stutter.depth)
    const depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]
    dispatchChannelEvent(channelId, { type: 'STUTTER_DEPTH', depth })

    const next = channels[channelId]
    if (next.stutter.activeDepth !== 0) {
      const pad = next.activePad
      let voice = null
      if (pad) voice = padVoices[pad]
      if (voice && voice.buffer && stutterSources[channelId]) {
        const startTime = clock.getNextGrid(audioCtx.currentTime)
        stopStutterSource(channelId, startTime)
        armStutterSource(channelId, voice, depth, startTime)
      }
    }
    refreshStutterBtn(channelId)
  }

  function startStutter(channelId, stutterDepth) {
    const ch = channels[channelId]
    const pad = ch.activePad
    if (!pad || ch.state !== 'playing') return
    const voice = padVoices[pad]
    if (!voice || !voice.buffer) return

    stopStutterSource(channelId)

    const startTime = clock.getNextGrid(audioCtx.currentTime)
    if (voice.source) {
      stopSource(voice.source, startTime)
      voice.source = null
    }

    armStutterSource(channelId, voice, stutterDepth, startTime)
  }

  function setVolume(channelId, v) {
    channelVolumes[channelId] = v / 100
    channelGains[channelId].gain.setValueAtTime(v / 100, audioCtx.currentTime)
  }

  function setFilter(channelId, v) {
    channelFilters[channelId].frequency.setValueAtTime(
      200 * Math.pow(100, v / 100),
      audioCtx.currentTime,
    )
  }

  // --- Theme voice loading ---
  async function loadThemeSounds(theme) {
    for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
      stopStutterSource(channelId)
    }

    for (const key of Object.keys(padVoices)) {
      const pad = Number(key)
      const voice = padVoices[pad]
      if (voice && voice.source) stopLoop(pad, true)
    }
    for (const key of Object.keys(padVoices)) delete padVoices[key]

    for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
      const keptDepth = channels[channelId].stutter.depth
      dispatchChannelEvent(channelId, { type: 'RESET' })
      channels[channelId].stutter.depth = keptDepth
      setAllPadsLoading(channels[channelId], true)
      renderChannel(padEl, channels[channelId])
      updateStutterBtn(byId, channelId, keptDepth, 0)
    }

    split.cancelPendingSplit()
    clock.clear()

    await Promise.all(
      // theme.sampleUrls keys are pad indexes 1–25 (DB column name: "slot")
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
    onPad: toggleLoop,
    toggleSplit: split.toggleSplit,
    onStutterTap: tapStutter,
    onStutterCycle: cycleStutterDepth,
    setVolume,
    setFilter,
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
    uiTimers.clearAll()

    for (const off of knobCleanups) off()
    knobCleanups.length = 0

    for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
      stopStutterSource(channelId)
    }

    resetAudio()
    clock.clear()

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
