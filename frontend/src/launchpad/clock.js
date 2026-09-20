// Shared transport: origin + period. No pads, no AudioNodes.

export function createClock() {
  let originSec = null
  let periodSec = null

  function isRunning() {
    return originSec != null && periodSec != null
  }

  function arm(nowSec, period, lookaheadSec) {
    if (lookaheadSec == null) lookaheadSec = 0.1
    originSec = nowSec + lookaheadSec
    periodSec = period
    return originSec
  }

  function clear() {
    originSec = null
    periodSec = null
  }

  /** subdivision: 1 = full loop, 2 = half, 4 = 1/4, etc. */
  function nextBoundary(nowSec, subdivision) {
    if (subdivision == null) subdivision = 1
    if (!isRunning()) return null
    const step = periodSec / subdivision
    const elapsed = nowSec - originSec
    const n = Math.floor(elapsed / step)
    return originSec + (n + 1) * step
  }

  /** 0..1 phase through the master period (for the progress bar) */
  function phase(nowSec) {
    if (!isRunning()) return null
    const elapsed = Math.max(0, (nowSec - originSec) % periodSec)
    return elapsed / periodSec
  }

  /**
   * Change period. preservePhase=true keeps the current musical phase
   * by shifting origin (cleaner than a blind *= 2 on split).
   */
  function setPeriod(newPeriodSec, nowSec, preservePhase) {
    if (preservePhase == null) preservePhase = true
    if (!isRunning()) {
      periodSec = newPeriodSec
      return
    }
    if (preservePhase) {
      let p = phase(nowSec)
      if (p == null) p = 0
      periodSec = newPeriodSec
      originSec = nowSec - p * periodSec
    } else {
      periodSec = newPeriodSec
    }
  }

  function snapshot() {
    return { originSec, periodSec }
  }

  return { isRunning, arm, clear, nextBoundary, phase, setPeriod, snapshot }
}
