import { SLOTS_PER_CHANNEL, padAt, slotOfPad } from './pads.js'

function createPads(channelId) {
  const pads = {}
  for (let slot = 1; slot <= SLOTS_PER_CHANNEL; slot++) {
    pads[slot] = {
      pad: padAt(channelId, slot),
      loading: false,
    }
  }
  return pads
}

export function createChannel(id) {
  return {
    id,
    state: 'idle', // idle | armed | playing | pending | stuttering
    activePad: null,
    pendingPad: null,
    pendingAt: null,
    stutter: { depth: 4, activeDepth: 0 },
    pads: createPads(id),
  }
}

export function createChannels(count) {
  const channels = {}
  for (let id = 1; id <= count; id++) channels[id] = createChannel(id)
  return channels
}

export function anyChannelActive(channels) {
  return Object.values(channels).some(
    (ch) => ch.state === 'playing' || ch.state === 'armed' || ch.state === 'pending' || ch.state === 'stuttering'
  )
}

/** Derive blink/active from channel FSM — pad slots only store loading. */
export function getPadVisual(ch, slot) {
  const padState = ch.pads[slot]
  const pad = padState.pad
  const waiting =
    (ch.state === 'armed' && ch.activePad === pad) ||
    (ch.state === 'pending' && ch.pendingPad === pad)
  const active =
    !waiting &&
    ch.activePad === pad &&
    (ch.state === 'playing' || ch.state === 'stuttering' || ch.state === 'pending')
  return {
    pad,
    blinking: waiting,
    active,
    loading: padState.loading,
  }
}

export function setPadFlags(ch, pad, flags) {
  Object.assign(ch.pads[slotOfPad(pad)], flags)
  return ch
}

export function setAllPadsLoading(ch, loading) {
  for (let slot = 1; slot <= SLOTS_PER_CHANNEL; slot++) {
    ch.pads[slot].loading = loading
  }
  return ch
}

export function applyChannelEvent(ch, event) {
  switch (event.type) {
    case 'ARM':
      if (ch.state === 'idle') {
        return { ...ch, state: 'armed', activePad: event.pad }
      }
      // Idempotent re-arm (same pad already waiting).
      if (ch.state === 'armed' && ch.activePad === event.pad) {
        return ch
      }
      // Stutter release / resume: drop stutter and wait for the next boundary.
      if (ch.state === 'stuttering' && ch.activePad === event.pad) {
        return {
          ...ch,
          state: 'armed',
          stutter: { ...ch.stutter, activeDepth: 0 },
        }
      }
      // Re-arm while playing (same pad) — e.g. schedule-ahead after a stop gap.
      if (ch.state === 'playing' && ch.activePad === event.pad) {
        return { ...ch, state: 'armed' }
      }
      return ch

    case 'STARTED':
      if (ch.state === 'armed' || ch.state === 'pending') {
        return {
          ...ch,
          state: 'playing',
          activePad: event.pad,
          pendingPad: null,
          pendingAt: null,
        }
      }
      return ch

    case 'QUEUE_HANDOFF':
      if (ch.state === 'playing' || ch.state === 'pending') {
        return {
          ...ch,
          state: 'pending',
          pendingPad: event.pad,
          pendingAt: event.at,
        }
      }
      return ch

    case 'CANCEL_PENDING':
      if (ch.state === 'pending') {
        return { ...ch, state: 'playing', pendingPad: null, pendingAt: null }
      }
      return ch

    case 'STOP':
      return {
        ...ch,
        state: 'idle',
        activePad: null,
        pendingPad: null,
        pendingAt: null,
        stutter: { ...ch.stutter, activeDepth: 0 },
      }

    case 'STUTTER_ON':
      if (ch.state === 'playing' || ch.state === 'stuttering') {
        return {
          ...ch,
          state: 'stuttering',
          stutter: { ...ch.stutter, activeDepth: event.depth },
        }
      }
      return ch

    case 'STUTTER_OFF':
      if (ch.state === 'stuttering') {
        return {
          ...ch,
          state: 'playing',
          stutter: { ...ch.stutter, activeDepth: 0 },
        }
      }
      return ch

    case 'STUTTER_DEPTH':
      return {
        ...ch,
        stutter: { ...ch.stutter, depth: event.depth },
      }

    case 'RESET':
      return createChannel(ch.id)

    default:
      return ch
  }
}
