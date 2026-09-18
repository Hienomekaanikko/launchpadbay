export let audioCtx = null
export const rowGains = {}
export const rowFilters = {}
export const sounds = {}
export const soundToButton = {}
const bufferCache = new Map()

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
}

export function initAudioGainFilter(rows) {
  for (const row of rows) {
    const f = audioCtx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 20000
    f.Q.value = 0.5
    f.connect(audioCtx.destination)
    rowFilters[row] = f
    const g = audioCtx.createGain()
    g.connect(f)
    rowGains[row] = g
  }
}

export async function loadSound(name, url) {
  if (!bufferCache.has(url)) {
    const resp = await fetch(url)
    const raw = await resp.arrayBuffer()
    bufferCache.set(url, await audioCtx.decodeAudioData(raw))
  }
  sounds[name] = { buffer: bufferCache.get(url), source: null, startTimeoutId: null }
}

export function createBufferSource(buffer, splitActive, loopEnd) {
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.loopEnd = loopEnd ?? buffer.duration / (splitActive ? 2 : 1)
  return source
}

export function startSource(source, startTime) {
  source.start(startTime)
}

export function setGainValue(gain, value, startTime) {
  gain.gain.setValueAtTime(value, startTime)
}

export function stopAllSources() {
  for (const name of Object.keys(sounds)) {
    try { sounds[name]?.source?.stop() } catch { /* already stopped */ }
  }
}