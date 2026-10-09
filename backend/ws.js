// registry of active WS connections, where:
// key = 'userId',
// value = ws 'entry' data, shape: { username, socket, isAlive }
export const wsConnectionRegistry = new Map()

// used to push connection status update from server to client in real time (WebSocket)
export function broadcastPresenceUpdate(payload) {
    const message = JSON.stringify(payload)
    for (const entry of wsConnectionRegistry.values()) {
        try {
            entry.socket.send(message)
        } catch {
            // socket died mid-broadcast; its own 'close'/'error' handler cleans it up
        }
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

    // delete the client first, to avoid sending it a presence update notification
    wsConnectionRegistry.delete(userId)
    broadcastPresenceUpdate({ type: 'user_disconnected', username: entry.username })
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
// because it still has a heartbeat check scheduled for every 30 seconds
export function stopHeartbeat() {
    clearInterval(heartbeatTimer)
}

// helper function serializing and sending a JSON payload to a socket
export const send = (socket, payload) => {
    socket.send(JSON.stringify(payload))
}
