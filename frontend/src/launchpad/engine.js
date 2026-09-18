// NOTE: stale: fades, masterSoundName,

import {
  initAudio,
  initRowGainFilters,
  loadSound,
  createBufferSource,
  resetAudio,
  sounds,
  soundToPad,
  audioCtx,
  rowGains,
  rowFilters,
} from './audio.js'
import {
	padRows,
	createKnob,
	setupKnobDrag,
	updateKnobVisual,
	updateStutterBtn,
	applyThemeColors,
	startProgressLoop
} from './ui.js'

export function mountLaunchpad(container, themes) {
  // Timing: master* / handoff* / startTime = AudioContext seconds (musical).
  // uiTimer* = setTimeout for DOM/gesture only (not the musical source of truth).
  let isTornDown = false
  const uiTimerIds = new Set()

  let rowActive = { 1: null, 2: null, 3: null, 4: null, 5: null }
  let rowPending = { 1: null, 2: null, 3: null, 4: null, 5: null }
  let rowStutter = {
    1: { activeDepth: 0, depth: 4, source: null },
    2: { activeDepth: 0, depth: 4, source: null },
    3: { activeDepth: 0, depth: 4, source: null },
    4: { activeDepth: 0, depth: 4, source: null },
    5: { activeDepth: 0, depth: 4, source: null },
  }
  const STUTTER_DEPTHS = [4, 8, 16]

  let masterSoundName = null
  let masterStartTime = null
  let masterLoopDuration = null
  let splitActive = false
  let currentFadeTime = 0
  let rowVolumes = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }

  // --- Audio init ---
  initAudio()
  initRowGainFilters([1, 2, 3, 4, 5])

  // --- Container-scoped helpers ---
  const byId = (id) => container.querySelector(`#${id}`)

  function cancelUiTimer(id) {
    uiTimerIds.delete(id)
    clearTimeout(id)
  }

  function trackUiTimer(fn, delayMs) {
    const id = setTimeout(() => fn(), delayMs)
    uiTimerIds.add(id)
    return id
  }

  function getNextStartTime(bufferDurationSec) {
    if (!masterStartTime || !masterLoopDuration) {
      const now = audioCtx.currentTime
      const futureStart = now + 0.1
      masterStartTime = futureStart
      masterLoopDuration = (bufferDurationSec || 1) / (splitActive ? 2 : 1)
      return futureStart
    }
    const now = audioCtx.currentTime
    const elapsed = now - masterStartTime
    const completedBars = Math.floor(elapsed / masterLoopDuration)
    return masterStartTime + (completedBars + 1) * masterLoopDuration
  }

  // --- Pad event binding (LaunchpadView.jsx already renders .btn elements) ---
  function bindPads() {
    for (let i = 1; i <= 25; i++) {
      const btn = byId(`btn${i}`)
      if (!btn) continue
      const soundName = `sound${i}`
      const padId = `btn${i}`
      const onPad = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume()
        toggleLoop(soundName, padId)
      }
      btn.addEventListener('click', onPad)
      btn.addEventListener('touchend', (e) => { e.preventDefault(); onPad() }, { passive: false })
    }
  }

  // --- Audio functions ---

  function cancelPendingLoop(row) {
    const pending = rowPending[row]
    if (!pending) return

    const sound = sounds[pending.soundName]
    if (sound?.startUiTimerId) {
      cancelUiTimer(sound.startUiTimerId)
      sound.startUiTimerId = null
    }
    if (sound?.source) {
      try { sound.source.stop() } catch { /* hasn't started yet */ }
      sound.source = null
    }

    const button = byId(pending.padId)
    if (button) button.classList.remove('blink', 'active')

    rowPending[row] = null
  }

  function startLoop(soundName, padId) {
    const sound = sounds[soundName]
    if (!sound) return

    const row = padRows[padId]
    const startTime = getNextStartTime(sound.buffer.duration)

    // Reset gain to clear stale ramps before starting the source
    const gain = rowGains[row]
    if (gain) {
      gain.gain.cancelScheduledValues(startTime)
      gain.gain.setValueAtTime(rowVolumes[row], startTime)
    }

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(rowGains[row])
    source.start(startTime)
    sound.source = source

    const button = byId(padId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowActive[row] = { soundName, padId }

    const delayMs = ((startTime - audioCtx.currentTime) * 1000) | 0
    sound.startUiTimerId = trackUiTimer(() => {
      if (isTornDown || !sound.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!masterSoundName) masterSoundName = soundName
      sound.startUiTimerId = null
    }, delayMs)
  }

  function stopLoop(soundName, skipFade = false) {
    const sound = sounds[soundName]
    if (!sound) return

    const padId = soundToPad[soundName]
    const button = padId ? byId(padId) : null
    const row = padId ? padRows[padId] : null

    if (sound.startUiTimerId) {
      cancelUiTimer(sound.startUiTimerId)
      sound.startUiTimerId = null
    }

    if (button) button.classList.remove('blink', 'active')
    if (row && rowActive[row]?.soundName === soundName) rowActive[row] = null
    if (masterSoundName === soundName) masterSoundName = null

    const anyActive = Object.values(rowActive).some((a) => a !== null)
    if (!anyActive) {
      masterStartTime = null
      masterLoopDuration = null
    }

    if (sound.source) {
      const gain = row ? rowGains[row] : null
      if (!skipFade && currentFadeTime > 0 && gain) {
        gain.gain.cancelScheduledValues(audioCtx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime)
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + currentFadeTime)
        const source = sound.source
        sound.source = null
        const delayMs = currentFadeTime * 1000 + 50
        trackUiTimer(() => {
          try { source.stop() } catch { /* already stopped */ }
          if (!isTornDown) rowGains[row].gain.setValueAtTime(rowVolumes[row], audioCtx.currentTime)
        }, delayMs)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(rowVolumes[row], audioCtx.currentTime)
        }
        try { sound.source.stop() } catch { /* already stopped */ }
        sound.source = null
      }
    }
  }

  function scheduleHandoff(row, soundName, padId, handoffTime) {
    cancelPendingLoop(row)

    const sound = sounds[soundName]
    if (!sound) return

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(rowGains[row])
    source.start(handoffTime)

    sound.source = source

    const button = byId(padId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowPending[row] = { soundName, padId, handoffTime }

    const delayMs = ((handoffTime - audioCtx.currentTime) * 1000) | 0
    sound.startUiTimerId = trackUiTimer(() => {
      sound.startUiTimerId = null
      if (isTornDown) return

      const outgoing = rowActive[row]
      if (outgoing) {
        const outSound = sounds[outgoing.soundName]
        if (outSound?.source) {
          try { outSound.source.stop() } catch { /* already stopped */ }
          outSound.source = null
        }
        const outButton = byId(outgoing.padId)
        if (outButton) outButton.classList.remove('blink', 'active')
      }

      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }

      rowActive[row] = { soundName, padId }
      rowPending[row] = null
      masterSoundName = soundName
    }, delayMs)
  }

  function toggleLoop(soundName, padId) {
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const row = padRows[padId]

    if (rowStutter[row].activeDepth !== 0) {
      const stutter = rowStutter[row]
      if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
      stutter.activeDepth = 0
      updateStutterBtn(byId, row, stutter.depth, stutter.activeDepth)
    }

    const current = rowActive[row]
    const pending = rowPending[row]

    if (current && current.soundName === soundName) {
      cancelPendingLoop(row)
      stopLoop(current.soundName)
      return
    }

    if (pending && pending.soundName === soundName) {
      cancelPendingLoop(row)
      return
    }

    if (!current) {
      startLoop(soundName, padId)
      return
    }

    const bufferDurationSec = sounds[current.soundName]?.buffer.duration || 1
    const handoffTime = pending ? pending.handoffTime : getNextStartTime(bufferDurationSec)
    scheduleHandoff(row, soundName, padId, handoffTime)
  }

  function tapStutter(row) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const stutter = rowStutter[row]
    if (stutter.activeDepth !== 0) {
      releaseStutter(row)
    } else {
      startStutter(row, stutter.depth)
      stutter.activeDepth = stutter.depth
      updateStutterBtn(byId, row, stutter.depth, stutter.activeDepth)
    }
  }

  function releaseStutter(row) {
    const stutter = rowStutter[row]
    if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
    stutter.activeDepth = 0

    const active = rowActive[row]
    if (active) startLoop(active.soundName, active.padId)

    updateStutterBtn(byId, row, stutter.depth, stutter.activeDepth)
  }

  function cycleStutterDepth(row) {
    const stutter = rowStutter[row]
    const idx = STUTTER_DEPTHS.indexOf(stutter.depth)
    stutter.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (stutter.activeDepth !== 0) {
      const active = rowActive[row]
      const sound = active ? sounds[active.soundName] : null
      if (sound?.buffer && stutter.source) {
        const startTime = getNextStartTime(sound.buffer.duration)
        const bufferDurationSec = sound.buffer.duration / (splitActive ? 2 : 1)
        const stutterLoopSec = bufferDurationSec / stutter.depth

        try { stutter.source.stop(startTime) } catch { /* noop */ }

        const source = createBufferSource(sound.buffer, splitActive, stutterLoopSec)
        source.connect(rowGains[row])
        source.start(startTime)
        stutter.source = source
        stutter.activeDepth = stutter.depth
      }
    }

    updateStutterBtn(byId, row, stutter.depth, stutter.activeDepth)
  }

  function startStutter(row, stutterDepth) {
    const active = rowActive[row]
    if (!active) return
    const sound = sounds[active.soundName]
    if (!sound?.buffer) return

    const stutter = rowStutter[row]
    if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }

    const bufferDurationSec = sound.buffer.duration / (splitActive ? 2 : 1)
    const stutterLoopSec = bufferDurationSec / stutterDepth
    const startTime = getNextStartTime(sound.buffer.duration)

    if (sound.source) { try { sound.source.stop(startTime) } catch { /* noop */ } sound.source = null }

    const source = createBufferSource(sound.buffer, splitActive, stutterLoopSec)
    source.connect(rowGains[row])
    source.start(startTime)
    stutter.source = source
  }

  // --- Theme sound loading ---
  async function loadThemeSounds(theme) {
    for (let r = 1; r <= 5; r++) {
      const stutter = rowStutter[r]
      if (stutter.source) { try { stutter.source.stop() } catch { /* noop */ } stutter.source = null }
      stutter.activeDepth = 0
      updateStutterBtn(byId, r, stutter.depth, stutter.activeDepth)
    }

    for (const soundName of Object.keys(sounds)) {
      if (sounds[soundName]?.source) stopLoop(soundName, true)
    }
    for (const key of Object.keys(sounds)) delete sounds[key]
    for (const key of Object.keys(soundToPad)) delete soundToPad[key]

    masterSoundName = null
    masterStartTime = null
    masterLoopDuration = null

    for (let r = 1; r <= 5; r++) {
      rowActive[r] = null
      rowPending[r] = null
    }

    for (let i = 1; i <= 25; i++) {
      const btn = byId(`btn${i}`)
      if (btn) btn.classList.add('btn-loading')
    }

    await Promise.all(
      Object.entries(theme.sounds).map(([slot, url]) => {
        const soundName = `sound${slot}`
        const padId = `btn${slot}`
        return loadSound(soundName, url)
          .then(() => { soundToPad[soundName] = padId })
          .finally(() => {
            const btn = byId(padId)
            if (btn) btn.classList.remove('btn-loading')
          })
      })
    )

    if (isTornDown) return

    if (Object.keys(theme.sounds).length === 0) {
      for (let i = 1; i <= 25; i++) {
        const btn = byId(`btn${i}`)
        if (btn) btn.classList.remove('btn-loading')
      }
    }
  }

  // --- UI init ---
  applyThemeColors(themes[0])

  // --- Split button ---
  const splitBtn = byId('split-btn')
  const onSplit = () => {
    splitActive = !splitActive
    splitBtn.classList.toggle('active', splitActive)
    for (const r of Object.values(rowActive)) {
      if (r) {
        const sound = sounds[r.soundName]
        if (sound?.source) sound.source.loopEnd = sound.buffer.duration / (splitActive ? 2 : 1)
      }
    }
    if (masterLoopDuration) {
      masterLoopDuration = splitActive ? masterLoopDuration / 2 : masterLoopDuration * 2
    }
  }
  splitBtn.addEventListener('click', onSplit)
  splitBtn.addEventListener('touchend', (e) => { e.preventDefault(); onSplit() }, { passive: false })

  // --- Stutter buttons (double-tap: single=cycle depth, double=toggle) ---
  const stutterCol = byId('stutter-btns')
  for (let row = 1; row <= 5; row++) {
    const btn = document.createElement('button')
    btn.id = `stutter-btn-${row}`
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
        if (tapCount === 1) cycleStutterDepth(row)
        else tapStutter(row)
        tapCount = 0
      }, 280)
    }
    btn.addEventListener('click', onTap)
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onTap() }, { passive: false })
  }

  // --- Knobs (VOL + filter) ---
  const knobCleanups = []
  const volCol = byId('vol-knobs')
  const filterCol = byId('filter-knobs')
  for (let row = 1; row <= 5; row++) {
    const colorClass = `row-color-${row}`

    const volWrap = createKnob(`vol-wrap-${row}`, colorClass)
    volCol.appendChild(volWrap)
    let volVal = 100
    knobCleanups.push(setupKnobDrag(volWrap, () => volVal, (v) => {
      volVal = v
      rowVolumes[row] = v / 100
      rowGains[row].gain.setValueAtTime(v / 100, audioCtx.currentTime)
      updateKnobVisual(volWrap, v)
    }))

    const filterWrap = createKnob(`filter-wrap-${row}`, colorClass)
    filterCol.appendChild(filterWrap)
    let filterVal = 100
    knobCleanups.push(setupKnobDrag(filterWrap, () => filterVal, (v) => {
      filterVal = v
      rowFilters[row].frequency.setValueAtTime(200 * Math.pow(100, v / 100), audioCtx.currentTime)
      updateKnobVisual(filterWrap, v)
    }))
  }

  // --- Progress bar ---
  const stopProgress = startProgressLoop(byId('master-bar-fill'), () => ({
    now: audioCtx.currentTime,
    masterStartTime,
    masterLoopDuration,
  }))

  // --- Pad binding & sound loading ---
  bindPads()

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

    for (const stutter of Object.values(rowStutter)) {
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
