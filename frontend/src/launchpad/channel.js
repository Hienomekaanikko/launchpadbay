import { SLOTS_PER_CHANNEL, padAt, slotOfPad } from './pads.js'

export function createChannel(id) {
    const padLoadingUi = {}
    for (let slot = 1; slot <= SLOTS_PER_CHANNEL; slot++)
      padLoadingUi[slot] = false
    return {
      id,
      state: 'idle', // idle | armed | playing | queued
      activePad: null,
      queuedPad: null,
      queuedAt: null,
      stutter: { division: 4, activeDivision: 0 }, // activeDivision > 0 while stuttering
      padLoadingUi,
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
      loadingUi: ch.padLoadingUi[slot],
    }
}

export function setPadLoadingUi(ch, pad, loading) {
    ch.padLoadingUi[slotOfPad(pad)] = loading
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
          ch.stutter.activeDivision = 0
        }
        break

      case 'STARTED':
        if (ch.state === 'armed' || ch.state === 'queued') {
          ch.state = 'playing'
          ch.activePad = event.pad
          clearQueue(ch)
        }
        break

      case 'QUEUE':
        if (ch.state === 'playing' || ch.state === 'queued') {
          ch.state = 'queued'
          ch.queuedPad = event.pad
          ch.queuedAt = event.when
        }
        break

      case 'CANCEL_QUEUE':
        if (ch.state === 'queued') {
          ch.state = 'playing'
          clearQueue(ch)
        }
        break

      case 'STOP':
        ch.state = 'idle'
        ch.activePad = null
        clearQueue(ch)
        ch.stutter.activeDivision = 0
        break

      case 'STUTTER_ON':
        if (ch.state === 'playing')
          ch.stutter.activeDivision = event.division
        break

      case 'STUTTER_OFF':
        ch.stutter.activeDivision = 0
        break

      case 'STUTTER_DIVISION':
        ch.stutter.division = event.division
        break

      case 'RESET': {
        const division = ch.stutter.division
        Object.assign(ch, createChannel(ch.id))
        ch.stutter.division = division
        break
      }

      default:
        break
    }
}
