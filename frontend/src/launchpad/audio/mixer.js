import { ROWS } from '../slots.js'

const FILTER_MIN_HZ = 200
const FILTER_MAX_HZ = 20000
const FILTER_Q = 0.5

// The audio graph and the per-row parameters hanging off it. Every row is its
// own chain: sources -> gain -> lowpass -> destination.
//
// The context is created here (suspended until the first user gesture). A
// suspended context still decodes fine, so buffers can take it immediately.
export function createMixer() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const filters = {}
  const gains = {}

  const volumes = {}
  for (let r = 1; r <= ROWS; r++) volumes[r] = 1

  for (let r = 1; r <= ROWS; r++) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = FILTER_MAX_HZ
    f.Q.value = FILTER_Q
    f.connect(ctx.destination)
    filters[r] = f
    const g = ctx.createGain()
    g.connect(filters[r])
    gains[r] = g
  }

  return {
    context: () => ctx,
    now: () => ctx.currentTime,
    // No-op when already running; avoids InvalidStateError after close().
    resume: () => (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()),
    close: () => ctx.close().catch(() => {}),

    // Spawn a looping BufferSource into a row's gain. Callers decide `at` and
    // `loopEnd`; this only owns the node create / wire / start plumbing.
    startLoopSource(row, buffer, loopEnd, at) {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.loopEnd = loopEnd
      src.connect(gains[row])
      src.start(at)
      return src
    },

    setVolume(row, value01) {
      volumes[row] = value01
      gains[row].gain.setValueAtTime(value01, ctx.currentTime)
    },

    // Exponential sweep so the knob feels linear to the ear.
    setCutoff(row, value01) {
      const hz = FILTER_MIN_HZ * Math.pow(FILTER_MAX_HZ / FILTER_MIN_HZ, value01)
      filters[row].frequency.setValueAtTime(hz, ctx.currentTime)
    },

    // Drops any scheduled ramps and pins the row back to its knob volume.
    resetRowGain(row, atTime) {
      const gain = gains[row]
      if (!gain) return
      gain.gain.cancelScheduledValues(atTime)
      gain.gain.setValueAtTime(volumes[row], atTime)
    },
  }
}
