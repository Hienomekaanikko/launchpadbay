import { CHANNEL_COUNT } from './pads.js'

const MIN_CUTOFF_HZ = 200
const MAX_CUTOFF_HZ = 20000
const FILTER_Q = 0.5
const KNOB_SMOOTHING_SEC = 0.01

export let audioContext = null
const channelGains = {}
const channelFilters = {}
export const padVoices = {} // pad → { buffer, source }
const bufferCache = new Map() // url → Promise<AudioBuffer>

// Per channel: source → gain → lowpass → destination
export function initAudio() {
    audioContext = new AudioContext()
    for (let channel = 1; channel <= CHANNEL_COUNT; channel++) {
      const filter = audioContext.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = MAX_CUTOFF_HZ
      filter.Q.value = FILTER_Q
      filter.connect(audioContext.destination)
      channelFilters[channel] = filter
      const gain = audioContext.createGain()
      gain.connect(filter)
      channelGains[channel] = gain
    }
}

export function resumeAudio() {
    if (audioContext.state === 'suspended')
      audioContext.resume()
}

// level: 0..1
export function setChannelGain(channelId, level) {
    channelGains[channelId].gain.setTargetAtTime(
      level,
      audioContext.currentTime,
      KNOB_SMOOTHING_SEC,
    )
}

// value: 0..1, swept exponentially from MIN_CUTOFF_HZ to MAX_CUTOFF_HZ
export function setChannelCutoff(channelId, value) {
    const hz = MIN_CUTOFF_HZ * Math.pow(MAX_CUTOFF_HZ / MIN_CUTOFF_HZ, value)
    channelFilters[channelId].frequency.setTargetAtTime(
      hz,
      audioContext.currentTime,
      KNOB_SMOOTHING_SEC,
    )
}

async function fetchAndDecode(url) {
    const httpResponse = await fetch(url)
    if (!httpResponse.ok)
      throw new Error(`Failed to load ${url}: HTTP ${httpResponse.status}`)
    const rawAudio = await httpResponse.arrayBuffer()
    return audioContext.decodeAudioData(rawAudio)
}

function loadBuffer(url) {
    if (!bufferCache.has(url)) {
      const loading = fetchAndDecode(url).catch((err) => {
        bufferCache.delete(url)
        throw err
      })
      bufferCache.set(url, loading)
    }
    return bufferCache.get(url)
}

export async function loadPadVoice(pad, url) {
    const buffer = await loadBuffer(url)
    padVoices[pad] = { buffer, source: null }
}

export function clearPadVoices() {
    for (const voice of Object.values(padVoices))
      stopSource(voice.source)
    for (const key of Object.keys(padVoices))
      delete padVoices[key]
}

function createLoopSource(buffer, loopEnd) {
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopEnd = loopEnd
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

// Stops previousSource and starts a new loop at the same `when`.
export function replaceLoopSource(previousSource, { channelId, buffer, loopEnd, when }) {
    stopSource(previousSource, when)
    const source = createLoopSource(buffer, loopEnd)
    source.connect(channelGains[channelId])
    source.start(when)
    return source
}

export function resetAudio() {
    clearPadVoices()
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
