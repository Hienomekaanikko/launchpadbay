import {
  initAudio,
  initChannelChain,
  loadPadVoice,
  createLoopSource,
  resetAudio,
  padVoices,
  audioCtx,
  channelGains,
  channelFilters,
} from './audio.js'
import {
  CHANNEL_COUNT,
  PAD_COUNT,
  channelOfPad,
  padDomId,
} from './pads.js'
import {
  updateStutterBtn,
  applyThemeColors,
  startProgressLoop,
} from './ui.js'
import { createClock } from './clock.js'
import {
  createChannels,
  reduceChannel,
  anyChannelSounding,
} from './channel.js'
import { createUiTimers } from './uiTimers.js'
import { bindLaunchpadControls } from './bindings.js'

export function mountLaunchpad(container, themes) {
  let isTornDown = false
  const uiTimers = createUiTimers()

  const clock = createClock()
  const channels = createChannels(CHANNEL_COUNT)
  const STUTTER_DEPTHS = [4, 8, 16]

  let splitActive = false
  let currentFadeTime = 0
  let channelVolumes = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }

  initAudio()
  initChannelChain()

  const byId = (id) => container.querySelector(`#${id}`)
  const padEl = (pad) => byId(padDomId(pad))

  function ensureAudioRunning() {
    if (audioCtx.state === 'suspended') audioCtx.resume()
  }

  function setChannel(id, event) {
    channels[id] = reduceChannel(channels[id], event)
    return channels[id]
  }

  function masterPeriodFromBuffer(bufferDurationSec) {
    let period = bufferDurationSec || 1
    if (splitActive) period = period / 2
    return period
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
    const src = channels[channelId].stutterSource
    if (!src) return
    try {
      if (when != null) src.stop(when)
      else src.stop()
    } catch { /* already stopped */ }
    channels[channelId].stutterSource = null
  }

  function refreshStutterBtn(channelId) {
    const { depth, activeDepth } = channels[channelId].stutter
    updateStutterBtn(byId, channelId, depth, activeDepth)
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
    channels[channelId].stutterSource = source
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
      try { voice.source.stop() } catch { /* hasn't started yet */ }
      voice.source = null
    }

    const button = padEl(pendingPad)
    if (button) button.classList.remove('blink', 'active')

    setChannel(channelId, { type: 'CANCEL_PENDING' })
  }

  function startLoop(pad, options) {
    if (!options) options = {}
    let resume = options.resume
    if (resume == null) resume = false

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)
    const startTime = resolveStartTime(voice.buffer.duration)

    const gain = channelGains[channelId]
    if (gain) {
      gain.gain.cancelScheduledValues(startTime)
      gain.gain.setValueAtTime(channelVolumes[channelId], startTime)
    }

    const source = createLoopSource(voice.buffer, splitActive)
    source.connect(channelGains[channelId])
    source.start(startTime)
    voice.source = source

    const button = padEl(pad)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    if (!resume) setChannel(channelId, { type: 'ARM', pad })

    const delayMs = ((startTime - audioCtx.currentTime) * 1000) | 0
    voice.uiStartTimerId = uiTimers.track(() => {
      if (isTornDown || !voice.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!resume) setChannel(channelId, { type: 'STARTED', pad })
      voice.uiStartTimerId = null
    }, delayMs)
  }

  function stopLoop(pad, skipFade) {
    if (skipFade == null) skipFade = false

    const voice = padVoices[pad]
    if (!voice) return

    const channelId = channelOfPad(pad)
    const button = padEl(pad)

    if (voice.uiStartTimerId) {
      uiTimers.cancel(voice.uiStartTimerId)
      voice.uiStartTimerId = null
    }

    if (button) button.classList.remove('blink', 'active')
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
          try { source.stop() } catch { /* already stopped */ }
          if (!isTornDown) channelGains[channelId].gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(channelVolumes[channelId], audioCtx.currentTime)
        }
        try { voice.source.stop() } catch { /* already stopped */ }
        voice.source = null
      }
    }
  }

  function scheduleHandoff(channelId, pad, handoffTime) {
    cancelPendingLoop(channelId)

    const voice = padVoices[pad]
    if (!voice) return

    const source = createLoopSource(voice.buffer, splitActive)
    source.connect(channelGains[channelId])
    source.start(handoffTime)
    voice.source = source

    const button = padEl(pad)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    setChannel(channelId, { type: 'QUEUE_HANDOFF', pad, at: handoffTime })

    const delayMs = ((handoffTime - audioCtx.currentTime) * 1000) | 0
    voice.uiStartTimerId = uiTimers.track(() => {
      voice.uiStartTimerId = null
      if (isTornDown) return

      const ch = channels[channelId]
      const outgoing = ch.activePad
      if (outgoing && outgoing !== pad) {
        const outVoice = padVoices[outgoing]
        if (outVoice && outVoice.source) {
          try { outVoice.source.stop() } catch { /* already stopped */ }
          outVoice.source = null
        }
        const outButton = padEl(outgoing)
        if (outButton) outButton.classList.remove('blink', 'active')
      }

      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }

      setChannel(channelId, { type: 'STARTED', pad })
    }, delayMs)
  }

  function toggleLoop(pad) {
    ensureAudioRunning()

    const channelId = channelOfPad(pad)
    const ch = channels[channelId]

    if (ch.stutter.activeDepth !== 0) {
      stopStutterSource(channelId)
      setChannel(channelId, { type: 'STUTTER_OFF' })
      refreshStutterBtn(channelId)
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
      if (channels[channelId].stutterSource) refreshStutterBtn(channelId)
    }
  }

  function releaseStutter(channelId) {
    stopStutterSource(channelId)
    setChannel(channelId, { type: 'STUTTER_OFF' })

    const pad = channels[channelId].activePad
    if (pad) startLoop(pad, { resume: true })

    refreshStutterBtn(channelId)
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
      if (voice && voice.buffer && next.stutterSource) {
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
    if (!pad || (ch.state !== 'playing' && ch.state !== 'armed')) return
    const voice = padVoices[pad]
    if (!voice || !voice.buffer) return

    stopStutterSource(channelId)

    const startTime = resolveStartTime(voice.buffer.duration)
    if (voice.source) {
      try { voice.source.stop(startTime) } catch { /* noop */ }
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
        if (splitActive) {
          voice.source.loopEnd = voice.buffer.duration / 2
        } else {
          voice.source.loopEnd = voice.buffer.duration
        }
      }
    }
    if (clock.isRunning()) {
      const { periodSec } = clock.snapshot()
      const now = audioCtx.currentTime
      let newPeriod
      if (splitActive) newPeriod = periodSec / 2
      else newPeriod = periodSec * 2
      clock.setPeriod(newPeriod, now, true)
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
      updateStutterBtn(byId, channelId, keptDepth, 0)
    }

    clock.clear()

    for (let pad = 1; pad <= PAD_COUNT; pad++) {
      const btn = padEl(pad)
      if (btn) btn.classList.add('btn-loading')
    }

    await Promise.all(
      // theme.sampleUrls keys are pad indexes 1–25 (DB column name: "slot")
      Object.entries(theme.sampleUrls).map(([key, url]) => {
        const pad = Number(key)
        return loadPadVoice(pad, url)
          .finally(() => {
            const btn = padEl(pad)
            if (btn) btn.classList.remove('btn-loading')
          })
      })
    )

    if (isTornDown) return

    if (Object.keys(theme.sampleUrls).length === 0) {
      for (let pad = 1; pad <= PAD_COUNT; pad++) {
        const btn = padEl(pad)
        if (btn) btn.classList.remove('btn-loading')
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
