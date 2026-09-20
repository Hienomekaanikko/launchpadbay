// Per-channel pad lifecycle. No timing math, no AudioNodes.

export function createChannel(id) {
  return {
    id,
    state: 'idle', // idle | armed | playing | pending | stuttering
    activePad: null,
    pendingPad: null,
    pendingAt: null,
    stutter: { depth: 4, activeDepth: 0 },
    stutterSource: null,
  }
}

export function createChannels(count) {
  const channels = {}
  for (let id = 1; id <= count; id++) channels[id] = createChannel(id)
  return channels
}

export function anyChannelSounding(channels) {
  return Object.values(channels).some(
    (ch) => ch.state === 'playing' || ch.state === 'armed' || ch.state === 'pending' || ch.state === 'stuttering'
  )
}

export function reduceChannel(ch, event) {
  switch (event.type) {
    case 'ARM':
      if (ch.state === 'idle') {
        return { ...ch, state: 'armed', activePad: event.pad }
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
        stutterSource: null,
      }

    case 'STUTTER_ON':
      // Allow from stuttering so depth changes while engaged still update activeDepth.
      // Allow from armed so stutter can engage during the pre-roll blink window.
      if (ch.state === 'playing' || ch.state === 'stuttering' || ch.state === 'armed') {
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
          stutterSource: null,
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
