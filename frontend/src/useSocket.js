import { useEffect, useState } from 'react'

// Opens the app's WebSocket while logged in. The backend keeps only one connection
// per user, so presence, sessions etc. all listen on this same socket.
export default function useSocket(token) {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!token) return

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${location.host}/api/ws?token=${encodeURIComponent(token)}`)
    setSocket(ws)

    return () => {
      ws.close()
      setSocket(null)
    }
  }, [token])

  return socket
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
