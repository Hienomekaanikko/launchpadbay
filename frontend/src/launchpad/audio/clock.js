// The master loop grid that every pad snaps to. Knows nothing about sources,
// rows or the DOM — it only answers "when is the next loop boundary?".
export function createClock(mixer) {
  let startTime = null
  let loopDuration = null
  let split = false

  return {
    isSplit: () => split,

    // 1 normally, 2 while SPLIT is halving every loop.
    divisor: () => (split ? 2 : 1),

    // Next boundary on the grid. The first call after a reset establishes the
    // grid from `defaultDuration`, so whichever pad is triggered first sets the
    // bar length for everything after it.
    nextStartTime(defaultDuration) {
      if (!startTime || !loopDuration) {
        const future = mixer.now() + 0.1
        startTime = future
        loopDuration = defaultDuration / (split ? 2 : 1)
        return future
      }
      const elapsed = mixer.now() - startTime
      const bars = Math.floor(elapsed / loopDuration)
      return startTime + (bars + 1) * loopDuration
    },

    // Halves or doubles the grid. Sources that are already playing keep their
    // old loopEnd until the caller re-applies divisor() to them.
    setSplit(enabled) {
      split = enabled
      if (loopDuration) loopDuration = enabled ? loopDuration / 2 : loopDuration * 2
    },

    // Drops the grid so the next pad re-establishes it.
    reset() {
      startTime = null
      loopDuration = null
    },

    // Position through the current loop as 0..1, or null when nothing has
    // established a grid yet.
    phase() {
      if (!startTime || !loopDuration) return null
      return Math.max(0, (mixer.now() - startTime) % loopDuration) / loopDuration
    },
  }
}
