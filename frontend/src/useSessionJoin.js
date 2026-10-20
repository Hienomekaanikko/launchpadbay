import { useEffect, useState } from 'react'
import { onMessage, sendMessage } from './useSocket.js'

const REJECTION_SHOWN_MS = 3000

// Join flow for both sides of a session:
// guest: pendingSessionId while asking, activeSession once accepted, rejection to show why not
// host: incomingRequest ({ sessionId, from: { id, name } }) to accept or reject
export default function useSessionJoin(socket) {
  const [pendingSessionId, setPendingSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [incomingRequest, setIncomingRequest] = useState(null)
  const [rejection, setRejection] = useState(null)

  useEffect(() => {
    if (!socket) {
      setPendingSessionId(null)
      setActiveSession(null)
      setIncomingRequest(null)
      setRejection(null)
      return
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'session_accepted') {
        setPendingSessionId(null)
        setActiveSession(msg.sessionId)
      } else if (msg.type === 'session_rejected') {
        setPendingSessionId((prev) => (prev === msg.sessionId ? null : prev))
        setRejection({ sessionId: msg.sessionId, reason: msg.reason })
      } else if (msg.type === 'join_requested') {
        // requests only go to the host, so this also tells us which session is ours
        // (stand-in until the backend sends a host field with each session)
        setActiveSession(msg.sessionId)
        setIncomingRequest({ sessionId: msg.sessionId, from: msg.from })
      } else if (msg.type === 'join_cancelled') {
        setIncomingRequest(null)
      }
    })
  }, [socket])

  // the rejection reason is only shown briefly on the session row
  useEffect(() => {
    if (!rejection) return
    const timer = setTimeout(() => setRejection(null), REJECTION_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [rejection])

  const requestJoin = (sessionId) => {
    sendMessage(socket, { type: 'join_request', sessionId })
    setPendingSessionId(sessionId)
    setRejection(null)
  }

  const cancelJoin = () => {
    sendMessage(socket, { type: 'join_cancel' })
    setPendingSessionId(null)
  }

  const acceptRequest = () => {
    sendMessage(socket, { type: 'session_accept', from: incomingRequest.from.id })
    setIncomingRequest(null)
  }

  const rejectRequest = () => {
    sendMessage(socket, { type: 'session_reject', from: incomingRequest.from.id })
    setIncomingRequest(null)
  }

  const leave = () => {
    sendMessage(socket, { type: 'session_leave' })
    setActiveSession(null)
    setIncomingRequest(null)
  }

  return { pendingSessionId, activeSession, incomingRequest, rejection, requestJoin, cancelJoin, acceptRequest, rejectRequest, leave }
}
