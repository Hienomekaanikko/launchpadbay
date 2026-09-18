export let audioCtx = null
export const rowGains = {}
export const rowFilters = {}
export const sounds = {}
export const soundToPad = {}
const bufferCache = new Map()

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
}

export function initDSP(rows) {
  for (const row of rows) {
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 20000
    filter.Q.value = 0.5
    filter.connect(audioCtx.destination)
    rowFilters[row] = filter
    const gain = audioCtx.createGain()
    gain.connect(filter)
    rowGains[row] = gain
  }
}

export async function loadSound(soundName, url) {
  if (!bufferCache.has(url)) {
    const httpResponse = await fetch(url)
    const rawAudio = await httpResponse.arrayBuffer()
    bufferCache.set(url, await audioCtx.decodeAudioData(rawAudio))
  }
	sounds[soundName] = {
		buffer: bufferCache.get(url),
		source: null,
		startUiTimerId: null
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
  for (const soundName of Object.keys(sounds)) {
    try { sounds[soundName]?.source?.stop() } catch { /* already stopped */ }
  }
}

// Clears module singletons so a later mount can re-init cleanly.
export function resetAudio() {
  stopAllSources()
  for (const key of Object.keys(sounds)) delete sounds[key]
  for (const key of Object.keys(soundToPad)) delete soundToPad[key]
  for (const key of Object.keys(rowGains)) delete rowGains[key]
  for (const key of Object.keys(rowFilters)) delete rowFilters[key]
  bufferCache.clear()
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
}
