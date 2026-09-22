// DOM wiring only. Audio/state side effects live in engine callbacks.

import { CHANNEL_COUNT, PAD_COUNT } from './pads.js'
import {
  createKnob,
  setupKnobDrag,
  updateKnobVisual,
} from './ui.js'

function bindClickAndTouch(el, handler) {
  el.addEventListener('click', handler)
  el.addEventListener('touchend', (e) => {
    e.preventDefault()
    handler()
  }, { passive: false })
}

function bindPads(padEl, onPad) {
  for (let pad = 1; pad <= PAD_COUNT; pad++) {
    const btn = padEl(pad)
    if (!btn) continue
    bindClickAndTouch(btn, () => onPad(pad))
  }
}

function bindTransport(byId, toggleSplit) {
  const splitBtn = byId('split-btn')
  const handle = () => {
    const active = toggleSplit()
    splitBtn.classList.toggle('active', active)
  }
  bindClickAndTouch(splitBtn, handle)
}

// Double-tap: single = cycle depth, double = toggle stutter
function bindStutterControls(byId, trackUiTimer, onStutterTap, onStutterCycle) {
  const stutterCol = byId('stutter-btns')
  for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
    const btn = document.createElement('button')
    btn.id = `stutter-btn-${channelId}`
    btn.className = 'stutter-btn'
    btn.textContent = '1/4'
    stutterCol.appendChild(btn)

    let tapCount = 0
    let tapTimer = null
    const onTap = () => {
      tapCount++
      clearTimeout(tapTimer)
      tapTimer = trackUiTimer(() => {
        if (tapCount === 1) onStutterCycle(channelId)
        else onStutterTap(channelId)
        tapCount = 0
      }, 280)
    }
    bindClickAndTouch(btn, onTap)
  }
}

function bindKnobs(byId, setVolume, setFilter) {
  const cleanups = []
  const volCol = byId('vol-knobs')
  const filterCol = byId('filter-knobs')

  for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
    const colorClass = `row-color-${channelId}`

    const volWrap = createKnob(`vol-wrap-${channelId}`, colorClass)
    volCol.appendChild(volWrap)
    let volVal = 100
    cleanups.push(setupKnobDrag(volWrap, () => volVal, (v) => {
      volVal = v
      setVolume(channelId, v)
      updateKnobVisual(volWrap, v)
    }))

    const filterWrap = createKnob(`filter-wrap-${channelId}`, colorClass)
    filterCol.appendChild(filterWrap)
    let filterVal = 100
    cleanups.push(setupKnobDrag(filterWrap, () => filterVal, (v) => {
      filterVal = v
      setFilter(channelId, v)
      updateKnobVisual(filterWrap, v)
    }))
  }

  return cleanups
}

export function bindLaunchpadControls({
  byId,
  padEl,
  trackUiTimer,
  onPad,
  toggleSplit,
  onStutterTap,
  onStutterCycle,
  setVolume,
  setFilter,
}) {
  bindTransport(byId, toggleSplit)
  bindStutterControls(byId, trackUiTimer, onStutterTap, onStutterCycle)
  const knobCleanups = bindKnobs(byId, setVolume, setFilter)
  bindPads(padEl, onPad)
  return { knobCleanups }
}
