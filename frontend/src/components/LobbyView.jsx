import { useState } from 'react'
import UserRow from './UserRow.jsx'
import SessionRow from './SessionRow.jsx'
import GlassPanel from './GlassPanel.jsx'
import NavButton from './NavButton.jsx'
import ChatWindow from './ChatWindow.jsx'

const MOCK_ONLINE = [
  { username: 'superdj', online: true },
  { username: 'woopwoop', online: false },
  { username: 'duck', online: true },
  { username: 'dude', online: true},
  { username: 'chap', online: true},
  { username: 'goodplayer', online: true}
]

const INITIAL_SESSIONS = [
  { id: 'session1', current: 1, max: 2, status: 'open' },
  { id: 'session2', current: 2, max: 2, status: 'open' },
  { id: 'session3', current: 1, max: 2, status: 'open' },
]

function PlayersOnline({ online, onChatClick }) {
  return (
    <div className="flex flex-col gap-1">
      {online.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No one is online...</div>
        : online.map((online) => <UserRow key={online.username} {...online} onChatClick={onChatClick} />)}
    </div>
  )
}

function SessionsList({ sessions, onJoinClick }) {
  return (
    <div className="flex flex-col gap-1">
      {sessions.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No sessions yet</div>
        : sessions.map((session) => <SessionRow key={session.id} {...session} onJoinClick={onJoinClick} />)}
    </div>
  )
}

export default function LobbyView() {
  const [tab, setTab] = useState('online')
  const [sessions, setSessions] = useState(INITIAL_SESSIONS)
  const [activeChat, setActiveChat] = useState(null)
  const [conversations, setConversations] = useState({})

  const handleJoinClick = (sessionId) => {
    setSessions((prev) => prev.map((session) =>
      session.id === sessionId ? { ...session, status: 'pending' } : session
    ))
  }

  const handleChatClick = (username) => {
    setActiveChat(username)
  }

  // Local-only for now: appends the message straight to state. Once the
  // WebSocket exists, this becomes "send over the socket" instead, and a
  // socket message handler calls setConversations the same way incoming
  // messages do — ChatWindow itself won't need to change either way.
  const handleSendMessage = (username, text) => {
    setConversations((prev) => ({
      ...prev,
      [username]: [...(prev[username] || []), { id: crypto.randomUUID(), text, fromMe: true }],
    }))
  }

  return (
    <>
      <GlassPanel className="bottom-25 pt-6 bg-surface/30">
        <div className="flex gap-2 mb-3">
          <NavButton onClick={() => setTab('online')} className={tab === 'online' ? 'bg-white/30' : 'after:content-none'}>Online</NavButton>
          <NavButton onClick={() => setTab('sessions')} className={tab === 'sessions' ? 'bg-white/30' : 'after:content-none'}>Sessions</NavButton>
        </div>
        {tab === 'online'
          ? <PlayersOnline online={MOCK_ONLINE} onChatClick={handleChatClick} />
          : <SessionsList sessions={sessions} onJoinClick={handleJoinClick} />}
      </GlassPanel>
      {activeChat && (
        <ChatWindow
          recipient={activeChat}
          messages={conversations[activeChat] || []}
          onSendMessage={(text) => handleSendMessage(activeChat, text)}
          onClose={() => setActiveChat(null)}
        />
      )}
    </>
  )
}
