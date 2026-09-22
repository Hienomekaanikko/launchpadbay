// Shared transport: origin + loop length + split. No pads, no AudioNodes.
// Subdivisions (1/4, 1/8, 1/16) are always derived from the current loopLength.

export function createClock() {
  let loopOrigin = null
  let loopLength = null
  let split = false

  function isRunning() {
    return loopOrigin != null && loopLength != null
  }

  function isSplit() {
    return split
  }

  /** Buffer duration → loop end under current split. */
  function loopEndFor(durationSec) {
    if (split) return durationSec / 2
    return durationSec
  }

  function start(nowSec, length, lookaheadSec) {
    if (lookaheadSec == null) lookaheadSec = 0.1
    loopOrigin = nowSec + lookaheadSec
    loopLength = length
    return loopOrigin
  }

  function clear() {
    loopOrigin = null
    loopLength = null
  }

  function getNextGrid(nowSec, subdivision) {
    if (subdivision == null) subdivision = 1
    if (!isRunning()) return null
    const gridStep = loopLength / subdivision
    const elapsed = nowSec - loopOrigin
    const n = Math.floor(elapsed / gridStep)
    return loopOrigin + (n + 1) * gridStep
  }

  /** 0..1 phase through the master loop (for the progress bar) */
  function getPhase(nowSec) {
    if (!isRunning()) return null
    const elapsed = Math.max(0, (nowSec - loopOrigin) % loopLength)
    return elapsed / loopLength
  }

  /**
   * Change loop length. preservePhase=true keeps the current musical phase
   * by shifting origin (cleaner than a blind *= 2 on split).
   */
  function setLoopLength(newLoopLength, nowSec, preservePhase) {
    if (preservePhase == null) preservePhase = true
    if (!isRunning()) {
      loopLength = newLoopLength
      return
    }
    if (preservePhase) {
      let p = getPhase(nowSec)
      if (p == null) p = 0
      loopLength = newLoopLength
      loopOrigin = nowSec - p * loopLength
    } else {
      loopLength = newLoopLength
    }
  }

  /** Flip split; rescale running grid. Sources must re-apply loopEndFor themselves. */
  function setSplit(enabled, nowSec) {
    if (enabled === split) return split
    split = enabled
    if (isRunning()) {
      const next = enabled ? loopLength / 2 : loopLength * 2
      setLoopLength(next, nowSec, true)
    }
    return split
  }

  function getLoopLength() {
    return loopLength
  }

  return {
    isRunning,
    isSplit,
    loopEndFor,
    start,
    clear,
    getNextGrid,
    getPhase,
    setSplit,
    getLoopLength,
  }
}
