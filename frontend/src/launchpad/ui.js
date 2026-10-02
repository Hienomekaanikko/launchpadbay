import { getPadVisual } from './channel.js'
import { SLOTS_PER_CHANNEL } from './pads.js'

// Knob geometry in SVG units (viewBox 0 0 44 44). Angles: 0° = up, clockwise.
const KNOB_CENTER = 22
const KNOB_START_DEG = -135
const KNOB_SWEEP_DEG = 270
const ARC_RADIUS = 16
const DOT_RADIUS = 11

// value: 0..100
function valueToAngle(value) {
    return KNOB_START_DEG + (value / 100) * KNOB_SWEEP_DEG
}

function knobAngleXY(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: +(KNOB_CENTER + radius * Math.sin(rad)).toFixed(2),
      y: +(KNOB_CENTER - radius * Math.cos(rad)).toFixed(2),
    }
}

function knobArcPath(value) {
    if (value <= 0)
      return ''
    const endDeg = valueToAngle(value)
    const start = knobAngleXY(KNOB_START_DEG, ARC_RADIUS)
    const end = knobAngleXY(endDeg, ARC_RADIUS)
    const largeArc = endDeg - KNOB_START_DEG > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function createKnob(id, colorClass) {
    const wrap = document.createElement('div')
    wrap.className = `knob-wrap ${colorClass}`
    wrap.id = id
    const initDot = knobAngleXY(valueToAngle(100), DOT_RADIUS)
    const fullArc = knobArcPath(100)
    wrap.innerHTML = `
      <svg class="knob-svg" viewBox="0 0 44 44">
        <circle class="knob-bg" cx="${KNOB_CENTER}" cy="${KNOB_CENTER}" r="20"/>
        <path class="knob-track" d="${fullArc}"/>
        <path class="knob-fill" d="${fullArc}"/>
        <circle class="knob-dot" cx="${initDot.x}" cy="${initDot.y}" r="2.5"/>
      </svg>`
    return wrap
}

export function updateKnobVisual(wrap, value) {
    const fill = wrap.querySelector('.knob-fill')
    const dot = wrap.querySelector('.knob-dot')
    if (fill)
      fill.setAttribute('d', knobArcPath(value))
    if (dot) {
      const p = knobAngleXY(valueToAngle(value), DOT_RADIUS)
      dot.setAttribute('cx', p.x)
      dot.setAttribute('cy', p.y)
    }
}

export function setupKnobDrag(wrap, getKnobValue, setKnobValue) {
    let dragging = false
    let startY = 0
    let startVal = 0
    const cleanups = []

    function listen(target, type, handler, opts) {
      target.addEventListener(type, handler, opts)
      cleanups.push(() => target.removeEventListener(type, handler, opts))
    }

    listen(wrap, 'mousedown', (e) => {
      dragging = true; startY = e.clientY; startVal = getKnobValue()
      e.preventDefault()
    })
    listen(window, 'mousemove', (e) => {
      if (!dragging)
        return
      setKnobValue(Math.max(0, Math.min(100, startVal + (startY - e.clientY))))
    })
    listen(window, 'mouseup', () => { dragging = false })

    listen(wrap, 'touchstart', (e) => {
      dragging = true; startY = e.touches[0].clientY; startVal = getKnobValue()
      e.preventDefault()
    }, { passive: false })
    listen(window, 'touchmove', (e) => {
      if (!dragging)
        return
      setKnobValue(Math.max(0, Math.min(100, startVal + (startY - e.touches[0].clientY))))
      e.preventDefault()
    }, { passive: false })
    listen(window, 'touchend', () => { dragging = false })

    listen(wrap, 'wheel', (e) => {
      e.preventDefault()
      setKnobValue(Math.max(0, Math.min(100, getKnobValue() + (e.deltaY < 0 ? 2 : -2))))
    }, { passive: false })

    return () => {
      for (const off of cleanups)
        off()
      cleanups.length = 0
    }
}

export function updateStutterBtn(byId, channelId, division, activeDivision) {
    const btn = byId(`stutter-btn-${channelId}`)
    if (!btn)
      return
    btn.textContent = `1/${division}`
    btn.classList.toggle('stutter-active', activeDivision !== 0)
}

export function updateSplitBtn(byId, active) {
    const btn = byId('split-btn')
    if (btn)
      btn.classList.toggle('active', active)
}

/** Project one pad's derived visual onto the DOM. */
export function renderPad(padEl, visual) {
    const el = padEl(visual.pad)
    if (!el)
      return
    el.classList.toggle('blink', visual.blinking)
    el.classList.toggle('active', visual.active)
    el.classList.toggle('btn-loading', visual.loadingUi)
}

/** Project all 5 slots of a channel onto the DOM. */
export function renderChannel(padEl, ch) {
    for (let slot = 1; slot <= SLOTS_PER_CHANNEL; slot++)
      renderPad(padEl, getPadVisual(ch, slot))
}

export function applyTheme(theme) {
    document.body.style.backgroundImage = theme.bgImage ? `url('${theme.bgImage}')` : ''
    if (theme.bodyClass)
      document.body.classList.add(theme.bodyClass)
}

/** phase: 0..1 while the clock is running, or null when idle */
function updateProgressBar(fillElement, phase) {
    if (!fillElement)
      return
    if (phase != null) {
      fillElement.style.width = phase * 100 + '%'
      fillElement.style.opacity = '1'
    } else {
      fillElement.style.opacity = '0'
    }
}

export function startProgressLoop(fillElement, getPhase) {
    let rafId = 0
    let running = true
    function frame() {
      if (!running)
        return
      updateProgressBar(fillElement, getPhase())
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => {
      running = false
      if (rafId)
        cancelAnimationFrame(rafId)
    }
}
