import { useEffect, useState } from 'react'

function getOrCreateTabId() {
  let id = sessionStorage.getItem('tabId')
  if (!id) sessionStorage.setItem('tabId', (id = crypto.randomUUID()))
  return id
}

// Waits between reconnect attempts; the last one repeats until we get back in
const RETRY_DELAYS_MS = [1000, 2000, 5000]

// Closes that a retry can't fix: the server ended the connection on purpose (1000,
// e.g. account deleted), the app is open in another tab (1008), bad or expired token (4001)
const NO_RETRY_CODES = [1000, 1008, 4001]

// Opens the app's WebSocket while logged in. The backend keeps only one connection
// per user, so presence, sessions etc. all listen on this same socket.
// If the connection drops (screen lock, wifi, server restart) it reconnects; the new
// socket gets fresh snapshots from the server, and the hooks re-subscribe to it.
// reconnecting: the connection dropped and we haven't got back in yet
export default function useSocket(token) {
  const [socket, setSocket] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    if (!token) return

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${location.host}/api/ws?token=${encodeURIComponent(token)}&tabId=${encodeURIComponent(getOrCreateTabId())}`
    let ws = null
    let retryTimer = null
    let attempts = 0
    let gaveUp = false

    const connect = () => {
      clearTimeout(retryTimer)
      retryTimer = null
      const current = new WebSocket(url)
      current.addEventListener('open', () => {
        attempts = 0
        setReconnecting(false)
      })
      current.addEventListener('close', (event) => {
        // an older socket we already replaced, or we closed it ourselves
        if (current !== ws) return
        if (NO_RETRY_CODES.includes(event.code)) {
          gaveUp = true
          setReconnecting(false)
          return
        }
        setReconnecting(true)
        retryTimer = setTimeout(connect, RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)])
        attempts++
      })
      ws = current
      // the old socket stays in state until the new one replaces it, so the hooks keep
      // their state instead of resetting
      setSocket(current)
    }

    // replaces the socket now instead of waiting for the retry timer
    const reconnectNow = () => {
      const old = ws
      connect()
      old.close()
    }

    // back on the page (e.g. phone unlocked) while waiting to retry: don't wait
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && retryTimer !== null) reconnectNow()
    }

    // the network came back: the old socket may be dead without the browser having
    // noticed yet, so replace it even if it still looks open
    const handleOnline = () => {
      if (!gaveUp && ws.readyState !== WebSocket.CONNECTING) reconnectNow()
    }

    connect()
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('online', handleOnline)
      clearTimeout(retryTimer)
      const old = ws
      ws = null // so its close doesn't schedule a retry
      old.close()
      setSocket(null)
      setReconnecting(false)
    }
  }, [token])

  return { socket, reconnecting }
}

// send() throws while the socket is still connecting, so the message is dropped instead
export function sendMessage(socket, msg) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
}

// Calls handler with every parsed JSON message; returns a function that removes the listener
export function onMessage(socket, handler) {
  const listener = (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    handler(msg)
  }
  socket.addEventListener('message', listener)
  return () => socket.removeEventListener('message', listener)
}

// Calls handler with the close code when the socket closes; returns a function
// that removes the listener
export function onClose(socket, handler) {
  const listener = (event) => handler(event.code)
  socket.addEventListener('close', listener)
  return () => socket.removeEventListener('close', listener)
}

export function useCloseCode(socket) {
  const [code, setCode] = useState(null)

  useEffect(() => {
    if (!socket) return
    setCode(null)
    return onClose(socket, setCode)
  }, [socket])

  return code
}
