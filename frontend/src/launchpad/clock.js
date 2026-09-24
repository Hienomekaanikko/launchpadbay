const LOOKAHEAD = 0.1

export function createClock() {
  let loopOrigin = null
  let fullLength = null
  let halfLength = null
  let split = false

  function isRunning() {
    return loopOrigin != null && fullLength != null
  }

  function isSplit() {
    return split
  }

  function getLoopLength() {
    if (split) return halfLength
    return fullLength
  }

  function start(currentTime, fullDuration) {
    loopOrigin = currentTime + LOOKAHEAD
    fullLength = fullDuration
    halfLength = fullDuration / 2
    return loopOrigin
  }

  function clear() {
    loopOrigin = null
    fullLength = null
    halfLength = null
  }

  function getNextGrid(currentTime, subdivision) {
    if (subdivision == null) subdivision = 1
    if (!isRunning()) return null
    const length = getLoopLength()
    const gridStep = length / subdivision
    const elapsed = currentTime - loopOrigin
    const n = Math.floor(elapsed / gridStep)
    return loopOrigin + (n + 1) * gridStep
  }

  function getPhase(currentTime) {
    if (!isRunning()) return null
    const length = getLoopLength()
    const elapsed = Math.max(0, (currentTime - loopOrigin) % length)
    return elapsed / length
  }

  function setSplit(enabled, gridTime) {
    if (enabled === split) return split
    split = enabled
    if (isRunning() && gridTime != null) {
      loopOrigin = gridTime
    }
    return split
  }

  return {
    isRunning,
    isSplit,
    getLoopLength,
    start,
    clear,
    getNextGrid,
    getPhase,
    setSplit,
  }
}
