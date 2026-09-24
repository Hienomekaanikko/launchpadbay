// Quantized SPLIT ½: arm on click, apply on next half/full grid boundary.
// Live sources are restarted at the boundary — loopEnd-only updates are unreliable.

import { createLoopSource, stopPlayer } from './audio.js'

export function createSplitControl({
  clock,
  channels,
  padVoices,
  channelGains,
  uiTimers,
  getCurrentTime,
  isUnmounted,
}) {
  let pending = null // { enabled, at, timerId } | null

  function cancelPendingSplit() {
    if (!pending) return
    uiTimers.cancel(pending.timerId)
    pending = null
  }

  function restartActiveSources(when) {
    const loopEnd = clock.getLoopLength()
    for (const ch of Object.values(channels)) {
      if (!ch.activePad) continue
      const voice = padVoices[ch.activePad]
      if (!voice || !voice.buffer) continue

      if (voice.source) {
        stopPlayer(voice.source, when)
        voice.source = null
      }

      const source = createLoopSource(voice.buffer, loopEnd)
      source.connect(channelGains[ch.id])
      source.start(when)
      voice.source = source
    }
  }

  function applySplit(enabled, boundaryTime) {
    const now = getCurrentTime()
    let when = boundaryTime
    if (when == null || when < now) when = now

    const active = clock.setSplit(enabled, when)
    if (clock.isRunning()) restartActiveSources(when)
    return active
  }

  function toggleSplit() {
    const desired = pending ? !pending.enabled : !clock.isSplit()

    if (!clock.isRunning()) {
      cancelPendingSplit()
      return applySplit(desired, null)
    }

    if (desired === clock.isSplit()) {
      cancelPendingSplit()
      return clock.isSplit()
    }

    // ON: next half of the full bar (midpoint or end). OFF: next half-bar.
    const subdivision = desired ? 2 : 1
    const now = getCurrentTime()
    const at = clock.getNextGrid(now, subdivision)
    const delayMs = ((at - now) * 1000) | 0
    const timerId = uiTimers.track(() => {
      if (isUnmounted() || !pending) return
      const { enabled } = pending
      pending = null
      applySplit(enabled, at)
    }, delayMs)

    pending = { enabled: desired, at, timerId }
    return desired
  }

  return { toggleSplit, cancelPendingSplit, applySplit }
}
