import { useEffect, useState } from 'react'
import { onMessage, sendMessage } from './useSocket.js'

const REJECTION_SHOWN_MS = 3000

// Join flow for both sides of a session:
// guest: pendingSessionId while asking, activeSession once accepted, rejection to show why not
// host: incomingRequest ({ sessionId, from: { id, name } }) to accept or reject
// both: partner, the name of the last player we were paired with (whether they're
// still there is up to the session's player count)
export default function useSessionJoin(socket) {
  const [pendingSessionId, setPendingSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [incomingRequest, setIncomingRequest] = useState(null)
  const [rejection, setRejection] = useState(null)
  const [partner, setPartner] = useState(null)

  useEffect(() => {
    if (!socket) {
      setPendingSessionId(null)
      setActiveSession(null)
      setIncomingRequest(null)
      setRejection(null)
      setPartner(null)
      return
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'session_accepted') {
        setPendingSessionId(null)
        setActiveSession(msg.sessionId)
        setPartner(msg.host ?? null)
      } else if (msg.type === 'session_rejected') {
        setPendingSessionId((prev) => (prev === msg.sessionId ? null : prev))
        setRejection({ sessionId: msg.sessionId, reason: msg.reason })
      } else if (msg.type === 'join_requested') {
        setIncomingRequest({ sessionId: msg.sessionId, from: msg.from })
      } else if (msg.type === 'session_active') {
        setActiveSession(msg.sessionId)
        setPendingSessionId(null)
      } else if (msg.type === 'session_pending') {
        setPendingSessionId(msg.sessionId)
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
    setPartner(incomingRequest.from.name)
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
    setPartner(null)
  }

  return { pendingSessionId, activeSession, incomingRequest, rejection, partner, requestJoin, cancelJoin, acceptRequest, rejectRequest, leave }
}
