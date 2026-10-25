import { send, sendToUser, broadcastEvent, wsConnectionRegistry } from './ws.js'

// registry of live sessions, where:
// key = 'sessionId',
// value = session data, shape: { id, hostId, players, max, pending }
// 'pending' holds: { id, name } of the requesting user, or otherwise it is null
const sessionRegistry = new Map()

// used to give each session a short, unique id
let sessionCounter = 0

function createSession(creatorId) {
    const id = `session${++sessionCounter}`
    const session = {
        id,
        hostId: creatorId,
        players: new Set([creatorId]),
        max: 2,
        pending: null
    }
    sessionRegistry.set(id, session)
    return session
}

// Session creation handler.
// Only creates a new session if the user does not already have a running session
// (this could occur if they open a new tab and press 'play', for instance. In
// that case that user is notified of their active session).
// Broadcasts to all users a notification for the new session, so that their
// session lobbyview could get updated
export function handleSessionCreate(_msg, { userId, socket }) {
    // clean up user's pending request if there is one, before creating a new session
    giveUpPendingRequest(userId)

    let session = getSessionByUserId(userId)
    if (session) {
        send(socket, { type: 'session_created', session: toSessionView(session) })
    } else {
        session = createSession(userId)
        broadcastEvent({ type: 'session_created', session: toSessionView(session) })
    }
    // tell this client which session is theirs, so its UI can mark it as active
    send(socket, { type: 'session_active', sessionId: session.id })
}

// Join request handler, that expects the shape: { 'join_request', sessionId }
// The request lands in the session's single 'pending' slot, and is forwarded to
// the host, who can decide whether to accept or reject it.
export function handleJoinRequest(msg, { userId, username, socket }) {
    const session = sessionRegistry.get(msg.sessionId)

    // the session has been closed since the request was received
    if (!session) {
        send(socket, { type: 'session_rejected', sessionId: msg.sessionId, reason: 'gone' })
        return
    }

    if (getSessionByUserId(userId) || getPendingSessionByUserId(userId)) {
        send(socket, { type: 'session_rejected', sessionId: session.id, reason: 'already_in_session' })
        return
    }

    // only one join request may be pending per session at a time
    if (session.pending) {
        send(socket, { type: 'session_rejected', sessionId: session.id, reason: 'busy' })
        return
    }

    if (session.players.size >= session.max) {
        send(socket, { type: 'session_rejected', sessionId: session.id, reason: 'full' })
        return
    }

    session.pending = { id: userId, name: username }
    sendToUser(session.hostId, {
        type: 'join_requested',
        sessionId: session.id,
        from: { id: userId, name: username }
    })
}

// function handling a user who withdraws their join request
export function handleJoinCancel(_msg, { userId }) {
    giveUpPendingRequest(userId)
}

// Host has accepted a user's join request. Integrates the user into the session,
// notifies the requester, and updates the session for all connected users
export function handleSessionAccept(msg, { userId, socket }) {
    // find the session the request concerns
    const session = getSessionHostedBy(userId)
    if (!session || msg.from !== session.pending?.id) {
        send(socket, { type: 'error', reason: 'no_such_pending_request' })
        return
    }

    // integrate accepted player to the session
    const acceptedId = session.pending.id
    session.players.add(acceptedId)
    session.pending = null

    // notify the requester, with the host's name so they know who they're playing with
    sendToUser(acceptedId, {
        type: 'session_accepted',
        sessionId: session.id,
        host: wsConnectionRegistry.get(session.hostId)?.username
    })

    // update the whole lobby
    broadcastEvent({ type: 'session_updated', session: toSessionView(session) })
}

// host rejects pending join request
export function handleSessionReject(msg, { userId, socket }) {
    // find the relevant session
    const session = getSessionHostedBy(userId)
    if (!session || msg.from !== session.pending?.id) {
        send(socket, { type: 'error', reason: 'no_such_pending_request' })
        return
    }

    // find the rejected client, and liberate the session's 'pending' seat
    const rejectedId = session.pending.id
    session.pending = null

    // notify requester of their rejection
    sendToUser(rejectedId, {
        type: 'session_rejected',
        sessionId: session.id,
        reason: 'rejected'
    })

    // no need to broadcast an update, since a rejected request is internal only
}

export function handleSessionLeave(_msg, { userId }) {
    leaveSessionAndBroadcastUpdate(userId)
}

// Launchpad action relay, expects the shape: { 'session_action', action: { type, ... } }
// The backend doesn't interpret the action; it forwards it to every player in the
// sender's session, sender included, so that every launchpad applies the same
// actions in the same order. 'mine' tells each recipient whether it sent it, and
// 'sessionId' lets the client drop anything that is not for its current session.
export function handleSessionAction(msg, { userId, socket }) {
    const session = getSessionByUserId(userId)
    if (!session) {
        send(socket, { type: 'error', reason: 'not_in_session' })
        return
    }
    if (typeof msg.action !== 'object' || msg.action === null || typeof msg.action.type !== 'string') {
        send(socket, { type: 'error', reason: 'invalid_action' })
        return
    }

    for (const playerId of session.players) {
        sendToUser(playerId, {
            type: 'session_action',
            sessionId: session.id,
            action: msg.action,
            mine: playerId === userId
        })
    }
}

// A user leaves (explicitly or by disconnecting); adjusts the session state accordingly
function leaveSession(userId) {
    // if the user is was waiting in some session's pending slot, let the host know
    giveUpPendingRequest(userId)

    const session = getSessionByUserId(userId)
    if (!session) {
        return null
    }

    session.players.delete(userId)

    // last player out closes the session
    if (session.players.size == 0) {
        if (session.pending) {
            sendToUser(session.pending.id, {
                type: 'session_rejected',
                sessionId: session.id,
                reason: 'gone'
            })
        }
        sessionRegistry.delete(session.id)
        return { status: 'closed', sessionId: session.id }
    }

    // the host is leaving, but somebody else is still playing; promote them to
    // host, so the session keeps a valid host for future join requests
    if (session.hostId === userId) {
        session.hostId = [...session.players][0]
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

// Tells a connecting or reconnecting client what session or pending request
// they are already part of, so that a page refresh will get them right back
// where they were
export function sendSessionState(socket, userId) {
    const session = getSessionByUserId(userId)
    if (session) {
        send(socket, { type: 'session_active', sessionId: session.id })
        // check if they had a pending join request before refreshing, to avoid
        // losing it
        if (session.hostId === userId && session.pending) {
            send(socket, {
                type: 'join_requested',
                sessionId: session.id,
                from: { id: session.pending.id, name: session.pending.name }
            })
        }
        return
    }

    // The user was not in a session before - but perhaps they had a pending request?
    const pending = getPendingSessionByUserId(userId)
    if (pending) {
        send(socket, { type: 'session_pending', sessionId: pending.id })
    }
}

// finds the session on which a user has a pending join request ->
// frees that pending seat -> notifies the session's host
function giveUpPendingRequest(userId) {
    const session = getPendingSessionByUserId(userId)
    if (!session) {
        return
    }

    const from = session.pending
    session.pending = null
    sendToUser(session.hostId, {
        type: 'join_cancelled',
        sessionId: session.id,
        from: { id: from.id, name: from.name }
    })
}

// find the session a user is currently in (if any)
export function getSessionByUserId(userId) {
    for (const session of sessionRegistry.values()) {
        if (session.players.has(userId)) {
            return session
        }
    }
    return undefined
}

// find the session whose pending slot is occupied by the user parameter
function getPendingSessionByUserId(userId) {
    for (const session of sessionRegistry.values()) {
        if (session.pending?.id === userId)
            return session
    }
    return undefined
}

// find the session a user is currently hosting
function getSessionHostedBy(userId) {
    for (const session of sessionRegistry.values()) {
        if (session.hostId === userId) {
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
