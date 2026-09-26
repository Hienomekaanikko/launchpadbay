import { useState } from 'react'
import UserRow from './UserRow.jsx'
import SessionRow from './SessionRow.jsx'
import GlassPanel from './GlassPanel.jsx'
import NavButton from './NavButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import MessageBubble from './MessageBubble.jsx'

const MOCK_ONLINE = [
  { username: 'superdj', online: true },
  { username: 'woopwoop', online: false },
  { username: 'duck', online: true },
  { username: 'dude', online: true},
  { username: 'chap', online: true},
  { username: 'goodplayer', online: true}
]

function PlayersOnline({ online, onChatClick }) {
  const onlineOnly = online.filter((user) => user.online)
  return (
    <div className="flex flex-col gap-1">
      {onlineOnly.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No one is online...</div>
        : onlineOnly.map((user) => <UserRow key={user.username} {...user} onChatClick={onChatClick} />)}
    </div>
  )
}

function SessionsList({ sessions, onJoinClick, onCancelClick }) {
  return (
    <div className="flex flex-col gap-1">
      {sessions.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No sessions yet</div>
        : sessions.map((session) => <SessionRow key={session.id} {...session} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />)}
    </div>
  )
}

function SessionChat({ messages, onSendMessage }) {
  const [draft, setDraft] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="h-48 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white/60 text-xs text-center py-2 font-sans">No messages yet</div>
          : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input className="flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
        <FormButton type="submit">Send</FormButton>
      </form>
    </div>
  )
}

export default function LobbyView({ activeSession, sessions, onJoinClick, onCancelClick, onChatClick, sessionMessages, onSendSessionMessage }) {
  const [tab, setTab] = useState('online')

  return (
    <GlassPanel className="bottom-25 px-6 pt-6 bg-surface/30">
      <div className="flex gap-2 mb-3 justify-center">
        <NavButton onClick={() => setTab('online')} className={tab === 'online' ? 'bg-white/30' : 'after:content-none'}>Online</NavButton>
        <NavButton onClick={() => setTab('sessions')} className={tab === 'sessions' ? 'bg-white/30' : 'after:content-none'}>{activeSession ? 'Session-chat' : 'Sessions'}</NavButton>
      </div>
      {tab === 'online'
        ? <PlayersOnline online={MOCK_ONLINE} onChatClick={onChatClick} />
        : activeSession
          ? <SessionChat messages={sessionMessages} onSendMessage={onSendSessionMessage} />
          : <SessionsList sessions={sessions} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />}
    </GlassPanel>
  )
}
