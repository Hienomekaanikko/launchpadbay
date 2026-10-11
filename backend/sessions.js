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
export function getSessionViews() {
    return [...sessionRegistry.values()].map(session => toSessionView(session))
}
