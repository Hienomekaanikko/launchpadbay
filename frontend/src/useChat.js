import { useEffect, useRef, useState } from 'react'
import { onMessage, sendMessage } from './useSocket.js'

// keeps a message well under the backend's byte cap, even with multi-byte characters
export const MAX_MESSAGE_CHARS = 1000

// Private chat (conversations keyed by the other user's name) and the current
// session's chat. A message is added only when the backend echoes it back, so
// what's shown is what was actually delivered.
export default function useChat(socket, username, activeSession) {
  const [conversations, setConversations] = useState({})
  const [activeChat, setActiveChat] = useState(null)
  const [unread, setUnread] = useState([]) // usernames whose new messages we haven't seen
  const [chatError, setChatError] = useState(null) // { to, reason } of the last failed private message
  const [sessionMessages, setSessionMessages] = useState([])
  // the socket listener needs the open chat, but is only set up once per socket
  const activeChatRef = useRef(null)

  const showChat = (name) => {
    activeChatRef.current = name
    setActiveChat(name)
    if (name) setUnread((prev) => prev.filter((user) => user !== name))
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
        const fromMe = msg.from === username
        const other = fromMe ? msg.to : msg.from
        setConversations((prev) => ({
          ...prev,
          [other]: [...(prev[other] || []), { id: msg.id, text: msg.text, fromMe }],
        }))
        if (fromMe) return
        // someone wrote to us: open their chat, or mark it unread if another one is open
        if (!activeChatRef.current) showChat(other)
        else if (activeChatRef.current !== other) setUnread((prev) => (prev.includes(other) ? prev : [...prev, other]))
      } else if (msg.type === 'error' && typeof msg.to === 'string') {
        setChatError({ to: msg.to, reason: msg.reason })
      }
    })
  }, [socket, username])

  // every session starts with an empty chat; a reconnect within the same session keeps it
  useEffect(() => {
    setSessionMessages([])
  }, [activeSession])

  useEffect(() => {
    if (!socket || !activeSession) return

    return onMessage(socket, (msg) => {
      if (msg.type !== 'session_chat' || msg.sessionId !== activeSession) return
      setSessionMessages((prev) => [...prev, { id: msg.id, text: msg.text, fromMe: msg.from === username }])
    })
  }, [socket, username, activeSession])

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
    error: chatError?.to === activeChat ? chatError.reason : null,
    sessionMessages,
    openChat: showChat,
    closeChat: () => showChat(null),
    sendPrivate,
    sendSession,
    // the host keeps its session when a new player joins; their chat starts fresh
    clearSessionChat: () => setSessionMessages([]),
  }
}
