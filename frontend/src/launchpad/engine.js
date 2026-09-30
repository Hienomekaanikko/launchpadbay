import {
    initAudio,
    loadPadVoice,
    clearPadVoices,
    replaceLoopSource,
    stopSource,
    resetAudio,
    resumeAudio,
    msUntil,
    padVoices,
    audioContext,
    setChannelGain,
    setChannelCutoff,
} from './audio.js'
import {
    CHANNEL_COUNT,
    channelOfPad,
    slotOfPad,
    padDomId,
} from './pads.js'
import {
    updateStutterBtn,
    updateSplitBtn,
    applyTheme,
    startProgressLoop,
    renderPad,
    renderChannel,
} from './ui.js'
import { createClock } from './clock.js'
import { createSplitControl } from './split.js'
import { createStutterControl } from './stutter.js'
import {
    createChannels,
    applyChannelEvent,
    anyChannelActive,
    setPadLoading,
    getPadVisual,
} from './channel.js'
import { createUiTimers } from './uiTimers.js'
import { bindLaunchpadControls } from './bindings.js'

export function mountLaunchpad(container, themes) {
    let isUnmounted = false
    const uiTimers = createUiTimers()

    const clock = createClock()
    const channels = createChannels(CHANNEL_COUNT)
    const startTimers = {} // pad → ui timer that fires at the clip's scheduled start

    initAudio()

    const byId = (domId) => container.querySelector(`#${domId}`)
    const padEl = (pad) => byId(padDomId(pad))

    // --- channel lights ---

    function lightChannel(channelId, event) {
      applyChannelEvent(channels[channelId], event)
      renderChannel(padEl, channels[channelId])
    }

    // --- clip playback ---

    function silencePad(pad) {
      const voice = padVoices[pad]
      if (!voice)
        return null
      if (startTimers[pad]) {
        uiTimers.cancel(startTimers[pad])
        delete startTimers[pad]
      }
      if (voice.source) {
        stopSource(voice.source)
        voice.source = null
      }
      return voice
    }

    function cancelHandoff(channelId) {
      const channel = channels[channelId]
      if (channel.state !== 'queued' || channel.queuedPad == null)
        return

      silencePad(channel.queuedPad)

      // A scheduled stop can't be undone: restart the outgoing loop at the same
      // grid boundary instead, where offset 0 is in phase.
      const outVoice = padVoices[channel.activePad]
      if (outVoice && outVoice.source) {
        outVoice.source = replaceLoopSource(outVoice.source, {
          channelId,
          buffer: outVoice.buffer,
          loopEnd: clock.getLoopLength(),
          when: channel.queuedAt,
        })
      }
      lightChannel(channelId, { type: 'CANCEL_HANDOFF' })
    }

    function scheduleClipAt(voice, pad, when, onStart) {
      voice.source = replaceLoopSource(voice.source, {
        channelId: channelOfPad(pad),
        buffer: voice.buffer,
        loopEnd: clock.getLoopLength(),
        when,
      })

      startTimers[pad] = uiTimers.track(() => {
        delete startTimers[pad]
        onStart()
      }, msUntil(when))
    }

    function armClipAt(pad, when) {
      const voice = padVoices[pad]
      if (!voice)
        return

      const channelId = channelOfPad(pad)
      scheduleClipAt(voice, pad, when, () => {
        if (voice.source)
          lightChannel(channelId, { type: 'STARTED', pad })
      })
      lightChannel(channelId, { type: 'ARM', pad })
    }

    function launchClip(pad) {
      const voice = padVoices[pad]
      if (!voice)
        return

      const now = audioContext.currentTime
      let startTime
      if (!clock.isRunning()) {
        startTime = clock.startClock(now, voice.buffer.duration)
      } else {
        startTime = clock.getNextGrid(now)
      }

      armClipAt(pad, startTime)
    }

    // Fade later: ramp channelGain → 0 over N ms, stop after, restore to
    // the knob level; on next launch reset gain to the knob level at `when`.
    function stopClip(pad) {
      const voice = silencePad(pad)
      if (!voice)
        return

      const channelId = channelOfPad(pad)
      lightChannel(channelId, { type: 'STOP' })

      if (!anyChannelActive(channels))
        resetTransport()
    }

    function resetTransport() {
      split.cancelPendingSplit()
      clock.clear()
    }

    function queueClip(channelId, pad, handoffTime) {
      cancelHandoff(channelId)

      const voice = padVoices[pad]
      if (!voice)
        return

      const outVoice = padVoices[channels[channelId].activePad]
      if (outVoice && outVoice !== voice)
        stopSource(outVoice.source, handoffTime)

      scheduleClipAt(voice, pad, handoffTime, () => {
        // Split may have replaced the outgoing source since it was queued.
        if (outVoice && outVoice !== voice) {
          stopSource(outVoice.source, handoffTime)
          outVoice.source = null
        }
        lightChannel(channelId, { type: 'STARTED', pad })
      })
      lightChannel(channelId, { type: 'QUEUE_HANDOFF', pad, when: handoffTime })
    }

    // --- split / stutter ---

    const split = createSplitControl({
      clock,
      channels,
      uiTimers,
    })

    const stutter = createStutterControl({
      clock,
      channels,
      lightChannel,
      updateBtn: (channelId, depth, activeDepth) =>
        updateStutterBtn(byId, channelId, depth, activeDepth),
      resumeClipAt: armClipAt,
    })

    // --- ui actions ---

    function padHit(pad) {
      resumeAudio()
      const channelId = channelOfPad(pad)
      const channel = channels[channelId]

      if (channel.stutter.activeDepth !== 0)
        stutter.stopStutter(channelId)

      if (channel.activePad === pad) {
        cancelHandoff(channelId)
        stopClip(pad)
      } else if (channel.state === 'queued' && channel.queuedPad === pad) {
        cancelHandoff(channelId)
      } else if (channel.state === 'idle') {
        launchClip(pad)
      } else {
        // Another pad in a playing row: queue a switch (reuse an existing queue time)
        let when = channel.queuedAt
        if (when == null)
          when = clock.getNextGrid(audioContext.currentTime)
        queueClip(channelId, pad, when)
      }
    }

    function handleUiAction(action) {
      switch (action.type) {
        case 'PAD_HIT':
          padHit(action.pad)
          break
        case 'SPLIT_TOGGLE':
          updateSplitBtn(byId, split.toggleSplit())
          break
        case 'STUTTER_TOGGLE':
          stutter.toggleStutter(action.channelId)
          break
        case 'STUTTER_CYCLE':
          stutter.cycleDepth(action.channelId)
          break
        case 'SET_GAIN':
          setChannelGain(action.channelId, action.value / 100)
          break
        case 'SET_FILTER':
          setChannelCutoff(action.channelId, action.value / 100)
          break
        default:
          break
      }
    }

    function stopAllPlayback() {
      stutter.stopAll()
      for (const key of Object.keys(padVoices))
        silencePad(Number(key))
      resetTransport()
    }

    // --- themes ---

    async function loadThemeSounds(theme) {
      stopAllPlayback()
      clearPadVoices()

      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++)
        applyChannelEvent(channels[channelId], { type: 'RESET' })

      const samples = Object.entries(theme.sampleUrls).map(([key, url]) => ({ pad: Number(key), url }))
      for (const { pad } of samples)
        setPadLoading(channels[channelOfPad(pad)], pad, true)

      for (let channelId = 1; channelId <= CHANNEL_COUNT; channelId++) {
        renderChannel(padEl, channels[channelId])
        stutter.refreshBtn(channelId)
      }

      await Promise.all(samples.map(({ pad, url }) =>
        loadPadVoice(pad, url).finally(() => {
          if (isUnmounted)
            return
          const channel = channels[channelOfPad(pad)]
          setPadLoading(channel, pad, false)
          renderPad(padEl, getPadVisual(channel, slotOfPad(pad)))
        })
      ))
    }

    // --- mount / destroy ---

    applyTheme(themes[0])
    const { knobCleanups } = bindLaunchpadControls({
      byId,
      padEl,
      uiTimers,
      handleUiAction,
    })
    const stopProgress = startProgressLoop(byId('master-bar-fill'), () =>
      clock.getPhase(audioContext.currentTime)
    )
    loadThemeSounds(themes[0]).catch((err) => {
      console.error('Launchpad init error:', err)
    })

    function destroy() {
      isUnmounted = true

      stopProgress()
      stopAllPlayback()
      uiTimers.clearAll()

      for (const off of knobCleanups)
        off()
      knobCleanups.length = 0

      resetAudio()

      document.body.style.backgroundImage = ''
      themes.forEach((theme) =>
        theme.bodyClass && document.body.classList.remove(theme.bodyClass))
    }

    return { destroy }
}
