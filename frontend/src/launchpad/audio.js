import { CHANNEL_COUNT } from './pads.js'

export let audioContext = null
export const channelGains = {}
export const channelFilters = {}
export const padVoices = {}
const bufferCache = new Map()

export function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
}

export function initChannelProcessors() {
    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      const filter = audioContext.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 20000
      filter.Q.value = 0.5
      filter.connect(audioContext.destination)
      channelFilters[channel] = filter
      const gain = audioContext.createGain()
      gain.connect(filter)
      channelGains[channel] = gain
    }
}

export async function loadPadVoice(pad, url) {
    if (!bufferCache.has(url)) {
      const httpResponse = await fetch(url)
      const rawAudio = await httpResponse.arrayBuffer()
      bufferCache.set(url, await audioContext.decodeAudioData(rawAudio))
    }
    padVoices[pad] = {
      buffer: bufferCache.get(url),
      source: null,
      uiStartTimerId: null,
    }
}

function createLoopSource(buffer, loopEndSec) {
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopEnd = loopEndSec
    return source
}

export function stopSource(source, when) {
    if (!source)
      return
    try {
      if (when != null)
        source.stop(when)
      else
        source.stop()
    } catch { /* already stopped */ }
}

export function replaceLoopSource(channelId, buffer, loopEndSec, when, previousSource) {
    stopSource(previousSource, when)
    const source = createLoopSource(buffer, loopEndSec)
    source.connect(channelGains[channelId])
    source.start(when)
    return source
}

export function resetAudio() {
    for (const voice of Object.values(padVoices)) {
      if (voice)
        stopSource(voice.source)
    }
    for (const key of Object.keys(padVoices))
      delete padVoices[key]
    for (const key of Object.keys(channelGains))
      delete channelGains[key]
    for (const key of Object.keys(channelFilters))
      delete channelFilters[key]
    bufferCache.clear()
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
}
