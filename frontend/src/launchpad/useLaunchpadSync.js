import { useEffect } from 'react'
import { onMessage, sendMessage } from '../useSocket.js'

const isKnob = (action) => action.type === 'SET_GAIN' || action.type === 'SET_FILTER'

// Shares launchpad input with the other player while in a session.
// Pads, split and stutter are only sent: the backend echoes them to everyone,
// sender included, and every launchpad applies them in that same order, so a
// toggle hit by both players at once can't leave the two out of sync.
// Knobs (volume, filter) aren't shared: each player keeps their own mix.
// A player who joins mid-play asks for a snapshot (SYNC_REQUEST) once their
// samples are loaded, and the other player answers with SYNC_STATE.
export default function useLaunchpadSync(engine, socket, activeSession) {
  useEffect(() => {
    if (!engine || !socket || !activeSession) return

    const send = (action) => sendMessage(socket, { type: 'session_action', action })

    engine.setActionHandler((action) => {
      // knobs stay local; socket down: keep playing alone rather than swallowing the click
      if (isKnob(action) || socket.readyState !== WebSocket.OPEN)
        engine.applyAction(action)
      else
        send(action)
    })

    const stopListening = onMessage(socket, (msg) => {
      // a late relay from a session we already left must not touch this one
      if (msg.type !== 'session_action' || msg.sessionId !== activeSession) return
      const { action, mine } = msg
      if (action.type === 'SYNC_REQUEST') {
        if (!mine) send({ type: 'SYNC_STATE', state: engine.getState() })
      } else if (action.type === 'SYNC_STATE') {
        if (!mine) engine.applyState(action.state)
      } else {
        engine.applyAction(action)
      }
    })

    // the host sends this too when its session starts; nobody else is there yet to answer
    send({ type: 'SYNC_REQUEST' })

    return () => {
      engine.setActionHandler(null)
      stopListening()
    }
  }, [engine, socket, activeSession])
}
