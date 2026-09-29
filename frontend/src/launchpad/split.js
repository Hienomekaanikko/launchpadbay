import { replaceLoopSource, padVoices, audioContext } from './audio.js'

export function createSplitControl({
    clock,
    channels,
    uiTimers,
}) {
    let pending = null // { enabled, timerId } | null

    function cancelPendingSplit() {
      if (!pending)
        return
      uiTimers.cancel(pending.timerId)
      pending = null
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
      const desired = pending ? !pending.enabled : !clock.isSplit()

      if (!clock.isRunning()) {
        cancelPendingSplit()
        return applySplit(desired, null)
      }

      if (desired === clock.isSplit()) {
        cancelPendingSplit()
        return clock.isSplit()
      }

      // ON: next half of the full bar (midpoint or end). OFF: next half-bar.
      const subdivision = desired ? 2 : 1
      const now = audioContext.currentTime
      const at = clock.getNextGrid(now, subdivision)
      const delayMs = ((at - now) * 1000) | 0
      const timerId = uiTimers.track(() => {
        if (!pending)
          return
        const { enabled } = pending
        pending = null
        applySplit(enabled, at)
      }, delayMs)

      pending = { enabled: desired, timerId }
      return desired
    }

    return { toggleSplit, cancelPendingSplit }
}
