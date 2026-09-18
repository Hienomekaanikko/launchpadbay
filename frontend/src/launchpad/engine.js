// NOTE: stale: fades, masterLoopName,

import {
  initAudio,
  initAudioGainFilter,
  loadSound,
  createBufferSource,
  resetAudio,
  sounds,
  soundToButton,
  audioCtx,
  rowGains,
  rowFilters,
} from './audio.js'
import {
	buttonRows,
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
    1: { mode: 0, depth: 4, source: null },
    2: { mode: 0, depth: 4, source: null },
    3: { mode: 0, depth: 4, source: null },
    4: { mode: 0, depth: 4, source: null },
    5: { mode: 0, depth: 4, source: null },
  }
  const STUTTER_DEPTHS = [4, 8, 16]

  let masterLoopName = null
  let masterStartTime = null
  let masterLoopDuration = null
  let splitActive = false
  let currentFadeTime = 0
  let rowVolumes = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }

  // --- Audio init ---
  initAudio()
  initAudioGainFilter([1, 2, 3, 4, 5])

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

  function getNextStartTime(bufDuration) {
    if (!masterStartTime || !masterLoopDuration) {
      const now = audioCtx.currentTime
      const futureStart = now + 0.1
      masterStartTime = futureStart
      masterLoopDuration = (bufDuration || 1) / (splitActive ? 2 : 1)
      return futureStart
    }
    const now = audioCtx.currentTime
    const elapsed = now - masterStartTime
    const bars = Math.floor(elapsed / masterLoopDuration)
    return masterStartTime + (bars + 1) * masterLoopDuration
  }

  // --- Pad event binding (LaunchpadView.jsx already renders .btn elements) ---
  function bindPadButtons() {
    for (let i = 1; i <= 25; i++) {
      const btn = byId(`btn${i}`)
      if (!btn) continue
      const soundName = `sound${i}`
      const id = `btn${i}`
      const onPad = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume()
        toggleLoop(soundName, id)
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

    const button = byId(pending.buttonId)
    if (button) button.classList.remove('blink', 'active')

    rowPending[row] = null
  }

  function startLoop(soundName, buttonId) {
    const sound = sounds[soundName]
    if (!sound) return

    const row = buttonRows[buttonId]
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

    const button = byId(buttonId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowActive[row] = { soundName, buttonId }

    const delayMs = ((startTime - audioCtx.currentTime) * 1000) | 0
    sound.startUiTimerId = trackUiTimer(() => {
      if (isTornDown || !sound.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!masterLoopName) masterLoopName = soundName
      sound.startUiTimerId = null
    }, delayMs)
  }

  function stopLoop(soundName, force = false) {
    const sound = sounds[soundName]
    if (!sound) return

    const btnId = soundToButton[soundName]
    const button = btnId ? byId(btnId) : null
    const row = btnId ? buttonRows[btnId] : null

    if (sound.startUiTimerId) {
      cancelUiTimer(sound.startUiTimerId)
      sound.startUiTimerId = null
    }

    if (button) button.classList.remove('blink', 'active')
    if (row && rowActive[row]?.soundName === soundName) rowActive[row] = null
    if (masterLoopName === soundName) masterLoopName = null

    const anyActive = Object.values(rowActive).some((a) => a !== null)
    if (!anyActive) {
      masterStartTime = null
      masterLoopDuration = null
    }

    if (sound.source) {
      const gain = row ? rowGains[row] : null
      if (!force && currentFadeTime > 0 && gain) {
        gain.gain.cancelScheduledValues(audioCtx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime)
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + currentFadeTime)
        const src = sound.source
        sound.source = null
        const delayMs = currentFadeTime * 1000 + 50
        trackUiTimer(() => {
          try { src.stop() } catch { /* already stopped */ }
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

  function scheduleHandoff(row, soundName, buttonId, handoffTime) {
    cancelPendingLoop(row)

    const sound = sounds[soundName]
    if (!sound) return

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(rowGains[row])
    source.start(handoffTime)

    sound.source = source

    const button = byId(buttonId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowPending[row] = { soundName, buttonId, handoffTime }

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
        const outButton = byId(outgoing.buttonId)
        if (outButton) outButton.classList.remove('blink', 'active')
      }

      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }

      rowActive[row] = { soundName, buttonId }
      rowPending[row] = null
      masterLoopName = soundName
    }, delayMs)
  }

  function toggleLoop(soundName, buttonId) {
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const row = buttonRows[buttonId]

    if (rowStutter[row].mode !== 0) {
      const st = rowStutter[row]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      st.mode = 0
      updateStutterBtn(byId, row, st.depth, st.mode)
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
      startLoop(soundName, buttonId)
      return
    }

    const bufDur = sounds[current.soundName]?.buffer.duration || 1
    const handoffTime = pending ? pending.handoffTime : getNextStartTime(bufDur)
    scheduleHandoff(row, soundName, buttonId, handoffTime)
  }

  function tapStutter(row) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const st = rowStutter[row]
    if (st.mode !== 0) {
      releaseStutter(row)
    } else {
      startStutter(row, st.depth)
      st.mode = st.depth
      updateStutterBtn(byId, row, st.depth, st.mode)
    }
  }

  function releaseStutter(row) {
    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
    st.mode = 0

    const active = rowActive[row]
    if (active) startLoop(active.soundName, active.buttonId)

    updateStutterBtn(byId, row, st.depth, st.mode)
  }

  function cycleStutterDepth(row) {
    const st = rowStutter[row]
    const idx = STUTTER_DEPTHS.indexOf(st.depth)
    st.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (st.mode !== 0) {
      const active = rowActive[row]
      const sound = active ? sounds[active.soundName] : null
      if (sound?.buffer && st.source) {
        const startTime = getNextStartTime(sound.buffer.duration)
        const bufDur = sound.buffer.duration / (splitActive ? 2 : 1)
        const loopLen = bufDur / st.depth

        try { st.source.stop(startTime) } catch { /* noop */ }

        const src = createBufferSource(sound.buffer, splitActive, loopLen)
        src.connect(rowGains[row])
        src.start(startTime)
        st.source = src
        st.mode = st.depth
      }
    }

    updateStutterBtn(byId, row, st.depth, st.mode)
  }

  function startStutter(row, divisor) {
    const active = rowActive[row]
    if (!active) return
    const sound = sounds[active.soundName]
    if (!sound?.buffer) return

    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }

    const bufDur = sound.buffer.duration / (splitActive ? 2 : 1)
    const loopLen = bufDur / divisor
    const startTime = getNextStartTime(sound.buffer.duration)

    if (sound.source) { try { sound.source.stop(startTime) } catch { /* noop */ } sound.source = null }

    const src = createBufferSource(sound.buffer, splitActive, loopLen)
    src.connect(rowGains[row])
    src.start(startTime)
    st.source = src
  }

  // --- Theme sound loading ---
  async function loadThemeSounds(theme) {
    for (let r = 1; r <= 5; r++) {
      const st = rowStutter[r]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      st.mode = 0
      updateStutterBtn(byId, r, st.depth, st.mode)
    }

    for (const soundName of Object.keys(sounds)) {
      if (sounds[soundName]?.source) stopLoop(soundName, true)
    }
    for (const key of Object.keys(sounds)) delete sounds[key]
    for (const key of Object.keys(soundToButton)) delete soundToButton[key]

    masterLoopName = null
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
        const id = `btn${slot}`
        return loadSound(soundName, url)
          .then(() => { soundToButton[soundName] = id })
          .finally(() => {
            const btn = byId(id)
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
  bindPadButtons()

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

    for (const st of Object.values(rowStutter)) {
      if (st.source) {
        try { st.source.stop() } catch { /* already stopped */ }
        st.source = null
      }
    }

    resetAudio()

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
