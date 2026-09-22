import { CHANNEL_COUNT } from './pads.js'

export let audioCtx = null
export const channelGains = {}
export const channelFilters = {}
// pad index (1..25) -> { buffer, source, uiStartTimerId }
export const padVoices = {}
const bufferCache = new Map()

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
}

export function initChannelChain() {
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

export async function loadPadVoice(pad, url) {
  if (!bufferCache.has(url)) {
    const httpResponse = await fetch(url)
    const rawAudio = await httpResponse.arrayBuffer()
    bufferCache.set(url, await audioCtx.decodeAudioData(rawAudio))
  }
  padVoices[pad] = {
    buffer: bufferCache.get(url),
    source: null,
    uiStartTimerId: null,
  }
}

export function getSplitDuration(durationSec, splitActive) {
  if (splitActive) return durationSec / 2
  return durationSec
}

/** After flipping split on/off: halve or double the running master loop length. */
export function getLoopLengthAfterSplitToggle(loopLengthSec, splitActive) {
  if (splitActive) return loopLengthSec / 2
  return loopLengthSec * 2
}

export function createLoopSource(buffer, splitActive, loopEndSec) {
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  if (loopEndSec != null) {
    source.loopEnd = loopEndSec
  } else {
    source.loopEnd = getSplitDuration(buffer.duration, splitActive)
  }
  return source
}

export function stopPlayer(source, when) {
  if (!source) return
  try {
    if (when != null) source.stop(when)
    else source.stop()
  } catch { /* already stopped */ }
}

export function stopAllVoices() {
  for (const voice of Object.values(padVoices)) {
    if (voice) stopPlayer(voice.source)
  }
}

export function resetAudio() {
  stopAllVoices()
	for (const key of Object.keys(padVoices))
		delete padVoices[key]
	for (const key of Object.keys(channelGains))
		delete channelGains[key]
	for (const key of Object.keys(channelFilters))
		delete channelFilters[key]
  bufferCache.clear()
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
}
