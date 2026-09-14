import { ROWS } from '../slots.js'

const FILTER_MIN_HZ = 200
const FILTER_MAX_HZ = 20000
const FILTER_Q = 0.5

// The audio graph and the per-row parameters hanging off it. Every row is its
// own chain: sources -> gain -> lowpass -> destination.
export function createMixer() {
  let ctx = null
  const filters = {}
  const gains = {}

  const volumes = {}
  for (let r = 1; r <= ROWS; r++) volumes[r] = 1

  return {
    build() {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
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
    },

    context: () => ctx,
    now: () => ctx.currentTime,
    state: () => ctx.state,
    resume: () => ctx.resume(),
    createSource: () => ctx.createBufferSource(),
    close: () => ctx?.close().catch(() => {}),

    // Where a row's sources connect.
    rowInput: (row) => gains[row],

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
