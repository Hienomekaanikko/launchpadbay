// The master loop grid that every pad snaps to. Knows nothing about sources,
// rows or the DOM — it only answers "when is the next loop boundary?".
//
// `now` is an AudioContext-time getter (seconds). The grid is seeded on the
// first nextLoopBoundary() call from seedLoopLength — typically the lowest
// loaded slot's buffer duration, not whichever pad was pressed.
const SCHEDULE_AHEAD = 0.1

export function createLoopGrid(now) {
  let loopGridOrigin = null
  let loopLength = null
  let split = false

  return {
    isSplit: () => split,

    // 1 normally, 2 while SPLIT is halving every loop.
    loopDivisor: () => (split ? 2 : 1),

    // Next boundary on the grid. The first call after a reset establishes the
    // grid from `seedLoopLength`.
    nextLoopBoundary(seedLoopLength) {
      if (!loopGridOrigin || !loopLength) {
        const future = now() + SCHEDULE_AHEAD
        loopGridOrigin = future
        loopLength = seedLoopLength / (split ? 2 : 1)
        return future
      }
      const elapsed = now() - loopGridOrigin
      const loops = Math.floor(elapsed / loopLength)
      return loopGridOrigin + (loops + 1) * loopLength
    },

    // Halves or doubles the grid. Sources that are already playing keep their
    // old loopEnd until the caller re-applies loopDivisor() to them.
    setSplit(enabled) {
      split = enabled
      if (loopLength) loopLength = enabled ? loopLength / 2 : loopLength * 2
    },

    // Drops the grid so the next pad re-establishes it.
    reset() {
      loopGridOrigin = null
      loopLength = null
    },

    // Position through the current loop as 0..1, or null when nothing has
    // established a grid yet.
    loopPhase() {
      if (!loopGridOrigin || !loopLength) return null
      return Math.max(0, (now() - loopGridOrigin) % loopLength) / loopLength
    },
  }
}
