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

    const setOnline = (id, online) => {
      setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, online } : user)))
    }

    const connected = ({ id, username }) => {
      setUsers((prev) => prev.some((user) => user.id === id)
        ? prev.map((user) => (user.id === id ? { ...user, online: true } : user))
        : [...prev, { id, username, online: true }]) // registered after our snapshot
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'presence_snapshot') setUsers(msg.users)
      else if (msg.type === 'user_connected') connected(msg)
      else if (msg.type === 'user_disconnected') setOnline(msg.id, false)
      else if (msg.type === 'user_deleted') setUsers((prev) => prev.filter((user) => user.id !== msg.id))
    })
  }, [socket])

  return users
}
