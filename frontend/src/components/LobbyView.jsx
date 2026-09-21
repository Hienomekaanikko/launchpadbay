import { useState } from 'react'
import UserRow from './UserRow.jsx'
import SessionRow from './SessionRow.jsx'
import GlassPanel from './GlassPanel.jsx'
import NavButton from './NavButton.jsx'

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

function PlayersOnline({ online }) {
  return (
    <div className="flex flex-col gap-1">
      {online.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No one is online...</div>
        : online.map((online) => <UserRow key={online.username} {...online} />)}
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

  const handleJoinClick = (sessionId) => {
    setSessions((prev) => prev.map((session) =>
      session.id === sessionId ? { ...session, status: 'pending' } : session
    ))
  }

  return (
    <GlassPanel className="bottom-25 pt-6 bg-surface/30">
      <div className="flex gap-2 mb-3">
        <NavButton onClick={() => setTab('online')} className={tab === 'online' ? 'bg-white/30' : 'after:content-none'}>Online</NavButton>
        <NavButton onClick={() => setTab('sessions')} className={tab === 'sessions' ? 'bg-white/30' : 'after:content-none'}>Sessions</NavButton>
      </div>
      {tab === 'online' ? <PlayersOnline online={MOCK_ONLINE} /> : <SessionsList sessions={sessions} onJoinClick={handleJoinClick} />}
    </GlassPanel>
  )
}
