import { launchLoop, audioTimeToDelayMs, padVoices, audioContext } from './audio.js'

export function createSplitControl({
    clock,
    channels,
    uiTimers,
}) {
    let pendingUiTimerId = null

    function cancelPendingSplit() {
      if (!pendingUiTimerId)
        return
      uiTimers.cancel(pendingUiTimerId)
      pendingUiTimerId = null
    }

    function retriggerActiveLoops(when) {
      const loopLength = clock.getLoopLength()
      for (const ch of Object.values(channels)) {
        if (!ch.activePad)
          continue
        const voice = padVoices[ch.activePad]
        if (!voice || !voice.buffer)
          continue

        voice.playback = launchLoop(voice.playback, {
          channelId: ch.id,
          buffer: voice.buffer,
          loopLength,
          when,
        })
      }
    }

    function commitSplit(enabled, when) {
      if (when == null) {
        clock.setSplit(enabled)
        return
      }
      when = Math.max(when, audioContext.currentTime)
      clock.setSplit(enabled, when)
      retriggerActiveLoops(when)
    }

    function toggleSplit() {
      // Pressed again before the switch lands: cancel it.
      if (pendingUiTimerId) {
        cancelPendingSplit()
        return clock.isSplit()
      }

      const wantSplit = !clock.isSplit()

      if (!clock.isRunning()) {
        commitSplit(wantSplit)
        return wantSplit
      }

      // ON: next half of the full bar (midpoint or end). OFF: next half-bar.
      const subdivision = wantSplit ? 2 : 1
      const at = clock.getNextGrid(audioContext.currentTime, subdivision)
      pendingUiTimerId = uiTimers.track(() => {
        pendingUiTimerId = null
        commitSplit(wantSplit, at)
      }, audioTimeToDelayMs(at))

      return wantSplit
    }

    return { toggleSplit, cancelPendingSplit }
}
