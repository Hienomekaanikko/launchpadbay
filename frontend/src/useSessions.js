import { useEffect, useState } from 'react'
import { onMessage } from './useSocket.js'

// Keeps a live list of active sessions: [{ id, current, max, status: 'open' | 'full' }]
export default function useSessions(socket) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!socket) {
      setSessions([])
      return
    }

    // replaces the session with the same id, or appends it if it's new
    const upsert = (session) => {
      setSessions((prev) => prev.some((s) => s.id === session.id)
        ? prev.map((s) => (s.id === session.id ? session : s))
        : [...prev, session])
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'sessions_snapshot') setSessions(msg.sessions)
      // upsert: the server re-sends our existing session if we already have one
      else if (msg.type === 'session_created') upsert(msg.session)
      else if (msg.type === 'session_updated') upsert(msg.session)
      else if (msg.type === 'session_closed') setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId))
    })
  }, [socket])

  return sessions
}
