import { createLifecycle } from './lifecycle.js'
import { createBuffers } from './audio/buffers.js'
import { createMixer } from './audio/mixer.js'
import { createClock } from './audio/clock.js'
import {
  ROWS,
  PADS,
  rowOfSlot,
  padId,
} from './slots.js'

export function mountLaunchpad(container, themes) {
  const lifecycle = createLifecycle()
  const mixer = createMixer()
  const clock = createClock(mixer)
  const buffers = createBuffers(mixer.context)

  const byId = (id) => container.querySelector(`#${id}`)

  // --- Config ---

  const STUTTER_DEPTHS = [4, 8, 16]
  // Single tap cycles the depth, double tap toggles the stutter itself, so
  // every tap waits this long to find out which it was.
  const STUTTER_TAP_MS = 280

  const KNOB_TRACK = 'M 10.69 33.31 A 16 16 0 1 1 33.31 33.31'

  // --- State ---

  // slot -> { buffer, source, startTimeoutId }
  const sounds = {}
  // DEAD (write-only): only ever .add()-ed in init's image preload, never read.
  // const preloadedImages = new Set()

  // row -> the slot currently sounding on it, or null
  const rowActive = { 1: null, 2: null, 3: null, 4: null, 5: null }
  // { slot, handoffTime } — a pad queued to take over a row once
  // the currently playing pad's loop ends. Re-targetable: clicking another
  // pad while one is already queued replaces the queued pad but reuses the
  // same handoffTime, since the outgoing source's stop() can't be rescheduled
  // once set.
  const rowPending = { 1: null, 2: null, 3: null, 4: null, 5: null }
  // `source` doubles as the on/off flag: a row is stuttering exactly when it
  // has a live stutter source. `depth` persists across toggles so re-enabling
  // a row resumes at the division it was last set to.
  const rowStutter = {
    1: { depth: 4, source: null },
    2: { depth: 4, source: null },
    3: { depth: 4, source: null },
    4: { depth: 4, source: null },
    5: { depth: 4, source: null },
  }

  // DEAD (write-only): assigned in startLoop/scheduleHandoff/loadThemeSounds
  // and cleared in stopLoop, but never read to drive any behaviour.
  // let masterLoopName = null

  // DEAD (unreachable): nothing ever sets a fade time, so every
  // `currentFadeTime > 0` branch below is unreachable. Kept for bookkeeping.
  // const currentFadeTime = 0

  let progressRAF = null

  // --- Timebase glue ---

  // The grid's bar length is seeded from the lowest loaded slot: integer keys
  // iterate in ascending numeric order, so this is slot order rather than the
  // decode order it was when `sounds` was keyed by name.
  const defaultLoopDuration = () => Object.values(sounds)[0]?.buffer?.duration || 1
  const nextStartTime = () => clock.nextStartTime(defaultLoopDuration())

  // SPLIT is two jobs: the clock rescales the grid, and every source already
  // playing has to be re-pointed at the new loop length.
  function applyLoopDivisor() {
    const divisor = clock.divisor()
    for (const slot of Object.values(rowActive)) {
      if (!slot) continue
      const sound = sounds[slot]
      if (sound?.source) sound.source.loopEnd = sound.source.buffer.duration / divisor
    }
  }

  function toggleSplit(enabled) {
    clock.setSplit(enabled)
    applyLoopDivisor()
  }

  // --- Voices: per-row loop state machine ---

  function startLoop(slot) {
    const sound = sounds[slot]
    if (!sound) return

    const source = mixer.createSource()
    source.buffer = sound.buffer
    source.loop = true
    source.loopEnd = sound.buffer.duration / clock.divisor()

    const row = rowOfSlot(slot)
    source.connect(mixer.rowInput(row))

    const startTime = nextStartTime()
    mixer.resetRowGain(row, startTime)

    // DEAD (unreachable): fade-in — see currentFadeTime
    // if (currentFadeTime > 0) {
    //   gain.gain.setValueAtTime(0, startTime)
    //   gain.gain.linearRampToValueAtTime(rowVolumes[row], startTime + currentFadeTime)
    // }

    setPadState(slot, 'queued')

    source.start(startTime)
    sound.source = source
    rowActive[row] = slot

    sound.startTimeoutId = lifecycle.track(() => {
      if (lifecycle.isDestroyed() || !sound.source) return
      setPadState(slot, 'playing')
      // DEAD (write-only): see masterLoopName
      // if (!masterLoopName) masterLoopName = slot
      sound.startTimeoutId = null
    }, (startTime - mixer.now()) * 1000)
  }

  // Cancels a row's queued handoff, if any. The queued source hasn't started
  // yet, so stopping it now is safe and simply means it never sounds.
  function cancelPending(row) {
    const pending = rowPending[row]
    if (!pending) return

    const sound = sounds[pending.slot]
    if (sound?.startTimeoutId) {
      lifecycle.cancel(sound.startTimeoutId)
      sound.startTimeoutId = null
    }
    if (sound?.source) {
      try { sound.source.stop() } catch { /* hasn't started yet */ }
      sound.source = null
    }

    setPadState(pending.slot, 'idle')

    rowPending[row] = null
  }

  // Queues `slot` to take over `row` at `handoffTime` — the moment the
  // currently playing pad's loop ends — instead of cutting it off now.
  function scheduleHandoff(row, slot, handoffTime) {
    cancelPending(row)

    const sound = sounds[slot]
    if (!sound) return

    const source = mixer.createSource()
    source.buffer = sound.buffer
    source.loop = true
    source.loopEnd = sound.buffer.duration / clock.divisor()
    source.connect(mixer.rowInput(row))
    source.start(handoffTime)
    sound.source = source

    setPadState(slot, 'queued')

    rowPending[row] = { slot, handoffTime }

    sound.startTimeoutId = lifecycle.track(() => {
      sound.startTimeoutId = null
      if (lifecycle.isDestroyed()) return

      const outgoing = rowActive[row]
      if (outgoing) {
        const outSound = sounds[outgoing]
        if (outSound?.source) {
          try { outSound.source.stop() } catch { /* already stopped */ }
          outSound.source = null
        }
        setPadState(outgoing, 'idle')
      }

      setPadState(slot, 'playing')

      rowActive[row] = slot
      rowPending[row] = null
      // DEAD (write-only): see masterLoopName
      // masterLoopName = slot
    }, (handoffTime - mixer.now()) * 1000)
  }

  // DEAD (no-op param): `force` only ever gated the unreachable fade-out
  // below, so passing it changes nothing. Kept for bookkeeping.
  function stopLoop(slot, force = false) {
    const sound = sounds[slot]
    if (!sound) return

    const row = rowOfSlot(slot)

    if (sound.startTimeoutId) {
      lifecycle.cancel(sound.startTimeoutId)
      sound.startTimeoutId = null
    }

    setPadState(slot, 'idle')
    if (rowActive[row] === slot) rowActive[row] = null
    // DEAD (write-only): see masterLoopName
    // if (masterLoopName === slot) masterLoopName = null

    const anyActive = Object.values(rowActive).some((a) => a !== null)
    if (!anyActive) clock.reset()

    if (sound.source) {
      mixer.resetRowGain(row, mixer.now())
      sound.source.stop()
      sound.source = null

      // DEAD (unreachable): fade-out — see currentFadeTime. This is also the
      // only place `force` was ever read, which is why it's a no-op.
      // if (!force && currentFadeTime > 0 && gain) {
      //   gain.gain.cancelScheduledValues(audioCtx.currentTime)
      //   gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime)
      //   gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + currentFadeTime)
      //   const src = sound.source
      //   sound.source = null
      //   track(() => {
      //     try { src.stop() } catch { /* already stopped */ }
      //     if (!destroyed) gain.gain.setValueAtTime(rowVolumes[row], audioCtx.currentTime)
      //   }, currentFadeTime * 1000 + 50)
      // }
    }
  }

  async function toggleLoop(slot) {
    if (mixer.state() === 'suspended') await mixer.resume()

    const row = rowOfSlot(slot)

    const st = rowStutter[row]
    if (st.source) {
      try { st.source.stop() } catch { /* noop */ }
      st.source = null
      updateStutterBtn(row)
    }

    const current = rowActive[row]
    const pending = rowPending[row]

    // Re-clicking whatever's currently sounding always stops the row,
    // even mid-handoff.
    if (current === slot) {
      cancelPending(row)
      stopLoop(slot)
      return
    }

    // Re-clicking the already-queued pad cancels the handoff and leaves
    // the currently sounding pad playing.
    if (pending?.slot === slot) {
      cancelPending(row)
      return
    }

    // Nothing playing in this row yet — start immediately, as before.
    if (!current) {
      startLoop(slot)
      return
    }

    // Something is already playing: let it ring out to its loop boundary
    // instead of cutting it off, and queue this pad to take over then. The
    // outgoing source's stop() is deliberately NOT scheduled here — it's
    // only ever called once, either when the handoff actually fires or when
    // it's cancelled via re-click — since stop() can't be called twice on
    // the same source. If a handoff is already queued, reuse its committed
    // handoffTime and just re-target which pad takes over.
    const handoffTime = pending ? pending.handoffTime : nextStartTime()
    scheduleHandoff(row, slot, handoffTime)
  }

  // Tears every row back to silence. Used before swapping themes, since none
  // of the current buffers survive the swap.
  function resetAllRows() {
    for (let r = 1; r <= ROWS; r++) {
      const st = rowStutter[r]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      updateStutterBtn(r)
    }

    // Object keys are strings even when they're slot numbers, and stopLoop
    // compares against rowActive with ===, so coerce before handing it over.
    for (const key of Object.keys(sounds)) {
      const slot = Number(key)
      if (sounds[slot]?.source) stopLoop(slot, true)
    }
    for (const key of Object.keys(sounds)) delete sounds[key]

    // DEAD (write-only): see masterLoopName
    // masterLoopName = null
    clock.reset()

    for (let r = 1; r <= ROWS; r++) {
      rowActive[r] = null
      rowPending[r] = null
    }
  }

  // --- Stutter ---

  function startStutter(row, divisor) {
    const slot = rowActive[row]
    if (!slot) return
    const sound = sounds[slot]
    if (!sound?.buffer) return

    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }

    const bufDur = sound.buffer.duration / clock.divisor()
    const loopLen = bufDur / divisor
    const startTime = nextStartTime()

    if (sound.source) { sound.source.stop(startTime); sound.source = null }

    const src = mixer.createSource()
    src.buffer = sound.buffer
    src.loop = true
    src.loopStart = 0
    src.loopEnd = loopLen
    src.connect(mixer.rowInput(row))
    src.start(startTime)
    st.source = src
  }

  function releaseStutter(row) {
    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }

    const slot = rowActive[row]
    if (slot) startLoop(slot)

    updateStutterBtn(row)
  }

  function tapStutter(row) {
    if (mixer.state() === 'suspended') mixer.resume()
    const st = rowStutter[row]
    if (st.source) {
      releaseStutter(row)
    } else {
      // startStutter is a no-op when the row has nothing playing; deriving the
      // lit state from st.source means the button stays dark in that case
      // instead of latching on with no sound behind it.
      startStutter(row, st.depth)
      updateStutterBtn(row)
    }
  }

  function cycleStutterDepth(row) {
    const st = rowStutter[row]
    const idx = STUTTER_DEPTHS.indexOf(st.depth)
    st.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (st.source) {
      const slot = rowActive[row]
      const sound = slot ? sounds[slot] : null
      if (sound?.buffer) {
        const startTime = nextStartTime()
        const bufDur = sound.buffer.duration / clock.divisor()
        const loopLen = bufDur / st.depth

        try { st.source.stop(startTime) } catch { /* noop */ }

        const src = mixer.createSource()
        src.buffer = sound.buffer
        src.loop = true
        src.loopStart = 0
        src.loopEnd = loopLen
        src.connect(mixer.rowInput(row))
        src.start(startTime)
        st.source = src
      }
    }

    updateStutterBtn(row)
  }

  // --- Theme ---

  function applyThemeColors(theme) {
    // --c1..--c5 (row colors) and --bg-top/--bg-bottom (the fallback body
    // gradient) are deliberately NOT set here — they're fixed in
    // launchpad.css's :root and shared by every theme, never overridden.
    // DEAD (never populated): the themes API serializes `bodyClass` from the
    // `body_class` column, but the seed never sets it and no CSS rule targets
    // a body class, so this is inert. Wired end-to-end, just unused.
    // themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
    // if (theme.bodyClass) document.body.classList.add(theme.bodyClass)

    document.body.style.backgroundImage = theme.bgImage ? `url('${theme.bgImage}')` : ''
  }

  // Resolves once the theme's background image is painted (or failed), so the
  // colors are applied before anything else is allowed to show.
  function preloadThemeImage(theme) {
    return new Promise((resolve) => {
      if (!theme.bgImage) { applyThemeColors(theme); resolve(); return }
      const img = new Image()
      // DEAD (write-only): was `preloadedImages.add(theme.bgImage)` here
      img.onload = () => { applyThemeColors(theme); resolve() }
      img.onerror = () => { applyThemeColors(theme); resolve() }
      img.src = theme.bgImage
    })
  }

  async function loadThemeSounds(theme) {
    resetAllRows()

    for (let slot = 1; slot <= PADS; slot++) setPadLoading(slot, true)

    await Promise.all(
      // The API keys these by slot, but as JSON they arrive as strings.
      Object.entries(theme.sounds).map(([key, url]) => {
        const slot = Number(key)
        return buffers.load(url)
          .then((buffer) => {
            sounds[slot] = { buffer, source: null, startTimeoutId: null }
            setPadLoading(slot, false)
          })
          .catch((err) => {
            // Without this the pad un-dims either way, so a sound that failed
            // to load is indistinguishable from one that worked until you
            // press it and get silence.
            console.warn(`Launchpad: could not load slot ${slot} from ${url}`, err)
            setPadLoading(slot, false)
          })
      })
    )
    if (lifecycle.isDestroyed()) return

    // No sound slots for this theme yet — clear the loading dim immediately.
    if (Object.keys(theme.sounds).length === 0) {
      for (let slot = 1; slot <= PADS; slot++) setPadLoading(slot, false)
    }
  }

  // --- UI: rendering ---

  function updateProgressBars() {
    if (lifecycle.isDestroyed()) return
    const fill = byId('master-bar-fill')
    const anyActive = Object.values(rowActive).some((a) => a !== null)
    const phase = clock.phase()

    if (fill && anyActive && phase !== null) {
      fill.style.width = phase * 100 + '%'
      fill.style.opacity = '1'
    } else if (fill) {
      fill.style.opacity = '0'
    }

    progressRAF = requestAnimationFrame(updateProgressBars)
  }

  // A pad is in exactly one play state: 'idle', 'queued' (started, waiting for
  // the next loop boundary) or 'playing'. The audio code reports which one;
  // how that looks is entirely this function's business.
  function setPadState(slot, state) {
    const btn = byId(padId(slot))
    if (!btn) return
    btn.classList.toggle('blink', state === 'queued')
    btn.classList.toggle('active', state === 'playing')
  }

  // Separate axis from play state: a pad can be dimmed for loading while the
  // outgoing theme's loop is still sounding on it.
  function setPadLoading(slot, loading) {
    const btn = byId(padId(slot))
    if (!btn) return
    btn.classList.toggle('btn-loading', loading)
  }

  function updateStutterBtn(row) {
    const st = rowStutter[row]
    const btn = byId(`stutter-btn-${row}`)
    if (!btn) return
    btn.textContent = `1/${st.depth}`
    btn.classList.toggle('stutter-active', st.source !== null)
  }

  // --- UI: knob helpers ---

  function knobAngleXY(angleDeg, r) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: +(22 + r * Math.sin(rad)).toFixed(2), y: +(22 - r * Math.cos(rad)).toFixed(2) }
  }

  function knobArcPath(value) {
    if (value <= 0) return ''
    const endDeg = -135 + (value / 100) * 270
    const s = knobAngleXY(-135, 16)
    const e = knobAngleXY(endDeg, 16)
    const large = (value / 100) * 270 > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A 16 16 0 ${large} 1 ${e.x} ${e.y}`
  }

  function updateKnobVisual(wrap, value) {
    const fill = wrap.querySelector('.knob-fill')
    const dot = wrap.querySelector('.knob-dot')
    if (fill) fill.setAttribute('d', knobArcPath(value))
    if (dot) {
      const p = knobAngleXY(-135 + (value / 100) * 270, 11)
      dot.setAttribute('cx', p.x)
      dot.setAttribute('cy', p.y)
    }
  }

  function createKnob(id, colorClass) {
    const wrap = document.createElement('div')
    wrap.className = `knob-wrap ${colorClass}`
    wrap.id = id
    const initDot = knobAngleXY(135, 11)
    wrap.innerHTML = `
      <svg class="knob-svg" viewBox="0 0 44 44">
        <circle class="knob-bg" cx="22" cy="22" r="20"/>
        <path class="knob-track" d="${KNOB_TRACK}"/>
        <path class="knob-fill" d="${KNOB_TRACK}"/>
        <circle class="knob-dot" cx="${initDot.x}" cy="${initDot.y}" r="2.5"/>
      </svg>`
    return wrap
  }

  function setupKnobDrag(wrap, getValue, setValue) {
    let dragging = false
    let startY = 0
    let startVal = 0

    lifecycle.on(wrap, 'mousedown', (e) => {
      dragging = true; startY = e.clientY; startVal = getValue()
      e.preventDefault()
    })
    lifecycle.on(window, 'mousemove', (e) => {
      if (!dragging) return
      setValue(Math.max(0, Math.min(100, startVal + (startY - e.clientY))))
    })
    lifecycle.on(window, 'mouseup', () => { dragging = false })

    lifecycle.on(wrap, 'touchstart', (e) => {
      dragging = true; startY = e.touches[0].clientY; startVal = getValue()
      e.preventDefault()
    }, { passive: false })
    lifecycle.on(window, 'touchmove', (e) => {
      if (!dragging) return
      setValue(Math.max(0, Math.min(100, startVal + (startY - e.touches[0].clientY))))
      e.preventDefault()
    }, { passive: false })
    lifecycle.on(window, 'touchend', () => { dragging = false })

    lifecycle.on(wrap, 'wheel', (e) => {
      e.preventDefault()
      setValue(Math.max(0, Math.min(100, getValue() + (e.deltaY < 0 ? 2 : -2))))
    }, { passive: false })
  }

  // --- UI: bindings & construction ---

  function bindPads() {
    for (let slot = 1; slot <= PADS; slot++) {
      const btn = byId(padId(slot))
      if (!btn) continue
      btn.addEventListener('touchend', (e) => {
        e.preventDefault()
        if (mixer.state() === 'suspended') mixer.resume()
        toggleLoop(slot)
      }, { passive: false })
      btn.onclick = () => toggleLoop(slot)
    }
  }

  function bindTransport() {
    const btn = byId('split-btn')
    btn.onclick = () => {
      toggleSplit(!clock.isSplit())
      btn.classList.toggle('active', clock.isSplit())
    }
  }

  function buildKnobs() {
    const volCol = byId('vol-knobs')
    const filterCol = byId('filter-knobs')

    for (let row = 1; row <= ROWS; row++) {
      const colorClass = `row-color-${row}`

      const volWrap = createKnob(`vol-wrap-${row}`, colorClass)
      volCol.appendChild(volWrap)
      let volVal = 100
      setupKnobDrag(volWrap, () => volVal, (v) => {
        volVal = v
        mixer.setVolume(row, v / 100)
        updateKnobVisual(volWrap, v)
      })

      const filterWrap = createKnob(`filter-wrap-${row}`, colorClass)
      filterCol.appendChild(filterWrap)
      let filterVal = 100
      setupKnobDrag(filterWrap, () => filterVal, (v) => {
        filterVal = v
        mixer.setCutoff(row, v / 100)
        updateKnobVisual(filterWrap, v)
      })
    }
  }

  function buildStutterButtons() {
    const stutterCol = byId('stutter-btns')
    for (let row = 1; row <= ROWS; row++) {
      let tapCount = 0
      let tapTimer = null
      const onTap = () => {
        if (mixer.state() === 'suspended') mixer.resume()
        tapCount++
        if (tapTimer) lifecycle.cancel(tapTimer)
        tapTimer = lifecycle.track(() => {
          if (tapCount === 1) cycleStutterDepth(row)
          else tapStutter(row)
          tapCount = 0
        }, STUTTER_TAP_MS)
      }

      const btn = document.createElement('button')
      btn.id = `stutter-btn-${row}`
      btn.className = 'stutter-btn'
      btn.addEventListener('click', onTap)
      btn.addEventListener('touchend', (e) => { e.preventDefault(); onTap() }, { passive: false })
      stutterCol.appendChild(btn)
      // Appended first so byId can find it — updateStutterBtn is the only
      // thing that writes the label, so there's no hardcoded default here.
      updateStutterBtn(row)
    }
  }

  // --- Init & destroy ---

  async function init() {
    try {
      mixer.build()

      if (themes.length === 0 || lifecycle.isDestroyed()) return

      // Everything that doesn't need decoded audio goes up front. The loading
      // overlay lifts on the theme image alone, so building these after the
      // sounds would reveal the grid with empty knob/stutter columns while
      // the (large) wavs are still downloading.
      bindPads()
      bindTransport()
      buildKnobs()
      buildStutterButtons()
      progressRAF = requestAnimationFrame(updateProgressBars)

      // Independent work: the image only touches <body>, the sounds only touch
      // the pads. Awaiting them in sequence made every wav wait on the jpg.
      await Promise.all([
        preloadThemeImage(themes[0]),
        loadThemeSounds(themes[0]),
      ])
    } catch (err) {
      console.error('Launchpad init error:', err)
    }
  }

  function destroy() {
    lifecycle.teardown()

    if (progressRAF) cancelAnimationFrame(progressRAF)

    for (const sound of Object.values(sounds)) {
      try { sound?.source?.stop() } catch { /* already stopped */ }
    }
    for (const row of Object.values(rowStutter)) {
      try { row.source?.stop() } catch { /* already stopped */ }
    }

    mixer.close()

    document.body.style.backgroundImage = ''
    // DEAD (never populated): see applyThemeColors
    // themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  init()

  return { destroy }
}
