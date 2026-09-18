export const padRows = {
  btn1: 1, btn2: 1, btn3: 1, btn4: 1, btn5: 1,
  btn6: 2, btn7: 2, btn8: 2, btn9: 2, btn10: 2,
  btn11: 3, btn12: 3, btn13: 3, btn14: 3, btn15: 3,
  btn16: 4, btn17: 4, btn18: 4, btn19: 4, btn20: 4,
  btn21: 5, btn22: 5, btn23: 5, btn24: 5, btn25: 5,
}

export function createKnob(id, colorClass) {
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

export function updateKnobVisual(wrap, value) {
  const fill = wrap.querySelector('.knob-fill')
  const dot = wrap.querySelector('.knob-dot')
  if (fill) fill.setAttribute('d', knobArcPath(value))
  if (dot) {
    const p = knobAngleXY(-135 + (value / 100) * 270, 11)
    dot.setAttribute('cx', p.x)
    dot.setAttribute('cy', p.y)
  }
}

export function setupKnobDrag(wrap, getValue, setValue) {
  let dragging = false
  let startY = 0
  let startVal = 0
  const cleanups = []

  function listen(target, type, handler, opts) {
    target.addEventListener(type, handler, opts)
    cleanups.push(() => target.removeEventListener(type, handler, opts))
  }

  listen(wrap, 'mousedown', (e) => {
    dragging = true; startY = e.clientY; startVal = getValue()
    e.preventDefault()
  })
  listen(window, 'mousemove', (e) => {
    if (!dragging) return
    setValue(Math.max(0, Math.min(100, startVal + (startY - e.clientY))))
  })
  listen(window, 'mouseup', () => { dragging = false })

  listen(wrap, 'touchstart', (e) => {
    dragging = true; startY = e.touches[0].clientY; startVal = getValue()
    e.preventDefault()
  }, { passive: false })
  listen(window, 'touchmove', (e) => {
    if (!dragging) return
    setValue(Math.max(0, Math.min(100, startVal + (startY - e.touches[0].clientY))))
    e.preventDefault()
  }, { passive: false })
  listen(window, 'touchend', () => { dragging = false })

  listen(wrap, 'wheel', (e) => {
    e.preventDefault()
    setValue(Math.max(0, Math.min(100, getValue() + (e.deltaY < 0 ? 2 : -2))))
  }, { passive: false })

  return () => {
    for (const off of cleanups) off()
    cleanups.length = 0
  }
}

export function updateStutterBtn(byId, row, depth, activeDepth) {
  const btn = byId(`stutter-btn-${row}`)
  if (!btn) return
  btn.textContent = `1/${depth}`
  btn.classList.toggle('stutter-active', activeDepth !== 0)
}

export function applyThemeColors(theme) {
  document.body.style.backgroundImage = theme.bgImage ? `url('${theme.bgImage}')` : ''
}

function updateProgressBar(fillElement, now, masterStartTime, masterLoopDuration) {
  if (!fillElement) return
  if (masterStartTime != null && masterLoopDuration != null) {
    const elapsed = Math.max(0, (now - masterStartTime) % masterLoopDuration)
    fillElement.style.width = (elapsed / masterLoopDuration) * 100 + '%'
    fillElement.style.opacity = '1'
  } else {
    fillElement.style.opacity = '0'
  }
}

export function startProgressLoop(fillElement, getProgress) {
  let rafId = 0
  let running = true
  function frame() {
    if (!running) return
    const { now, masterStartTime, masterLoopDuration } = getProgress()
    updateProgressBar(fillElement, now, masterStartTime, masterLoopDuration)
    rafId = requestAnimationFrame(frame)
  }
  rafId = requestAnimationFrame(frame)
  return () => {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
  }
}
