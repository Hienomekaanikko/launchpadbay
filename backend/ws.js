// registry of active WS connections, where:
// key = 'userId',
// value = ws 'entry' data, shape: { username, socket, isAlive }
export const wsConnectionRegistry = new Map()

// Caps incoming WebSocket messages to ~4KB
// Other WebSocket caps are derived from this value, so changes propagate.
// Larger input receives 1009 and closes the WebSocket
export const MAX_WS_BYTES_PER_FRAME = 4096

// used to push connection/session updates from server to client in real time
export function broadcastEvent(payload) {
    const message = JSON.stringify(payload)
    for (const entry of wsConnectionRegistry.values()) {
        try {
            entry.socket.send(message)
        } catch {
            // socket died mid-broadcast; its own 'close'/'error' handler cleans it up
        }
    }
}

// Grace period given to a user whose connection just died, so that a page refresh
// or opening a second tab doesn't drop their running session and online presence
const RECONNECT_GRACE_MS = 7_000

// Map keeping track of grace period countdowns currently running.
// key = userId, value = timer (setTimeout handle)
const pendingLeaves = new Map()

// cleanup function called when a user gets back before their grace period is over
export function cancelPendingLeave(userId) {
    const handle = pendingLeaves.get(userId)
    if (handle !== undefined) {
        clearTimeout(handle)
        pendingLeaves.delete(userId)
    }
}

// used to clean up an entry from the connection registry, when a client leaves
export function removeEntry(userId, entry) {
    // Boil out whether this entry is no longer the registered one: either a newer
    // connection replaced it (reconnect), or it was already removed (e.g. the
    // heartbeat calls terminate(), which fires the 'close' handler again).
    if (wsConnectionRegistry.get(userId) !== entry) {
        return
    }

    // Detach right away, so nothing mistakes this user for reachable
    wsConnectionRegistry.delete(userId)

    cancelPendingLeave(userId) // clear any old pending countdown for that user, if any

    // Create a new alarm for this user. setTimeout() recieves a callback function
    // that fires once the grace period is up (i.e. when the 'alarm' goes off),
    // regardless of whether the user has come back or not. If they do come back
    // within the grace period, 'wsConnectionRegistry' has an entry for its userId.
    pendingLeaves.set(userId, setTimeout(() => {

        // Time is out! Delete this pending leave
        pendingLeaves.delete(userId)

        // Did the user come back since the timeout start?
        if (wsConnectionRegistry.has(userId)) {
            return   // They did return, forget about their disconnect!
        }
        // They did not return, and are definitely gone now. Alert the others
        broadcastEvent({ type: 'user_disconnected', username: entry.username })

    }, RECONNECT_GRACE_MS))
}

async function heartbeatRound() {
    // checks status of all connected WebSockets, by looping through the registry.
    // If a WebSocket's 'isAlive' field is set to false, it means that it has not
    // 'ponged' the 'ping'.
    for (const [userId, entry] of wsConnectionRegistry) {
        if (entry.isAlive === false) {
            entry.socket.terminate()
            removeEntry(userId, entry)
            continue
        }

        // works in tandem with 'pong' handler, which sets 'isAlive' to true
        entry.isAlive = false
        try {
            entry.socket.ping()
        } catch { // ping() throws if socket is already closed or failed to connect
            entry.socket.terminate()
            removeEntry(userId, entry)
        }
    }
}

// sets the heartbeat check to occur every 30 seconds.
// setInterval() is a JavaScript mechanism that schedules events in the main loop
const HEARTBEAT_INTERVAL_MS = 30_000
const heartbeatTimer = setInterval(heartbeatRound, HEARTBEAT_INTERVAL_MS)

// Makes sure that a server will not stay alive when it tries to shut down, just
// because it still has a heartbeat check scheduled for every 30 seconds, or
// some other grace period timer is still pending
export function stopHeartbeat() {
    // clean heartbeat Timer
    clearInterval(heartbeatTimer)

    // clean pending leaves map
    for (const timer of pendingLeaves.values()) {
        clearTimeout(timer)
    }
    pendingLeaves.clear()
}

// helper function serializing and sending a JSON payload to a socket
export const send = (socket, payload) => {
    socket.send(JSON.stringify(payload))
}

// Send a message to a specific user.
// If that user is not connected, do nothing
export function sendToUser(userId, payload) {
    const entry = wsConnectionRegistry.get(userId)
    if (entry) {
        send(entry.socket, payload)
    }
}
