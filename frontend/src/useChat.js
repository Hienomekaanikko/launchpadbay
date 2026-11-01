import { useEffect, useRef, useState } from 'react'
import { onMessage, sendMessage } from './useSocket.js'

// keeps a message well under the backend's byte cap, even with multi-byte characters
export const MAX_MESSAGE_CHARS = 1000

const SESSION_NOTICE_MS = 4000

// Private chat (conversations keyed by the other user's id) and the current
// session's chat. A message is added only when the backend echoes it back, so
// what's shown is what was actually delivered.
export default function useChat(socket, userId, activeSession) {
  const [conversations, setConversations] = useState({})
  const [activeChat, setActiveChat] = useState(null) // { id, username } of the open chat
  const [unread, setUnread] = useState([]) // ids of users whose new messages we haven't seen
  const [chatError, setChatError] = useState(null) // { to, reason } of the last failed private message, 'to' is an id
  const [sessionMessages, setSessionMessages] = useState([])
  const [sessionNotice, setSessionNotice] = useState(null) // latest joined/left line, shown briefly on top of everything
  // the socket listener needs the open chat, but is only set up once per socket
  const activeChatRef = useRef(null)

  // user: { id, username }, or null to close
  const showChat = (user) => {
    activeChatRef.current = user
    setActiveChat(user)
    if (user) setUnread((prev) => prev.filter((id) => id !== user.id))
  }

  useEffect(() => {
    if (!socket) {
      setConversations({})
      showChat(null)
      setUnread([])
      setChatError(null)
      return
    }

    return onMessage(socket, (msg) => {
      if (msg.type === 'chat_message') {
        const fromMe = msg.from.id === userId
        const other = fromMe ? msg.to : msg.from
        setConversations((prev) => ({
          ...prev,
          [other.id]: [...(prev[other.id] || []), { id: msg.id, text: msg.text, fromMe }],
        }))
        if (fromMe) return
        // someone wrote to us: open their chat, or mark it unread if another one is open
        if (!activeChatRef.current) showChat(other)
        else if (activeChatRef.current.id !== other.id) setUnread((prev) => (prev.includes(other.id) ? prev : [...prev, other.id]))
      } else if (msg.type === 'error' && typeof msg.to === 'string') {
        setChatError({ to: msg.to, reason: msg.reason })
      }
    })
  }, [socket, userId])

  // every session starts with an empty chat; a reconnect within the same session keeps it
  useEffect(() => {
    setSessionMessages([])
  }, [activeSession])

  useEffect(() => {
    if (!socket || !activeSession) return

    // session_joined / session_left become system lines: { id, system: 'joined' | 'left', username }
    return onMessage(socket, (msg) => {
      if (msg.sessionId !== activeSession) return
      if (msg.type === 'session_chat') {
        setSessionMessages((prev) => [...prev, { id: msg.id, text: msg.text, fromMe: msg.from === userId }])
      } else if (msg.type === 'session_joined' || msg.type === 'session_left') {
        const entry = { id: msg.id, system: msg.type === 'session_joined' ? 'joined' : 'left', username: msg.username }
        setSessionMessages((prev) => [...prev, entry])
        setSessionNotice(entry)
      }
    })
  }, [socket, userId, activeSession])

  // a newer notice restarts the countdown
  useEffect(() => {
    if (!sessionNotice) return
    const timer = setTimeout(() => setSessionNotice(null), SESSION_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [sessionNotice])

  // to: the recipient's id
  const sendPrivate = (to, text) => {
    setChatError(null)
    sendMessage(socket, { type: 'chat_message', to, text })
  }

  const sendSession = (text) => {
    sendMessage(socket, { type: 'session_chat', text })
  }

  return {
    conversations,
    activeChat,
    unread,
    // only the open chat's error is shown
    error: chatError && chatError.to === activeChat?.id ? chatError.reason : null,
    sessionMessages,
    sessionNotice,
    openChat: showChat,
    closeChat: () => showChat(null),
    sendPrivate,
    sendSession,
    // the host keeps its session when a new player joins; their chat starts fresh
    clearSessionChat: () => setSessionMessages([]),
  }
}
