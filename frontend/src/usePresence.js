import { useEffect, useState } from 'react'
import { onMessage } from './useSocket.js'

// Keeps a live list of online users.
export default function usePresence(socket) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!socket) {
      setUsers([])
      return
    }

    const setOnline = (username, online) => {
      setUsers((prev) => prev.some((user) => user.username === username)
        ? prev.map((user) => (user.username === username ? { ...user, online } : user))
        : [...prev, { username, online }]) // registered after our snapshot
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'presence_snapshot') setUsers(msg.users)
      else if (msg.type === 'user_connected') setOnline(msg.username, true)
      else if (msg.type === 'user_disconnected') setOnline(msg.username, false)
    })
  }, [socket])

  return users
}
