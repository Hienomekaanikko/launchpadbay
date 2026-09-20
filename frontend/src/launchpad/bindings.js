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

function bindTransport(byId, onSplit) {
  const splitBtn = byId('split-btn')
  const handle = () => {
    const active = onSplit()
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

function bindKnobs(byId, onVolume, onFilter) {
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
      onVolume(channelId, v)
      updateKnobVisual(volWrap, v)
    }))

    const filterWrap = createKnob(`filter-wrap-${channelId}`, colorClass)
    filterCol.appendChild(filterWrap)
    let filterVal = 100
    cleanups.push(setupKnobDrag(filterWrap, () => filterVal, (v) => {
      filterVal = v
      onFilter(channelId, v)
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
  onSplit,
  onStutterTap,
  onStutterCycle,
  onVolume,
  onFilter,
}) {
  bindTransport(byId, onSplit)
  bindStutterControls(byId, trackUiTimer, onStutterTap, onStutterCycle)
  const knobCleanups = bindKnobs(byId, onVolume, onFilter)
  bindPads(padEl, onPad)
  return { knobCleanups }
}
