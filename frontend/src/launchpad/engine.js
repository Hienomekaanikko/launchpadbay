export function mountLaunchpad(container, themes) {
  let destroyed = false
  const winListeners = [] // { target, type, handler, opts }
  const pendingTimeouts = new Set()

  function on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts)
    winListeners.push({ target, type, handler, opts })
  }

  function track(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts.delete(id)
      fn()
    }, ms)
    pendingTimeouts.add(id)
    return id
  }

  const byId = (id) => container.querySelector(`#${id}`)

  let audioCtx = null
  const sounds = {}
  const soundToButton = {}

  const bufferCache = new Map()
  const preloadedImages = new Set()

  const buttonRows = {
    btn1: 1, btn2: 1, btn3: 1, btn4: 1, btn5: 1,
    btn6: 2, btn7: 2, btn8: 2, btn9: 2, btn10: 2,
    btn11: 3, btn12: 3, btn13: 3, btn14: 3, btn15: 3,
    btn16: 4, btn17: 4, btn18: 4, btn19: 4, btn20: 4,
    btn21: 5, btn22: 5, btn23: 5, btn24: 5, btn25: 5,
  }

  const rowActive = { 1: null, 2: null, 3: null, 4: null, 5: null }
  // { name, buttonId, handoffTime } — a pad queued to take over a row once
  // the currently playing pad's loop ends. Re-targetable: clicking another
  // pad while one is already queued replaces the queued pad but reuses the
  // same handoffTime, since the outgoing source's stop() can't be rescheduled
  // once set.
  const rowPending = { 1: null, 2: null, 3: null, 4: null, 5: null }
  const rowStutter = {
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

  const rowVolumes = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
  const currentFadeTime = 0

  const rowFilters = {}
  const rowGains = {}

  let progressRAF = null

  async function loadSound(name, url) {
    if (!bufferCache.has(url)) {
      const resp = await fetch(url)
      const raw = await resp.arrayBuffer()
      bufferCache.set(url, await audioCtx.decodeAudioData(raw))
    }
    sounds[name] = { buffer: bufferCache.get(url), source: null, startTimeoutId: null }
  }

  function getNextStartTime() {
    if (!masterStartTime || !masterLoopDuration) {
      const bufferDuration = Object.values(sounds)[0]?.buffer?.duration || 1
      const now = audioCtx.currentTime
      const futureStart = now + 0.1
      masterStartTime = futureStart
      masterLoopDuration = bufferDuration / (splitActive ? 2 : 1)
      return futureStart
    }
    const now = audioCtx.currentTime
    const elapsed = now - masterStartTime
    const bars = Math.floor(elapsed / masterLoopDuration)
    return masterStartTime + (bars + 1) * masterLoopDuration
  }

  function startLoop(name, buttonId) {
    const sound = sounds[name]
    if (!sound) return

    const source = audioCtx.createBufferSource()
    source.buffer = sound.buffer
    source.loop = true
    source.loopEnd = sound.buffer.duration / (splitActive ? 2 : 1)

    const row = buttonRows[buttonId]
    source.connect(rowGains[row])

    const button = byId(buttonId)
    const startTime = getNextStartTime()

    const gain = rowGains[row]
    gain.gain.cancelScheduledValues(startTime)
    if (currentFadeTime > 0) {
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(rowVolumes[row], startTime + currentFadeTime)
    } else {
      gain.gain.setValueAtTime(rowVolumes[row], startTime)
    }

    if (button) {
      button.classList.remove('active')
      button.classList.add('blink')
    }

    source.start(startTime)
    sound.source = source
    rowActive[row] = { name, buttonId }

    sound.startTimeoutId = track(() => {
      if (destroyed || !sound.source) return
      if (button) {
        button.classList.remove('blink')
        button.classList.add('active')
      }
      if (!masterLoopName) masterLoopName = name
      sound.startTimeoutId = null
    }, (startTime - audioCtx.currentTime) * 1000)
  }

  // Cancels a row's queued handoff, if any. The queued source hasn't started
  // yet, so stopping it now is safe and simply means it never sounds.
  function cancelPending(row) {
    const pending = rowPending[row]
    if (!pending) return

    const sound = sounds[pending.name]
    if (sound?.startTimeoutId) {
      clearTimeout(sound.startTimeoutId)
      pendingTimeouts.delete(sound.startTimeoutId)
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

  // Queues `name` to take over `row` at `handoffTime` — the moment the
  // currently playing pad's loop ends — instead of cutting it off now.
  function scheduleHandoff(row, name, buttonId, handoffTime) {
    cancelPending(row)

    const sound = sounds[name]
    if (!sound) return

    const source = audioCtx.createBufferSource()
    source.buffer = sound.buffer
    source.loop = true
    source.loopEnd = sound.buffer.duration / (splitActive ? 2 : 1)
    source.connect(rowGains[row])
    source.start(handoffTime)
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
    }, (handoffTime - audioCtx.currentTime) * 1000)
  }

  function stopLoop(name, force = false) {
    const sound = sounds[name]
    if (!sound) return

    const btnId = soundToButton[name]
    const button = btnId ? byId(btnId) : null
    const row = btnId ? buttonRows[btnId] : null

    if (sound.startTimeoutId) {
      clearTimeout(sound.startTimeoutId)
      pendingTimeouts.delete(sound.startTimeoutId)
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
          if (!destroyed) gain.gain.setValueAtTime(rowVolumes[row], audioCtx.currentTime)
        }, currentFadeTime * 1000 + 50)
      } else {
        if (gain) {
          gain.gain.cancelScheduledValues(audioCtx.currentTime)
          gain.gain.setValueAtTime(rowVolumes[row], audioCtx.currentTime)
        }
        sound.source.stop()
        sound.source = null
      }
    }
  }

  async function toggleLoop(name, buttonId) {
    if (audioCtx.state === 'suspended') await audioCtx.resume()

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

    // Re-clicking whatever's currently sounding always stops the row,
    // even mid-handoff.
    if (current && current.name === name) {
      cancelPending(row)
      stopLoop(current.name)
      return
    }

    // Re-clicking the already-queued pad cancels the handoff and leaves
    // the currently sounding pad playing.
    if (pending && pending.name === name) {
      cancelPending(row)
      return
    }

    // Nothing playing in this row yet — start immediately, as before.
    if (!current) {
      startLoop(name, buttonId)
      return
    }

    // Something is already playing: let it ring out to its loop boundary
    // instead of cutting it off, and queue this pad to take over then. The
    // outgoing source's stop() is deliberately NOT scheduled here — it's
    // only ever called once, either when the handoff actually fires or when
    // it's cancelled via re-click — since stop() can't be called twice on
    // the same source. If a handoff is already queued, reuse its committed
    // handoffTime and just re-target which pad takes over.
    const handoffTime = pending ? pending.handoffTime : getNextStartTime()
    scheduleHandoff(row, name, buttonId, handoffTime)
  }

  function updateProgressBars() {
    if (destroyed) return
    const fill = byId('master-bar-fill')
    const anyActive = Object.values(rowActive).some((a) => a !== null)

    if (fill && anyActive && masterStartTime && masterLoopDuration) {
      const now = audioCtx.currentTime
      const elapsed = Math.max(0, (now - masterStartTime) % masterLoopDuration)
      fill.style.width = (elapsed / masterLoopDuration) * 100 + '%'
      fill.style.opacity = '1'
    } else if (fill) {
      fill.style.opacity = '0'
    }

    progressRAF = requestAnimationFrame(updateProgressBars)
  }

  function applyThemeColors(theme) {
    // --c1..--c5 (row colors) and --bg-top/--bg-bottom (the fallback body
    // gradient) are deliberately NOT set here — they're fixed in
    // launchpad.css's :root and shared by every theme, never overridden.
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
    if (theme.bodyClass) document.body.classList.add(theme.bodyClass)

    document.body.style.backgroundImage = theme.bgImage ? `url('${theme.bgImage}')` : ''
  }

  async function loadThemeSounds(theme) {
    for (let r = 1; r <= 5; r++) {
      const st = rowStutter[r]
      if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
      st.mode = 0
      const btn = byId(`stutter-btn-${r}`)
      if (btn) { btn.textContent = 'STU'; btn.classList.remove('stutter-active') }
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
          .then(() => {
            soundToButton[name] = id
            const btn = byId(id)
            if (btn) btn.classList.remove('btn-loading')
          })
          .catch(() => {
            const btn = byId(id)
            if (btn) btn.classList.remove('btn-loading')
          })
      })
    )
    if (destroyed) return

    // No sound slots for this theme yet — clear the loading dim immediately.
    if (Object.keys(theme.sounds).length === 0) {
      for (let i = 1; i <= 25; i++) {
        const btn = byId(`btn${i}`)
        if (btn) btn.classList.remove('btn-loading')
      }
    }
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
    const startTime = getNextStartTime()

    if (sound.source) { sound.source.stop(startTime); sound.source = null }

    const src = audioCtx.createBufferSource()
    src.buffer = sound.buffer
    src.loop = true
    src.loopStart = 0
    src.loopEnd = loopLen
    src.connect(rowGains[row])
    src.start(startTime)
    st.source = src
  }

  function releaseStutter(row) {
    const st = rowStutter[row]
    if (st.source) { try { st.source.stop() } catch { /* noop */ } st.source = null }
    st.mode = 0

    const active = rowActive[row]
    if (active) startLoop(active.name, active.buttonId)

    updateStutterBtn(row)
  }

  function updateStutterBtn(row) {
    const st = rowStutter[row]
    const btn = byId(`stutter-btn-${row}`)
    if (!btn) return
    btn.textContent = `1/${st.depth}`
    btn.classList.toggle('stutter-active', st.mode !== 0)
  }

  function tapStutter(row) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const st = rowStutter[row]
    if (st.mode !== 0) {
      releaseStutter(row)
    } else {
      startStutter(row, st.depth)
      st.mode = st.depth
      updateStutterBtn(row)
    }
  }

  function cycleStutterDepth(row) {
    const st = rowStutter[row]
    const idx = STUTTER_DEPTHS.indexOf(st.depth)
    st.depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]

    if (st.mode !== 0) {
      const active = rowActive[row]
      const sound = active ? sounds[active.name] : null
      if (sound?.buffer && st.source) {
        const startTime = getNextStartTime()
        const bufDur = sound.buffer.duration / (splitActive ? 2 : 1)
        const loopLen = bufDur / st.depth

        try { st.source.stop(startTime) } catch { /* noop */ }

        const src = audioCtx.createBufferSource()
        src.buffer = sound.buffer
        src.loop = true
        src.loopStart = 0
        src.loopEnd = loopLen
        src.connect(rowGains[row])
        src.start(startTime)
        st.source = src
        st.mode = st.depth
      }
    }

    updateStutterBtn(row)
  }

  async function init() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      for (let r = 1; r <= 5; r++) {
        const f = audioCtx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 20000
        f.Q.value = 0.5
        f.connect(audioCtx.destination)
        rowFilters[r] = f
        const g = audioCtx.createGain()
        g.connect(rowFilters[r])
        rowGains[r] = g
      }

      if (themes.length === 0 || destroyed) return

      // Bind pad buttons
      for (let i = 1; i <= 25; i++) {
        const name = `sound${i}`
        const id = `btn${i}`
        const btn = byId(id)
        if (!btn) continue
        btn.addEventListener('touchend', (e) => {
          e.preventDefault()
          if (audioCtx.state === 'suspended') audioCtx.resume()
          toggleLoop(name, id)
        }, { passive: false })
        btn.onclick = () => toggleLoop(name, id)
      }

      byId('split-btn').onclick = () => {
        splitActive = !splitActive
        byId('split-btn').classList.toggle('active', splitActive)
        const divisor = splitActive ? 2 : 1
        for (const row of Object.values(rowActive)) {
          if (row) {
            const sound = sounds[row.name]
            if (sound?.source) sound.source.loopEnd = sound.source.buffer.duration / divisor
          }
        }
        if (masterLoopDuration) {
          masterLoopDuration = splitActive ? masterLoopDuration / 2 : masterLoopDuration * 2
        }
      }

      await new Promise((resolve) => {
        if (!themes[0].bgImage) { applyThemeColors(themes[0]); resolve(); return }
        const img = new Image()
        img.onload = () => { preloadedImages.add(themes[0].bgImage); applyThemeColors(themes[0]); resolve() }
        img.onerror = () => { applyThemeColors(themes[0]); resolve() }
        img.src = themes[0].bgImage
      })
      if (destroyed) return
      await loadThemeSounds(themes[0])
      if (destroyed) return

      // --- Knob helpers ---
      const KNOB_TRACK = 'M 10.69 33.31 A 16 16 0 1 1 33.31 33.31'

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

        on(wrap, 'mousedown', (e) => {
          dragging = true; startY = e.clientY; startVal = getValue()
          e.preventDefault()
        })
        on(window, 'mousemove', (e) => {
          if (!dragging) return
          setValue(Math.max(0, Math.min(100, startVal + (startY - e.clientY))))
        })
        on(window, 'mouseup', () => { dragging = false })

        on(wrap, 'touchstart', (e) => {
          dragging = true; startY = e.touches[0].clientY; startVal = getValue()
          e.preventDefault()
        }, { passive: false })
        on(window, 'touchmove', (e) => {
          if (!dragging) return
          setValue(Math.max(0, Math.min(100, startVal + (startY - e.touches[0].clientY))))
          e.preventDefault()
        }, { passive: false })
        on(window, 'touchend', () => { dragging = false })

        on(wrap, 'wheel', (e) => {
          e.preventDefault()
          setValue(Math.max(0, Math.min(100, getValue() + (e.deltaY < 0 ? 2 : -2))))
        }, { passive: false })
      }

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
          rowGains[row].gain.setValueAtTime(v / 100, audioCtx.currentTime)
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

      const stutterCol = byId('stutter-btns')
      for (let row = 1; row <= 5; row++) {
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

        const btn = document.createElement('button')
        btn.id = `stutter-btn-${row}`
        btn.className = 'stutter-btn'
        btn.textContent = '1/4'
        btn.addEventListener('click', onTap)
        btn.addEventListener('touchend', (e) => { e.preventDefault(); onTap() }, { passive: false })
        stutterCol.appendChild(btn)
      }

      progressRAF = requestAnimationFrame(updateProgressBars)
    } catch (err) {
      console.error('Launchpad init error:', err)
    }
  }

  init()

  function destroy() {
    destroyed = true

    if (progressRAF) cancelAnimationFrame(progressRAF)

    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts.clear()

    for (const { target, type, handler, opts } of winListeners) {
      target.removeEventListener(type, handler, opts)
    }
    winListeners.length = 0

    for (const name of Object.keys(sounds)) {
      try { sounds[name]?.source?.stop() } catch { /* already stopped */ }
    }
    for (const row of Object.values(rowStutter)) {
      try { row.source?.stop() } catch { /* already stopped */ }
    }

    audioCtx?.close().catch(() => {})

    document.body.style.backgroundImage = ''
    themes.forEach((t) => t.bodyClass && document.body.classList.remove(t.bodyClass))
  }

  return { destroy }
}
