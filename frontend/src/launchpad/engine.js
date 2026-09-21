import {
  initAudio,
  initChannelChain,
  loadPadVoice,
  createLoopSource,
  splitDuration,
  periodAfterSplitToggle,
  safeStop,
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
import {
  createChannels,
  reduceChannel,
  anyChannelSounding,
  patchPad,
  padVisual,
  setAllPadsLoading,
} from './channel.js'
import { createUiTimers } from './uiTimers.js'
import { bindLaunchpadControls } from './bindings.js'

export function mountLaunchpad(container, themes) {
  let isTornDown = false
  const uiTimers = createUiTimers()

  const clock = createClock()
  const channels = createChannels(CHANNEL_COUNT)
  const stutterSources = {} // channelId -> AudioBufferSourceNode
  const STUTTER_DEPTHS = [4, 8, 16]

  let splitActive = false
  let currentFadeTime = 0
  const channelVolumes = {}
  for (let id = 1; id <= CHANNEL_COUNT; id++) channelVolumes[id] = 1

  initAudio()
  initChannelChain()

  const byId = (id) => container.querySelector(`#${id}`)
  const padEl = (pad) => byId(padDomId(pad))

  function ensureAudioRunning() {
    if (audioCtx.state === 'suspended') audioCtx.resume()
  }

  function setChannel(id, event) {
    channels[id] = reduceChannel(channels[id], event)
    renderChannel(padEl, channels[id])
    return channels[id]
  }

  function updatePadLoading(channelId, pad, loading) {
    patchPad(channels[channelId], pad, { loading })
    renderPad(padEl, padVisual(channels[channelId], slotOfPad(pad)))
  }

  function masterPeriodFromBuffer(bufferDurationSec) {
    return splitDuration(bufferDurationSec || 1, splitActive)
  }

  function resolveStartTime(bufferDurationSec) {
    const now = audioCtx.currentTime
    if (!clock.isRunning()) {
      return clock.arm(now, masterPeriodFromBuffer(bufferDurationSec))
    }
    return clock.nextBoundary(now)
  }

  function stutterLoopSec(depth, bufferDurationSec) {
    const { periodSec } = clock.snapshot()
    let period = periodSec
    if (period == null) period = masterPeriodFromBuffer(bufferDurationSec)
    return period / depth
  }

  function stopStutterSource(channelId, when) {
    safeStop(stutterSources[channelId], when)
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
      setChannel(channelId, { type: 'STUTTER_OFF' })
    }
    refreshStutterBtn(channelId)
  }

  function armStutterSource(channelId, voice, depth, startTime) {
    const source = createLoopSource(
      voice.buffer,
      splitActive,
      stutterLoopSec(depth, voice.buffer.duration),
    )
    source.connect(channelGains[channelId])
    source.start(startTime)
    setChannel(channelId, { type: 'STUTTER_ON', depth })
    stutterSources[channelId] = source
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
      safeStop(voice.source)
      voice.source = null
    }

    setChannel(channelId, { type: 'CANCEL_PENDING' })
  }

  // Shared: schedule a pad voice at `at`; FSM (armed/pending → playing) drives lights.
  function schedulePadAt(pad, at, options) {
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

    const source = createLoopSource(voice.buffer, splitActive)
    source.connect(channelGains[channelId])
    source.start(at)
    voice.source = source

    if (options.onSchedule) options.onSchedule(channelId)

    const delayMs = ((at - audioCtx.currentTime) * 1000) | 0
    voice.uiStartTimerId = uiTimers.track(() => {
      voice.uiStartTimerId = null
      if (isTornDown) return
      if (options.requireSource && !voice.source) return

      if (options.onFire) options.onFire(channelId)
      if (options.onStarted) options.onStarted(channelId)
    }, delayMs)
  }

  function startLoop(pad) {
    const voice = padVoices[pad]
    if (!voice) return

    const startTime = resolveStartTime(voice.buffer.duration)

    schedulePadAt(pad, startTime, {
      resetGain: true,
      requireSource: true,
      onSchedule: (channelId) => setChannel(channelId, { type: 'ARM', pad }),
      onStarted: (channelId) => setChannel(channelId, { type: 'STARTED', pad }),
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

    setChannel(channelId, { type: 'STOP' })

    if (!anyChannelSounding(channels)) clock.clear()

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
          safeStop(source)
          if (!isTornDown) channelGains[channelId].gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }
        safeStop(voice.source)
        voice.source = null
      }
    }
  }

  function scheduleHandoff(channelId, pad, handoffTime) {
    cancelPendingLoop(channelId)

    schedulePadAt(pad, handoffTime, {
      onSchedule: () =>
        setChannel(channelId, { type: 'QUEUE_HANDOFF', pad, at: handoffTime }),
      onFire: () => {
        const outgoing = channels[channelId].activePad
        if (!outgoing || outgoing === pad) return
        const outVoice = padVoices[outgoing]
        if (outVoice && outVoice.source) {
          safeStop(outVoice.source)
          outVoice.source = null
        }
      },
      onStarted: () => setChannel(channelId, { type: 'STARTED', pad }),
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

    // Sounding pad pressed → stop (also drops any queued handoff).
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
    if (handoffTime == null) handoffTime = clock.nextBoundary(audioCtx.currentTime)
    scheduleHandoff(channelId, pad, handoffTime)
  }

  function tapStutter(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    if (ch.stutter.activeDepth !== 0) {
      releaseStutter(channelId)
    } else {
      startStutter(channelId, ch.stutter.depth)
      if (stutterSources[channelId]) refreshStutterBtn(channelId)
    }
  }

  function releaseStutter(channelId) {
    endStutter(channelId, { resume: true })
  }

  function cycleStutterDepth(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    const idx = STUTTER_DEPTHS.indexOf(ch.stutter.depth)
    const depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]
    setChannel(channelId, { type: 'STUTTER_DEPTH', depth })

    const next = channels[channelId]
    if (next.stutter.activeDepth !== 0) {
      const pad = next.activePad
      let voice = null
      if (pad) voice = padVoices[pad]
      if (voice && voice.buffer && stutterSources[channelId]) {
        const startTime = clock.nextBoundary(audioCtx.currentTime)
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

    const startTime = resolveStartTime(voice.buffer.duration)
    if (voice.source) {
      safeStop(voice.source, startTime)
      voice.source = null
    }

    armStutterSource(channelId, voice, stutterDepth, startTime)
  }

  // Split: flip flag, rewrite active loopEnds, rescale clock period.
  function onSplit() {
    splitActive = !splitActive
    for (const ch of Object.values(channels)) {
      if (!ch.activePad) continue
      const voice = padVoices[ch.activePad]
      if (voice && voice.source) {
        voice.source.loopEnd = splitDuration(voice.buffer.duration, splitActive)
      }
    }
    if (clock.isRunning()) {
      const { periodSec } = clock.snapshot()
      const now = audioCtx.currentTime
      clock.setPeriod(periodAfterSplitToggle(periodSec, splitActive), now, true)
    }
    return splitActive
  }

  function onVolume(channelId, v) {
    channelVolumes[channelId] = v / 100
    channelGains[channelId].gain.setValueAtTime(v / 100, audioCtx.currentTime)
  }

  function onFilter(channelId, v) {
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
      setChannel(channelId, { type: 'RESET' })
      channels[channelId].stutter.depth = keptDepth
      setAllPadsLoading(channels[channelId], true)
      renderChannel(padEl, channels[channelId])
      updateStutterBtn(byId, channelId, keptDepth, 0)
    }

    clock.clear()

    await Promise.all(
      // theme.sampleUrls keys are pad indexes 1–25 (DB column name: "slot")
      Object.entries(theme.sampleUrls).map(([key, url]) => {
        const pad = Number(key)
        const channelId = channelOfPad(pad)
        return loadPadVoice(pad, url)
          .finally(() => {
            if (isTornDown) return
            updatePadLoading(channelId, pad, false)
          })
      })
    )

    if (isTornDown) return

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
    onSplit,
    onStutterTap: tapStutter,
    onStutterCycle: cycleStutterDepth,
    onVolume,
    onFilter,
  })
  const stopProgress = startProgressLoop(byId('master-bar-fill'), () =>
    clock.phase(audioCtx.currentTime)
  )
  loadThemeSounds(themes[0]).catch((err) => {
    console.error('Launchpad init error:', err)
  })

  // --- Destroy ---
  function destroy() {
    isTornDown = true

    stopProgress()
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
