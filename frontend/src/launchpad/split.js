import { replaceLoopSource, msUntil, padVoices, audioContext } from './audio.js'

export function createSplitControl({
    clock,
    channels,
    uiTimers,
}) {
    let pendingTimerId = null

    function cancelPendingSplit() {
      if (!pendingTimerId)
        return
      uiTimers.cancel(pendingTimerId)
      pendingTimerId = null
    }

    function restartActiveSources(when) {
      const loopEnd = clock.getLoopLength()
      for (const ch of Object.values(channels)) {
        if (!ch.activePad)
          continue
        const voice = padVoices[ch.activePad]
        if (!voice || !voice.buffer)
          continue

        voice.source = replaceLoopSource(voice.source, {
          channelId: ch.id,
          buffer: voice.buffer,
          loopEnd,
          when,
        })
      }
    }

    function applySplit(enabled, boundaryTime) {
      const now = audioContext.currentTime
      let when = boundaryTime
      if (when == null || when < now)
        when = now

      const active = clock.setSplit(enabled, when)
      if (clock.isRunning())
        restartActiveSources(when)
      return active
    }

    function toggleSplit() {
      // Pressed again before the boundary: cancel the pending switch.
      if (pendingTimerId) {
        cancelPendingSplit()
        return clock.isSplit()
      }

      const wantSplit = !clock.isSplit()

      if (!clock.isRunning())
        return applySplit(wantSplit, null)

      // ON: next half of the full bar (midpoint or end). OFF: next half-bar.
      const subdivision = wantSplit ? 2 : 1
      const at = clock.getNextGrid(audioContext.currentTime, subdivision)
      pendingTimerId = uiTimers.track(() => {
        pendingTimerId = null
        applySplit(wantSplit, at)
      }, msUntil(at))

      return wantSplit
    }

    return { toggleSplit, cancelPendingSplit }
}
