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

function bindPads(padEl, trigger) {
  for (let pad = 1; pad <= PAD_COUNT; pad++) {
    const btn = padEl(pad)
    if (!btn) continue
    bindClickAndTouch(btn, () => trigger({ type: 'PAD_HIT', pad }))
  }
}

function bindTransport(byId, trigger) {
  const splitBtn = byId('split-btn')
  bindClickAndTouch(splitBtn, () => trigger({ type: 'SPLIT_TOGGLE' }))
}

// Double-tap: single = cycle depth, double = toggle stutter
function bindStutterControls(byId, trackUiTimer, trigger) {
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
        if (tapCount === 1) trigger({ type: 'STUTTER_CYCLE', channelId })
        else trigger({ type: 'STUTTER_TAP', channelId })
        tapCount = 0
      }, 280)
    }
    bindClickAndTouch(btn, onTap)
  }
}

function bindKnobs(byId, trigger) {
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
      trigger({ type: 'SET_GAIN', channelId, value: v })
      updateKnobVisual(volWrap, v)
    }))

    const filterWrap = createKnob(`filter-wrap-${channelId}`, colorClass)
    filterCol.appendChild(filterWrap)
    let filterVal = 100
    cleanups.push(setupKnobDrag(filterWrap, () => filterVal, (v) => {
      filterVal = v
      trigger({ type: 'SET_FILTER', channelId, value: v })
      updateKnobVisual(filterWrap, v)
    }))
  }

  return cleanups
}

export function bindLaunchpadControls({
  byId,
  padEl,
  trackUiTimer,
  trigger,
}) {
  bindTransport(byId, trigger)
  bindStutterControls(byId, trackUiTimer, trigger)
  const knobCleanups = bindKnobs(byId, trigger)
  bindPads(padEl, trigger)
  return { knobCleanups }
}
