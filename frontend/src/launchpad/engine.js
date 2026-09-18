// NOTE: stale: fades, masterLoopName,

import {
  initAudio,
  initAudioGainFilter,
  loadSound,
  createBufferSource,
  startSource,
  setGainValue,
  stopAllSources,
  sounds,
  soundToButton,
  audioCtx,
  rowGains,
  rowFilters,
} from './audio.js'
import { buttonRows, createKnob, setupKnobDrag, updateKnobVisual, updateStutterBtn, applyThemeColors, startProgressLoop } from './ui.js'

export function mountLaunchpad(container, themes) {
  // --- Closure-scoped state (one set per mount) ---
  let destroyed = false
  const pendingTimeouts = new Set()

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

  function cancelTrack(id) {
    pendingTimeouts.delete(id)
    clearTimeout(id)
  }

  function track(fn, ms) {
    const id = setTimeout(() => fn(), ms)
    pendingTimeouts.add(id)
    return id
  }

  function getNextStartTime(bufDuration) {
    if (!masterStartTime || !masterLoopDuration) {
      const now = audioCtx.currentTime
      return now + 0.1
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
      const name = `sound${i}`
      const id = `btn${i}`
      btn.addEventListener('touchend', (e) => {
        e.preventDefault()
        if (audioCtx.state === 'suspended') audioCtx.resume()
        toggleLoop(name, id)
      }, { passive: false })
      btn.onclick = () => toggleLoop(name, id)
    }
  }

  // --- Audio functions ---

  function cancelPending(row) {
    const pending = rowPending[row]
    if (!pending) return

    const sound = sounds[pending.name]
    if (sound?.startTimeoutId) {
      cancelTrack(sound.startTimeoutId)
      sound.startTimeoutId = null
    }
    if (sound?.source) {
      try { sound.source.stop() } catch { /* hasn't started yet */ }
      sound.source = null
    }

    const button = byId(pending.buttonId)
    if (button) button.classList.remove('blink', 'active')

    rowPending[row] = null
  }

  function startLoop(name, buttonId) {
    const sound = sounds[name]
    if (!sound) return

    const row = buttonRows[buttonId]
    const startTime = getNextStartTime(sound.buffer.duration)

    // Reset gain to clear stale ramps before starting the source
    const gain = rowGains[row]
    if (gain) {
      gain.gain.cancelScheduledValues(startTime)
      setGainValue(gain, rowVolumes[row], startTime)
    }

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(rowGains[row])
    startSource(source, startTime)

    const button = byId(buttonId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowActive[row] = { name, buttonId }

    sound.startTimeoutId = track(() => {
      if (destroyed || !sound.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!masterLoopName) masterLoopName = name
      sound.startTimeoutId = null
    }, ((startTime - audioCtx.currentTime) * 1000) | 0)
  }

  function stopLoop(name, force = false) {
    const sound = sounds[name]
    if (!sound) return

    const btnId = soundToButton[name]
    const button = btnId ? byId(btnId) : null
    const row = btnId ? buttonRows[btnId] : null

    if (sound.startTimeoutId) {
      cancelTrack(sound.startTimeoutId)
      sound.startTimeoutId = null
    }

    if (button) button.classList.remove('blink', 'active')
    if (row && rowActive[row]?.name === name) rowActive[row] = null
    if (masterLoopName === name) masterLoopName = null

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
        track(() => {
          try { src.stop() } catch { /* already stopped */ }
          if (!destroyed) setGainValue(rowGains[row], rowVolumes[row], audioCtx.currentTime)
        }, currentFadeTime * 1000 + 50)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          setGainValue(gain, rowVolumes[row], audioCtx.currentTime)
        }
        try { sound.source.stop() } catch { /* already stopped */ }
        sound.source = null
      }
    }
  }

  function scheduleHandoff(row, name, buttonId, handoffTime) {
    cancelPending(row)

    const sound = sounds[name]
    if (!sound) return

    const source = createBufferSource(sound.buffer, splitActive)
    source.connect(rowGains[row])
    startSource(source, handoffTime)

    sound.source = source

    const button = byId(buttonId)
    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    rowPending[row] = { name, buttonId, handoffTime }

    sound.startTimeoutId = track(() => {
      sound.startTimeoutId = null
      if (destroyed) return

      const outgoing = rowActive[row]
      if (outgoing) {
        const outSound = sounds[outgoing.name]
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

      rowActive[row] = { name, buttonId }
      rowPending[row] = null
      masterLoopName = name
    }, ((handoffTime - audioCtx.currentTime) * 1000) | 0)
  }

  function toggleLoop(name, buttonId) {
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const row = buttonRows[buttonId]

    if (rowStutter[row].mode !== 0) {
      const st = rowStutter[row]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      st.mode = 0
      const b = byId(`stutter-btn-${row}`)
      if (b) { b.textContent = 'STU'; b.classList.remove('stutter-active') }
    }

    const current = rowActive[row]
    const pending = rowPending[row]

    if (current && current.name === name) {
      cancelPending(row)
      stopLoop(current.name)
      return
    }

    if (pending && pending.name === name) {
      cancelPending(row)
      return
    }

    if (!current) {
      startLoop(name, buttonId)
      return
    }

    const bufDur = sounds[current.name]?.buffer.duration || 1
    const handoffTime = pending ? pending.handoffTime : getNextStartTime(bufDur)
    scheduleHandoff(row, name, buttonId, handoffTime)
  }

  function tapStutter(row) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const st = rowStutter[row]
    if (st.mode !== 0) {
      releaseStutter(row)
    } else {
      startStutter(row, st.depth)
      st.mode = st.depth
      updateStutterBtn(row, st.depth, st.mode)
    }
  }

  function releaseStutter(row) {
    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
    st.mode = 0

    const active = rowActive[row]
    if (active) startLoop(active.name, active.buttonId)

    updateStutterBtn(row, st.depth, st.mode)
  }

  function cycleStutterDepth(row) {
    const st = rowStutter[row]
    const idx = STUTTER_DEPTHS.indexOf(st.depth)
    st.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (st.mode !== 0) {
      const active = rowActive[row]
      const sound = active ? sounds[active.name] : null
      if (sound?.buffer && st.source) {
        const startTime = getNextStartTime(sound.buffer.duration)
        const bufDur = sound.buffer.duration / (splitActive ? 2 : 1)
        const loopLen = bufDur / st.depth

        try { st.source.stop(startTime) } catch { /* noop */ }

        const src = createBufferSource(sound.buffer, splitActive, loopLen)
        src.connect(rowGains[row])
        startSource(src, startTime)
        st.source = src
        st.mode = st.depth
      }
    }

    updateStutterBtn(row, st.depth, st.mode)
  }

  function startStutter(row, divisor) {
    const active = rowActive[row]
    if (!active) return
    const sound = sounds[active.name]
    if (!sound?.buffer) return

    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }

    const bufDur = sound.buffer.duration / (splitActive ? 2 : 1)
    const loopLen = bufDur / divisor
    const startTime = getNextStartTime(sound.buffer.duration)

    if (sound.source) { try { sound.source.stop(startTime) } catch { /* noop */ } sound.source = null }

    const src = createBufferSource(sound.buffer, splitActive, loopLen)
    src.connect(rowGains[row])
    startSource(src, startTime)
    st.source = src
  }

  // --- Theme sound loading ---
  async function loadThemeSounds(theme) {
    for (let r = 1; r <= 5; r++) {
      const st = rowStutter[r]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      st.mode = 0
      updateStutterBtn(r, st.depth, st.mode)
    }

    for (const name of Object.keys(sounds)) {
      if (sounds[name]?.source) stopLoop(name, true)
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
        const name = `sound${slot}`
        const id = `btn${slot}`
        return loadSound(name, url)
          .then(() => { soundToButton[name] = id })
          .finally(() => {
            const btn = byId(id)
            if (btn) btn.classList.remove('btn-loading')
          })
      })
    )

    if (destroyed) return

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
  byId('split-btn').onclick = () => {
    splitActive = !splitActive
    byId('split-btn').classList.toggle('active', splitActive)
    for (const r of Object.values(rowActive)) {
      if (r) {
        const sound = sounds[r.name]
        if (sound?.source) sound.source.loopEnd = sound.buffer.duration / (splitActive ? 2 : 1)
      }
    }
    if (masterLoopDuration) {
      masterLoopDuration = splitActive ? masterLoopDuration / 2 : masterLoopDuration * 2
    }
  }

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
      tapTimer = track(() => {
        if (tapCount === 1) cycleStutterDepth(row)
        else tapStutter(row)
        tapCount = 0
      }, 280)
    }
    btn.addEventListener('click', onTap)
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onTap() }, { passive: false })
  }

  // --- Knobs (VOL + filter) ---
  const volCol = byId('vol-knobs')
  const filterCol = byId('filter-knobs')
  for (let row = 1; row <= 5; row++) {
    const colorClass = `row-color-${row}`

    const volWrap = createKnob(`vol-wrap-${row}`, colorClass)
    volCol.appendChild(volWrap)
    let volVal = 100
    setupKnobDrag(volWrap, () => volVal, (v) => {
      volVal = v
      rowVolumes[row] = v / 100
      setGainValue(rowGains[row], v / 100, audioCtx.currentTime)
      updateKnobVisual(volWrap, v)
    })

    const filterWrap = createKnob(`filter-wrap-${row}`, colorClass)
    filterCol.appendChild(filterWrap)
    let filterVal = 100
    setupKnobDrag(filterWrap, () => filterVal, (v) => {
      filterVal = v
      rowFilters[row].frequency.setValueAtTime(200 * Math.pow(100, v / 100), audioCtx.currentTime)
      updateKnobVisual(filterWrap, v)
    })
  }

  // --- Progress bar ---
  let progressRAF = startProgressLoop(byId('master-bar-fill'), () => ({
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
    destroyed = true

    if (progressRAF) cancelAnimationFrame(progressRAF)

    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts.clear()

    stopAllSources()
    audioCtx.close().catch(() => {})

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
