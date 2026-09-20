// NOTE: stale: fades, masterPad,

import {
  initAudio,
  initDSP,
  loadSound,
  createBufferSource,
  resetAudio,
  sounds,
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
  createKnob,
  setupKnobDrag,
  updateKnobVisual,
  updateStutterBtn,
  applyThemeColors,
  startProgressLoop,
} from './ui.js'

export function mountLaunchpad(container, themes) {
  let isTornDown = false
  const uiTimerIds = new Set()

  // channel -> pad index currently sounding, or null
  let channelActive = { 1: null, 2: null, 3: null, 4: null, 5: null }
  // channel -> { pad, handoffTime } queued to take over at the next boundary
  let channelPending = { 1: null, 2: null, 3: null, 4: null, 5: null }
  let channelStutter = {
    1: { activeDepth: 0, depth: 4, source: null },
    2: { activeDepth: 0, depth: 4, source: null },
    3: { activeDepth: 0, depth: 4, source: null },
    4: { activeDepth: 0, depth: 4, source: null },
    5: { activeDepth: 0, depth: 4, source: null },
  }
  const STUTTER_DEPTHS = [4, 8, 16]

  let masterPad = null
  let masterStartTime = null
  let masterLoopDuration = null
  let splitActive = false
  let currentFadeTime = 0
  let channelVolumes = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }

  initAudio()
  initDSP()

  const byId = (id) => container.querySelector(`#${id}`)
  const padEl = (pad) => byId(padDomId(pad))

  function cancelUiTimer(id) {
    uiTimerIds.delete(id)
    clearTimeout(id)
  }

  function trackUiTimer(fn, delayMs) {
    const id = setTimeout(() => {
      uiTimerIds.delete(id)
      fn()
    }, delayMs)
    uiTimerIds.add(id)
    return id
  }

  function getNextStartTime(bufferDurationSec) {
    if (!masterStartTime || !masterLoopDuration) {
      const now = audioCtx.currentTime
      const futureStart = now + 0.1
      masterStartTime = futureStart
      let duration = bufferDurationSec || 1
      if (splitActive) duration = duration / 2
      masterLoopDuration = duration
      return futureStart
    }
    const now = audioCtx.currentTime
    const elapsed = now - masterStartTime
    const completedBars = Math.floor(elapsed / masterLoopDuration)
    return masterStartTime + (completedBars + 1) * masterLoopDuration
  }

  function bindPadsToEngine() {
    for (let pad = 1; pad <= PAD_COUNT; pad++) {
      const btn = padEl(pad)
      if (!btn) continue
      const onPad = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume()
        toggleLoop(pad)
      }
      btn.addEventListener('click', onPad)
      btn.addEventListener('touchend', (e) => { e.preventDefault(); onPad() }, { passive: false })
    }
  }

  // --- Audio functions ---

  function cancelPendingLoop(channel) {
    const pending = channelPending[channel]
    if (!pending) return

    const sound = sounds[pending.pad]
    if (sound && sound.startUiTimerId) {
      cancelUiTimer(sound.startUiTimerId)
      sound.startUiTimerId = null
    }
    if (sound && sound.source) {
      try { sound.source.stop() } catch { /* hasn't started yet */ }
      sound.source = null
    }

    const button = padEl(pending.pad)
    if (button) button.classList.remove('blink', 'active')

    channelPending[channel] = null
  }

  function startLoop(pad) {
    const sound = sounds[pad]
    if (!sound) return

    const channel = channelOfPad(pad)
    const startTime = getNextStartTime(sound.buffer.duration)

    const gain = channelGains[channel]
    if (gain) {
      gain.gain.cancelScheduledValues(startTime)
      gain.gain.setValueAtTime(channelVolumes[channel], startTime)
    }

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(channelGains[channel])
    source.start(startTime)
    sound.source = source

    const button = padEl(pad)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    channelActive[channel] = pad

    const delayMs = ((startTime - audioCtx.currentTime) * 1000) | 0
    sound.startUiTimerId = trackUiTimer(() => {
      if (isTornDown || !sound.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!masterPad) masterPad = pad
      sound.startUiTimerId = null
    }, delayMs)
  }

  function stopLoop(pad, skipFade = false) {
    const sound = sounds[pad]
    if (!sound) return

    const channel = channelOfPad(pad)
    const button = padEl(pad)

    if (sound.startUiTimerId) {
      cancelUiTimer(sound.startUiTimerId)
      sound.startUiTimerId = null
    }

    if (button) button.classList.remove('blink', 'active')
    if (channelActive[channel] === pad) channelActive[channel] = null
    if (masterPad === pad) masterPad = null

    const anyActive = Object.values(channelActive).some((a) => a !== null)
    if (!anyActive) {
      masterStartTime = null
      masterLoopDuration = null
    }

    if (sound.source) {
      const gain = channelGains[channel]
      if (!skipFade && currentFadeTime > 0 && gain) {
        gain.gain.cancelScheduledValues(audioCtx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime)
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + currentFadeTime)
        const source = sound.source
        sound.source = null
        const delayMs = currentFadeTime * 1000 + 50
        trackUiTimer(() => {
          try { source.stop() } catch { /* already stopped */ }
          if (!isTornDown) channelGains[channel].gain.setValueAtTime(channelVolumes[channel], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(channelVolumes[channel], audioCtx.currentTime)
        }
        try { sound.source.stop() } catch { /* already stopped */ }
        sound.source = null
      }
    }
  }

  function scheduleHandoff(channel, pad, handoffTime) {
    cancelPendingLoop(channel)

    const sound = sounds[pad]
    if (!sound) return

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(channelGains[channel])
    source.start(handoffTime)
    sound.source = source

    const button = padEl(pad)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    channelPending[channel] = { pad, handoffTime }

    const delayMs = ((handoffTime - audioCtx.currentTime) * 1000) | 0
    sound.startUiTimerId = trackUiTimer(() => {
      sound.startUiTimerId = null
      if (isTornDown) return

      const outgoing = channelActive[channel]
      if (outgoing) {
        const outSound = sounds[outgoing]
        if (outSound && outSound.source) {
          try { outSound.source.stop() } catch { /* already stopped */ }
          outSound.source = null
        }
        const outButton = padEl(outgoing)
        if (outButton) outButton.classList.remove('blink', 'active')
      }

      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }

      channelActive[channel] = pad
      channelPending[channel] = null
      masterPad = pad
    }, delayMs)
  }

  function toggleLoop(pad) {
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const channel = channelOfPad(pad)

    if (channelStutter[channel].activeDepth !== 0) {
      const stutter = channelStutter[channel]
      if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
      stutter.activeDepth = 0
      updateStutterBtn(byId, channel, stutter.depth, stutter.activeDepth)
    }

    const current = channelActive[channel]
    const pending = channelPending[channel]

    if (current === pad) {
      cancelPendingLoop(channel)
      stopLoop(pad)
      return
    }

    if (pending && pending.pad === pad) {
      cancelPendingLoop(channel)
      return
    }

    if (!current) {
      startLoop(pad)
      return
    }

    const currentSound = sounds[current]
    let bufferDurationSec = 1
    if (currentSound && currentSound.buffer) {
      bufferDurationSec = currentSound.buffer.duration
    }
    let handoffTime
    if (pending) {
      handoffTime = pending.handoffTime
    } else {
      handoffTime = getNextStartTime(bufferDurationSec)
    }
    scheduleHandoff(channel, pad, handoffTime)
  }

  function tapStutter(channel) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const stutter = channelStutter[channel]
    if (stutter.activeDepth !== 0) {
      releaseStutter(channel)
    } else {
      startStutter(channel, stutter.depth)
      // Only light the button when a stutter source actually armed.
      if (stutter.source) stutter.activeDepth = stutter.depth
      updateStutterBtn(byId, channel, stutter.depth, stutter.activeDepth)
    }
  }

  function releaseStutter(channel) {
    const stutter = channelStutter[channel]
    if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
    stutter.activeDepth = 0

    const pad = channelActive[channel]
    if (pad) startLoop(pad)

    updateStutterBtn(byId, channel, stutter.depth, stutter.activeDepth)
  }

  function cycleStutterDepth(channel) {
    const stutter = channelStutter[channel]
    const idx = STUTTER_DEPTHS.indexOf(stutter.depth)
    stutter.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (stutter.activeDepth !== 0) {
      const pad = channelActive[channel]
      let sound = null
      if (pad) sound = sounds[pad]
      if (sound && sound.buffer && stutter.source) {
        const startTime = getNextStartTime(sound.buffer.duration)
        let bufferDurationSec = sound.buffer.duration
        if (splitActive) bufferDurationSec = bufferDurationSec / 2
        const stutterLoopSec = bufferDurationSec / stutter.depth

        try { stutter.source.stop(startTime) } catch { /* noop */ }

        const source = createBufferSource(sound.buffer, splitActive, stutterLoopSec)
        source.connect(channelGains[channel])
        source.start(startTime)
        stutter.source = source
        stutter.activeDepth = stutter.depth
      }
    }

    updateStutterBtn(byId, channel, stutter.depth, stutter.activeDepth)
  }

  function startStutter(channel, stutterDepth) {
    const pad = channelActive[channel]
    if (!pad) return
    const sound = sounds[pad]
    if (!sound || !sound.buffer) return

    const stutter = channelStutter[channel]
    if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }

    let bufferDurationSec = sound.buffer.duration
    if (splitActive) bufferDurationSec = bufferDurationSec / 2
    const stutterLoopSec = bufferDurationSec / stutterDepth
    const startTime = getNextStartTime(sound.buffer.duration)

    if (sound.source) { try { sound.source.stop(startTime) } catch { /* noop */ } sound.source = null }

    const source = createBufferSource(sound.buffer, splitActive, stutterLoopSec)
    source.connect(channelGains[channel])
    source.start(startTime)
    stutter.source = source
  }

  // --- Theme sound loading ---
  async function loadThemeSounds(theme) {
    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      const stutter = channelStutter[channel]
      if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
      stutter.activeDepth = 0
      updateStutterBtn(byId, channel, stutter.depth, stutter.activeDepth)
    }

    // Object keys are strings; coerce so stopLoop's === checks stay correct.
    for (const key of Object.keys(sounds)) {
      const pad = Number(key)
      const sound = sounds[pad]
      if (sound && sound.source) stopLoop(pad, true)
    }
    for (const key of Object.keys(sounds)) delete sounds[key]

    masterPad = null
    masterStartTime = null
    masterLoopDuration = null

    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      channelActive[channel] = null
      channelPending[channel] = null
    }

    for (let pad = 1; pad <= PAD_COUNT; pad++) {
      const btn = padEl(pad)
      if (btn) btn.classList.add('btn-loading')
    }

    await Promise.all(
      // theme.sounds keys are pad indexes 1–25 (DB column name: "slot")
      Object.entries(theme.sounds).map(([key, url]) => {
        const pad = Number(key)
        return loadSound(pad, url)
          .finally(() => {
            const btn = padEl(pad)
            if (btn) btn.classList.remove('btn-loading')
          })
      })
    )

    if (isTornDown) return

    if (Object.keys(theme.sounds).length === 0) {
      for (let pad = 1; pad <= PAD_COUNT; pad++) {
        const btn = padEl(pad)
        if (btn) btn.classList.remove('btn-loading')
      }
    }
  }

  // --- UI binding ---
  function bindTransport() {
    const splitBtn = byId('split-btn')
    const onSplit = () => {
      splitActive = !splitActive
      splitBtn.classList.toggle('active', splitActive)
      for (const pad of Object.values(channelActive)) {
        if (!pad) continue
        const sound = sounds[pad]
        if (sound && sound.source) {
          if (splitActive) {
            sound.source.loopEnd = sound.buffer.duration / 2
          } else {
            sound.source.loopEnd = sound.buffer.duration
          }
        }
      }
      if (masterLoopDuration) {
        if (splitActive) {
          masterLoopDuration = masterLoopDuration / 2
        } else {
          masterLoopDuration = masterLoopDuration * 2
        }
      }
    }
    splitBtn.addEventListener('click', onSplit)
    splitBtn.addEventListener('touchend', (e) => { e.preventDefault(); onSplit() }, { passive: false })
  }

  // Double-tap: single = cycle depth, double = toggle stutter
  function bindStutterControls() {
    const stutterCol = byId('stutter-btns')
    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      const btn = document.createElement('button')
      btn.id = `stutter-btn-${channel}`
      btn.className = 'stutter-btn'
      btn.textContent = '1/4'
      stutterCol.appendChild(btn)

      let tapCount = 0
      let tapTimer = null
      const onTap = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume()
        tapCount++
        clearTimeout(tapTimer)
        tapTimer = trackUiTimer(() => {
          if (tapCount === 1) cycleStutterDepth(channel)
          else tapStutter(channel)
          tapCount = 0
        }, 280)
      }
      btn.addEventListener('click', onTap)
      btn.addEventListener('touchend', (e) => { e.preventDefault(); onTap() }, { passive: false })
    }
  }

  function bindKnobs() {
    const cleanups = []
    const volCol = byId('vol-knobs')
    const filterCol = byId('filter-knobs')
    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      const colorClass = `row-color-${channel}`

      const volWrap = createKnob(`vol-wrap-${channel}`, colorClass)
      volCol.appendChild(volWrap)
      let volVal = 100
      cleanups.push(setupKnobDrag(volWrap, () => volVal, (v) => {
        volVal = v
        channelVolumes[channel] = v / 100
        channelGains[channel].gain.setValueAtTime(v / 100, audioCtx.currentTime)
        updateKnobVisual(volWrap, v)
      }))

      const filterWrap = createKnob(`filter-wrap-${channel}`, colorClass)
      filterCol.appendChild(filterWrap)
      let filterVal = 100
      cleanups.push(setupKnobDrag(filterWrap, () => filterVal, (v) => {
        filterVal = v
        channelFilters[channel].frequency.setValueAtTime(200 * Math.pow(100, v / 100), audioCtx.currentTime)
        updateKnobVisual(filterWrap, v)
      }))
    }
    return cleanups
  }

  // --- Bootstrap ---
  applyThemeColors(themes[0])
  bindTransport()
  bindStutterControls()
  const knobCleanups = bindKnobs()
  const stopProgress = startProgressLoop(byId('master-bar-fill'), () => ({
    now: audioCtx.currentTime,
    masterStartTime,
    masterLoopDuration,
  }))
  bindPadsToEngine()
  loadThemeSounds(themes[0]).catch((err) => {
    console.error('Launchpad init error:', err)
  })

  // --- Destroy ---
  function destroy() {
    isTornDown = true

    stopProgress()

    for (const id of uiTimerIds) clearTimeout(id)
    uiTimerIds.clear()

    for (const off of knobCleanups) off()
    knobCleanups.length = 0

    for (const stutter of Object.values(channelStutter)) {
      if (stutter.source) {
        try { stutter.source.stop() } catch { /* already stopped */ }
        stutter.source = null
      }
    }

    resetAudio()

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
