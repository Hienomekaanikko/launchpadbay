import { SLOTS_PER_CHANNEL, padAt, slotOfPad } from './pads.js'

function createPadLoading() {
    const padLoading = {}
    for (let slot = 1; slot <= SLOTS_PER_CHANNEL; slot++)
      padLoading[slot] = false
    return padLoading
}

export function createChannel(id) {
    return {
      id,
      state: 'idle', // idle | armed | playing | queued
      activePad: null,
      queuedPad: null,
      queuedAt: null,
      stutter: { depth: 4, activeDepth: 0 }, // activeDepth > 0 while stuttering
      padLoading: createPadLoading(),
    }
}

export function createChannels(count) {
    const channels = {}
    for (let id = 1; id <= count; id++)
      channels[id] = createChannel(id)
    return channels
}

export function anyChannelActive(channels) {
    return Object.values(channels).some((ch) => ch.state !== 'idle')
}

export function getPadVisual(ch, slot) {
    const pad = padAt(ch.id, slot)
    const waiting =
      (ch.state === 'armed' && ch.activePad === pad) ||
      (ch.state === 'queued' && ch.queuedPad === pad)
    const active =
      !waiting &&
      ch.activePad === pad &&
      (ch.state === 'playing' || ch.state === 'queued')
    return {
      pad,
      blinking: waiting,
      active,
      loading: ch.padLoading[slot],
    }
}

export function setPadLoading(ch, pad, loading) {
    ch.padLoading[slotOfPad(pad)] = loading
}

function clearQueue(ch) {
    ch.queuedPad = null
    ch.queuedAt = null
}

export function applyChannelEvent(ch, event) {
    switch (event.type) {
      case 'ARM':
        if (ch.state === 'idle') {
          ch.state = 'armed'
          ch.activePad = event.pad
        } else if (ch.state === 'playing' && ch.activePad === event.pad) {
          ch.state = 'armed'
          ch.stutter.activeDepth = 0
        }
        break

      case 'STARTED':
        if (ch.state === 'armed' || ch.state === 'queued') {
          ch.state = 'playing'
          ch.activePad = event.pad
          clearQueue(ch)
        }
        break

      case 'QUEUE_HANDOFF':
        if (ch.state === 'playing' || ch.state === 'queued') {
          ch.state = 'queued'
          ch.queuedPad = event.pad
          ch.queuedAt = event.when
        }
        break

      case 'CANCEL_HANDOFF':
        if (ch.state === 'queued') {
          ch.state = 'playing'
          clearQueue(ch)
        }
        break

      case 'STOP':
        ch.state = 'idle'
        ch.activePad = null
        clearQueue(ch)
        ch.stutter.activeDepth = 0
        break

      case 'STUTTER_ON':
        if (ch.state === 'playing')
          ch.stutter.activeDepth = event.depth
        break

      case 'STUTTER_OFF':
        ch.stutter.activeDepth = 0
        break

      case 'STUTTER_DEPTH':
        ch.stutter.depth = event.depth
        break

      case 'RESET': {
        const depth = ch.stutter.depth
        Object.assign(ch, createChannel(ch.id))
        ch.stutter.depth = depth
        break
      }

      default:
        break
    }
}
