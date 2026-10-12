import { send, broadcastEvent } from './ws.js'

// registry of live sessions, where:
// key = 'sessionId',
// value = session data, shape: { id, players, max }
const sessionRegistry = new Map()

// used to give each session a short, unique id
let sessionCounter = 0

function createSession(creatorId) {
    const id = `session${++sessionCounter}`
    const session = { id, players: new Set([creatorId]), max: 2 }
    sessionRegistry.set(id, session)
    return session
}

// Session creation handler.
// Only creates a new session if the user does not already have a running session
// (this could occur if they open a new tab and press 'play', for instance. In
// that case that user is notified of their active session).
// Broadcasts to all users (except the creator) of the new session, so that their
// session lobbyview could get updated
export function handleSessionCreate(_msg, { userId, socket }) {
    const existingSession = getSessionByUserId(userId)
    if (existingSession) {
        send(socket, { type: 'session_created', session: toSessionView(existingSession) })
        return
    }

    const session = createSession(userId)
    broadcastEvent(
        { type: 'session_created', session: toSessionView(session) },
        { except: userId }
    )
}

function leaveSession(userId) {
    const session = getSessionByUserId(userId)
    if (!session) {
        return null
    }

    session.players.delete(userId)

    if (session.players.size == 0) {
        sessionRegistry.delete(session.id)
        return { status: 'closed', sessionId: session.id }
    }
    return { status: 'updated', session: toSessionView(session) }
}

export function leaveSessionAndBroadcastUpdate(userId) {
    const outcome = leaveSession(userId)
    if (!outcome) {
        return
    }
    if (outcome.status === 'closed') {
        broadcastEvent({ type: 'session_closed', sessionId: outcome.sessionId })
    } else if (outcome.status === 'updated') {
        broadcastEvent({ type: 'session_updated', session: outcome.session })
    }
}

export function handleSessionLeave(_msg, { userId }) {
    leaveSessionAndBroadcastUpdate(userId)
}

// find the session a user is currently in (if any)
function getSessionByUserId(userId) {
    for (const session of sessionRegistry.values()) {
        if (session.players.has(userId)) {
            return session
        }
    }
    return undefined
}

// public session shape used by the frontend
function toSessionView(session) {
    return {
        id: session.id,
        current: session.players.size,
        max: session.max,
        status: (session.players.size >= session.max) ? 'full' : 'open'
    }
}

// returns full snapshot of all active sessions, each in the shape that is
// expected by the frontend: { id, current, max, status }
export function getAllSessionViews() {
    return [...sessionRegistry.values()].map(session => toSessionView(session))
}
