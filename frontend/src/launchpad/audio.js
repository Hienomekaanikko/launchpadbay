import { CHANNEL_COUNT } from './pads.js'

export let audioCtx = null
export const channelGains = {}
export const channelFilters = {}
// pad index (1..25) -> { buffer, source, startUiTimerId }
export const sounds = {}
const bufferCache = new Map()

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
}

export function initDSP() {
  for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 20000
    filter.Q.value = 0.5
    filter.connect(audioCtx.destination)
    channelFilters[channel] = filter
    const gain = audioCtx.createGain()
    gain.connect(filter)
    channelGains[channel] = gain
  }
}

export async function loadSound(pad, url) {
  if (!bufferCache.has(url)) {
    const httpResponse = await fetch(url)
    const rawAudio = await httpResponse.arrayBuffer()
    bufferCache.set(url, await audioCtx.decodeAudioData(rawAudio))
  }
  sounds[pad] = {
    buffer: bufferCache.get(url),
    source: null,
    startUiTimerId: null,
  }
}

export function createBufferSource(buffer, splitActive, loopEndSec) {
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  if (loopEndSec != null) {
    source.loopEnd = loopEndSec
  } else {
    source.loopEnd = buffer.duration / (splitActive ? 2 : 1)
  }
  return source
}

export function stopAllSources() {
  for (const sound of Object.values(sounds)) {
    try { sound?.source?.stop() } catch { /* already stopped */ }
  }
}

// Clears module singletons so a later mount can re-init cleanly.
export function resetAudio() {
  stopAllSources()
  for (const key of Object.keys(sounds)) delete sounds[key]
  for (const key of Object.keys(channelGains)) delete channelGains[key]
  for (const key of Object.keys(channelFilters)) delete channelFilters[key]
  bufferCache.clear()
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
}
