import {
    replaceLoopSource,
    stopSource,
    resumeAudio,
    padVoices,
    audioContext,
} from './audio.js'
import { CHANNEL_COUNT } from './pads.js'

const STUTTER_DEPTHS = [4, 8, 16]

export function createStutterControl({
    clock,
    channels,
    lightChannel,
    updateBtn,
    resumeClipAt,
}) {
    const stutterSources = {}

    function stopStutterSource(channelId, when) {
      stopSource(stutterSources[channelId], when)
      delete stutterSources[channelId]
    }

    function refreshBtn(channelId) {
      const { depth, activeDepth } = channels[channelId].stutter
      updateBtn(channelId, depth, activeDepth)
    }

    function playStutterLoop(channelId, voice, depth, startTime) {
      stutterSources[channelId] = replaceLoopSource(stutterSources[channelId], {
        channelId,
        buffer: voice.buffer,
        loopEnd: clock.getLoopLength() / depth,
        when: startTime,
      })
      lightChannel(channelId, { type: 'STUTTER_ON', depth })
    }

    // Returns true if stutter was started.
    function startStutter(channelId, stutterDepth) {
      const ch = channels[channelId]
      const pad = ch.activePad
      if (!pad || ch.state !== 'playing')
        return false
      const voice = padVoices[pad]
      if (!voice || !voice.buffer)
        return false

      stopStutterSource(channelId)

      const startTime = clock.getNextGrid(audioContext.currentTime, stutterDepth)
      if (voice.source) {
        stopSource(voice.source, startTime)
        voice.source = null
      }

      playStutterLoop(channelId, voice, stutterDepth, startTime)
      return true
    }

    // Stop immediately, without resuming the full loop.
    function stopStutter(channelId) {
      stopStutterSource(channelId)
      lightChannel(channelId, { type: 'STUTTER_OFF' })
      refreshBtn(channelId)
    }

    // Keep stuttering until the next loop boundary, then hand back to the full loop there.
    function releaseStutter(channelId) {
      const pad = channels[channelId].activePad
      if (!pad) {
        stopStutter(channelId)
        return
      }
      const when = clock.getNextGrid(audioContext.currentTime)
      stopStutterSource(channelId, when)
      // ARM clears activeDepth; the pad blinks until the boundary.
      resumeClipAt(pad, when)
      refreshBtn(channelId)
    }

    function toggleStutter(channelId) {
      resumeAudio()
      const ch = channels[channelId]
      if (ch.stutter.activeDepth !== 0)
        releaseStutter(channelId)
      else if (startStutter(channelId, ch.stutter.depth))
        refreshBtn(channelId)
    }

    function cycleDepth(channelId) {
      resumeAudio()
      const ch = channels[channelId]
      const idx = STUTTER_DEPTHS.indexOf(ch.stutter.depth)
      const depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]
      lightChannel(channelId, { type: 'STUTTER_DEPTH', depth })

      const voice = padVoices[ch.activePad]
      if (ch.stutter.activeDepth !== 0 && voice && voice.buffer && stutterSources[channelId]) {
        const startTime = clock.getNextGrid(audioContext.currentTime, depth)
        stopStutterSource(channelId, startTime)
        playStutterLoop(channelId, voice, depth, startTime)
      }
      refreshBtn(channelId)
    }

    function stopAll() {
      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++)
        stopStutterSource(channelId)
    }

    return { toggleStutter, cycleDepth, stopStutter, stopAll, refreshBtn }
}
