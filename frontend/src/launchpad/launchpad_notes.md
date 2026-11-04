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
- The clock starts on the first launch: `loopOrigin = now + 0.1 s` lookahead, loop length = that clip's duration. It clears when every channel is idle. So after silence, whichever pad is hit first sets the bar; an uploaded clip of another length does too, and stopping everything resets it.
- Every loop node plays from 0 to the loop length. A longer clip is cut there; a shorter one repeats back to back inside the bar.
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

## Session sync

- `useLaunchpadSync.js` connects the engine to the socket while the user is in a session. Outside one, input goes straight to `handleUiAction` as before.
- Input from `bindings.js` goes through `dispatch`. In a session the hook gets it instead and sends `{ type: 'session_action', action }`. The backend relays it to every player in the session, sender included, with `mine: true/false`.
- Pads, split and stutter are applied only when the relay comes back, so both launchpads see the same actions in the same order. Knobs (volume, filter) aren't shared; each player keeps their own mix.
- Joining mid-play: once the samples are loaded the joiner sends `SYNC_REQUEST`; the other player answers with `SYNC_STATE` (`getState()`: loop length, split, and per row the playing pad and stutter division). `applyState()` stops everything the joiner had, then starts those pads on the partner's next loop boundary (sent as `phase`), so both loops run in phase. Until then `#sync-msg` shows a countdown.
- Every relay carries `sessionId`; the hook drops any that aren't for the current session.
- Each player hears only their own launchpad. The snapshot's network travel time isn't compensated (a few ms on a LAN).

## Pad samples (session uploads)

- In a session either player can replace one pad's clip with a WAV. SAMPLES (`PadSampleUpload.jsx`) turns on pick mode: while `engine.setPadPickHandler` is set, `dispatch` routes `PAD_HIT` to the file picker instead of playing the pad. The file goes to `POST /session/pads/:pad/sample` (`backend/padSampleRoutes.js`), lands under `uploads/sounds/session/<sessionId>/`, and the response is `{ pad, url }`.
- The uploader then dispatches `{ type: 'PAD_SAMPLE', pad, url }` like a pad hit, so the relay makes both launchpads swap the clip once (`applyPadSample` → `replacePadSample`). A playing or queued pad is stopped first. Only urls under `/api/uploads/sounds/session/` are accepted, since the backend doesn't inspect actions.
- `padOverrides` (pad → url) travels in `SYNC_STATE` as `overrides`; `applyState` loads them before arming, so a late joiner hears the same kit.
- When the session closes the backend deletes its directory (`sessions.js` → `removeSessionSamples`), and `docker-entrypoint.sh` wipes `uploads/sounds/session/` on every boot. On the client, leaving a session calls `resetPadSamples()`, which puts the theme's clips back; the next session always starts from the default kit.
