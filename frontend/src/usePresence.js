import { useEffect, useState } from 'react'

// Keeps a live list of registered users and their online status.
export default function usePresence(token) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!token) {
      setUsers([])
      return
    }

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${protocol}://${location.host}/api/ws?token=${encodeURIComponent(token)}`)

    const setOnline = (username, online) => {
      setUsers((prev) => prev.some((user) => user.username === username)
        ? prev.map((user) => (user.username === username ? { ...user, online } : user))
        : [...prev, { username, online }]) // registered after our snapshot
    }

    socket.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.type === 'presence_snapshot') setUsers(msg.users)
      else if (msg.type === 'user_connected') setOnline(msg.username, true)
      else if (msg.type === 'user_disconnected') setOnline(msg.username, false)
    }

    return () => {
      socket.close()
    }
  }, [token])

  return users
}
