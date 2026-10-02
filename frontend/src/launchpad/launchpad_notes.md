# Launchpad notes

## Architecture

- `engine.js`: mounts the launchpad; owns channels, clock and clip playback (launch, queue, stop).
- `channel.js`: per-row state and its transitions (`applyChannelEvent`).
- `audio.js`: AudioContext, per-channel signal chain, sample loading, loop sources.
- `clock.js`: loop origin, loop length and grid math.
- `split.js`, `stutter.js`: the two performance effects.
- `ui.js`, `bindings.js`: DOM rendering and input.
- `pads.js`: pad / channel / slot numbering.

Signal chain per channel: loop source → gain (VOL) → lowpass (LP) → output.

## Channel states

- idle → armed → playing
- playing ↔ queued (queue another pad in the row)
- stop → idle from any state
- Stuttering = playing with `stutter.activeDivision > 0`. Releasing stutter goes armed → playing at the next loop boundary.
- Armed and queued pads blink until their scheduled start.

## Timing

- Every audio start and stop is scheduled on the AudioContext clock at a grid time. UI timers only update the lights.
- The clock starts on the first launch: `loopOrigin = now + 0.1 s` lookahead, loop length = that clip's duration. It clears when every channel is idle.
- Grid: `loopOrigin + n × loopLength / subdivision`. Subdivision 1 = loop boundary, 2 = half loop, 4 / 8 / 16 = stutter slices.
- Launch and queue land on the next loop boundary.
- Queue: the outgoing clip stops and the incoming one starts at the same time. Cancelling retriggers the outgoing loop at that boundary, which keeps it in phase.
- Split halves the loop length and switches at the next half-bar (immediately if the clock is stopped).
- Stutter loops the first 1/division of the clip, starting at the next slice boundary. Queueing another pad keeps stuttering until that loop boundary; stopping the active pad cuts stutter immediately.

## Terms

- pad: 1–25, DOM `#btnN`. channel: a row of 5 pads. slot: 1–5, position within the row.
- voice: `padVoices[pad] = { buffer, playback }`.
- playback: a looping AudioBufferSourceNode. Replaced, never reused, whenever start time or loop length changes. During stutter the channel plays from `stutterLoops[channelId]` instead.
- queue: a pending switch to another pad in the same channel (`queuedPad`, `queuedAt`). Re-queueing keeps `queuedAt`.
