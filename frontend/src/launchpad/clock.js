export function createClock() {
  let loopOrigin = null
  let loopLength = null

  function isRunning() {
    return loopOrigin != null && loopLength != null
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
    const step = loopLength / subdivision
    const elapsed = nowSec - loopOrigin
    const n = Math.floor(elapsed / step)
    return loopOrigin + (n + 1) * step
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

  function getLoopOrigin() {
    return loopOrigin
  }

  function getLoopLength() {
    return loopLength
  }

  return { isRunning, start, clear, getNextGrid, getPhase, setLoopLength, getLoopOrigin, getLoopLength }
}
