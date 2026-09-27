// Per-channel stutter: short loop slice quantized to depth grid (1/4, 1/8, 1/16).
// Engage/depth-change snap to depth grid; release keeps chopping until next full/half bar.

import { replaceLoopSource, stopSource } from './audio.js'
import { CHANNEL_COUNT } from './pads.js'

const STUTTER_DEPTHS = [4, 8, 16]

export function createStutterControl({
  clock,
  channels,
  padVoices,
  getCurrentTime,
  dispatchChannelEvent,
  updateBtn,
  resumeLoopAt,
  ensureAudioRunning,
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

  function armStutterSource(channelId, voice, depth, startTime) {
    stutterSources[channelId] = replaceLoopSource(
      channelId,
      voice.buffer,
      clock.getLoopLength() / depth,
      startTime,
      stutterSources[channelId],
    )
    dispatchChannelEvent(channelId, { type: 'STUTTER_ON', depth })
  }

  function startStutter(channelId, stutterDepth) {
    const ch = channels[channelId]
    const pad = ch.activePad
    if (!pad || ch.state !== 'playing') return
    const voice = padVoices[pad]
    if (!voice || !voice.buffer) return

    stopStutterSource(channelId)

    const startTime = clock.getNextGrid(getCurrentTime(), stutterDepth)
    if (voice.source) {
      stopSource(voice.source, startTime)
      voice.source = null
    }

    armStutterSource(channelId, voice, stutterDepth, startTime)
  }

  function end(channelId, options) {
    if (!options) options = {}
    if (options.resume) {
      const pad = channels[channelId].activePad
      if (!pad) {
        stopStutterSource(channelId)
        dispatchChannelEvent(channelId, { type: 'STUTTER_OFF' })
        refreshBtn(channelId)
        return
      }
      // Keep stutter until next full/half bar; hand off to full loop at same `when`.
      const when = clock.getNextGrid(getCurrentTime())
      stopStutterSource(channelId, when)
      // resumeLoopAt → ARM from stuttering (clears activeDepth, blinks until boundary)
      resumeLoopAt(pad, when)
    } else {
      stopStutterSource(channelId)
      dispatchChannelEvent(channelId, { type: 'STUTTER_OFF' })
    }
    refreshBtn(channelId)
  }

  function tap(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    if (ch.stutter.activeDepth !== 0) {
      end(channelId, { resume: true })
    } else {
      startStutter(channelId, ch.stutter.depth)
      if (stutterSources[channelId]) refreshBtn(channelId)
    }
  }

  function cycleDepth(channelId) {
    ensureAudioRunning()
    const ch = channels[channelId]
    const idx = STUTTER_DEPTHS.indexOf(ch.stutter.depth)
    const depth = STUTTER_DEPTHS[(idx + 1) % STUTTER_DEPTHS.length]
    dispatchChannelEvent(channelId, { type: 'STUTTER_DEPTH', depth })

    const next = channels[channelId]
    if (next.stutter.activeDepth !== 0) {
      const pad = next.activePad
      let voice = null
      if (pad) voice = padVoices[pad]
      if (voice && voice.buffer && stutterSources[channelId]) {
        const startTime = clock.getNextGrid(getCurrentTime(), depth)
        stopStutterSource(channelId, startTime)
        armStutterSource(channelId, voice, depth, startTime)
      }
    }
    refreshBtn(channelId)
  }

  function stopAll() {
    for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
      stopStutterSource(channelId)
    }
  }

  return { tap, cycleDepth, end, stopAll, refreshBtn }
}
