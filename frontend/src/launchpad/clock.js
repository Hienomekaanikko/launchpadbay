const LOOKAHEAD_SEC = 0.1

export function createClock() {
    let loopOrigin = null
    let fullLength = null
    let split = false

    function isRunning() {
      return loopOrigin != null && fullLength != null
    }

    function isSplit() {
      return split
    }

    function getLoopLength() {
      if (split)
        return fullLength / 2
      return fullLength
    }

    function startClock(currentTime, fullDuration) {
      loopOrigin = currentTime + LOOKAHEAD_SEC
      fullLength = fullDuration
      return loopOrigin
    }

    function clear() {
      loopOrigin = null
      fullLength = null
    }

    function getNextGrid(currentTime, subdivision = 1) {
      if (!isRunning())
        return null
      const length = getLoopLength()
      const gridStep = length / subdivision
      const elapsed = currentTime - loopOrigin
      const n = Math.floor(elapsed / gridStep)
      return loopOrigin + (n + 1) * gridStep
    }

    function getPhase(currentTime) {
      if (!isRunning())
        return null
      const length = getLoopLength()
      const elapsed = Math.max(0, (currentTime - loopOrigin) % length)
      return elapsed / length
    }

    function setSplit(enabled, gridTime) {
      split = enabled
      // Every loop restarts from offset 0 at the switch, so the grid restarts there too.
      if (isRunning())
        loopOrigin = gridTime
    }

    return {
      isRunning,
      isSplit,
      getLoopLength,
      startClock,
      clear,
      getNextGrid,
      getPhase,
      setSplit,
    }
}
