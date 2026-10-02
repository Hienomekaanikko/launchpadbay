import {
    launchLoop,
    stopLoop,
    resumeAudio,
    padVoices,
    audioContext,
} from './audio.js'
import { CHANNEL_COUNT } from './pads.js'

const STUTTER_DIVISIONS = [4, 8, 16]

export function createStutterControl({
    clock,
    channels,
    lightChannel,
    updateBtn,
    resumeClipAt,
}) {
    const stutterLoops = {}

    function stopStutterLoop(channelId, when) {
      stopLoop(stutterLoops[channelId], when)
      delete stutterLoops[channelId]
    }

    function refreshBtn(channelId) {
      const { division, activeDivision } = channels[channelId].stutter
      updateBtn(channelId, division, activeDivision)
    }

    function playStutterLoop(channelId, voice, division, startTime) {
      stutterLoops[channelId] = launchLoop(stutterLoops[channelId], {
        channelId,
        buffer: voice.buffer,
        loopLength: clock.getLoopLength() / division,
        when: startTime,
      })
      lightChannel(channelId, { type: 'STUTTER_ON', division })
    }

    function startStutter(channelId, division) {
      const ch = channels[channelId]
      const pad = ch.activePad
      if (!pad || ch.state !== 'playing')
        return
      const voice = padVoices[pad]
      if (!voice || !voice.buffer)
        return

      stopStutterLoop(channelId)

      const startTime = clock.getNextGrid(audioContext.currentTime, division)
      if (voice.playback) {
        stopLoop(voice.playback, startTime)
        voice.playback = null
      }

      playStutterLoop(channelId, voice, division, startTime)
      refreshBtn(channelId)
    }

    // Stop immediately, without resuming the full loop.
    function stopStutter(channelId) {
      stopStutterLoop(channelId)
      lightChannel(channelId, { type: 'STUTTER_OFF' })
      refreshBtn(channelId)
    }

    // Keep stuttering until `when`, then go quiet (caller starts the next clip there).
    function stopStutterAt(channelId, when) {
      if (channels[channelId].stutter.activeDivision === 0)
        return
      stopStutterLoop(channelId, when)
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
      stopStutterAt(channelId, when)
      resumeClipAt(pad, when)
    }

    function toggleStutter(channelId) {
      resumeAudio()
      const ch = channels[channelId]
      if (ch.stutter.activeDivision !== 0)
        releaseStutter(channelId)
      else
        startStutter(channelId, ch.stutter.division)
    }

    function cycleDivision(channelId) {
      resumeAudio()
      const ch = channels[channelId]
      const idx = STUTTER_DIVISIONS.indexOf(ch.stutter.division)
      const division = STUTTER_DIVISIONS[(idx + 1) % STUTTER_DIVISIONS.length]
      lightChannel(channelId, { type: 'STUTTER_DIVISION', division })

      const voice = padVoices[ch.activePad]
      if (ch.stutter.activeDivision !== 0 && voice && voice.buffer && stutterLoops[channelId]) {
        const startTime = clock.getNextGrid(audioContext.currentTime, division)
        playStutterLoop(channelId, voice, division, startTime)
      }
      refreshBtn(channelId)
    }

    function stopAll() {
      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++)
        stopStutterLoop(channelId)
    }

    return { toggleStutter, cycleDivision, stopStutter, stopStutterAt, stopAll, refreshBtn }
}
