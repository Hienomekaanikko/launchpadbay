import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassPanel from './GlassPanel.jsx'
import NavButton from './NavButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import MessageBubble from './MessageBubble.jsx'
import UserRow from './UserRow.jsx'
import SessionRow from './SessionRow.jsx'
import { MAX_MESSAGE_CHARS } from '../useChat.js'
import useStickToBottom from '../useStickToBottom.js'

// canAddFriend(id) decides whether a row gets the add-friend button
function PlayersOnline({ online, unread, onProfileClick, onChatClick, canAddFriend, onAddFriendClick }) {
  const { t } = useTranslation()
  // someone who wrote to us and then left stays listed until we've read it
  const onlineOnly = online.filter((user) => user.online || unread.includes(user.id))
  return (
    <div className="flex flex-col gap-1">
      {onlineOnly.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">{t('lobby.noOneOnline')}</div>
        : onlineOnly.map((user) => (
            <UserRow
              key={user.id}
              {...user}
              unread={unread.includes(user.id)}
              onProfileClick={onProfileClick}
              onChatClick={onChatClick}
              onAddFriendClick={canAddFriend(user.id) ? onAddFriendClick : undefined}
            />
          ))}
    </div>
  )
}

function SessionsList({ sessions, onJoinClick, onCancelClick }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {sessions.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">{t('lobby.noSessions')}</div>
        : sessions.map((session) => <SessionRow key={session.id} {...session} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />)}
    </div>
  )
}

function SessionChat({ messages, onSendMessage }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const { listRef, onScroll } = useStickToBottom(messages)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={listRef} onScroll={onScroll} className="h-[30vh] min-h-24 max-h-48 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white/60 text-xs text-center py-2 font-sans">{t('lobby.noMessages')}</div>
          : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input className="flex-1 min-w-0" maxLength={MAX_MESSAGE_CHARS} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('common.messagePlaceholder')} />
        <FormButton type="submit" className="shrink-0">{t('common.send')}</FormButton>
      </form>
    </div>
  )
}

export default function LobbyView({ online, unread, canAddFriend, onAddFriendClick, activeSession, sessions, onJoinClick, onCancelClick, onProfileClick, onChatClick, sessionMessages, onSendSessionMessage }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('online')

  return (
    <GlassPanel className="min-h-0 overflow-y-auto px-6 pt-6 bg-surface/30">
      <div className="flex gap-2 mb-3 justify-center">
        <NavButton onClick={() => setTab('online')} className={tab === 'online' ? 'bg-white/30' : 'after:content-none'}>{t('lobby.online')}</NavButton>
        <NavButton onClick={() => setTab('sessions')} className={tab === 'sessions' ? 'bg-white/30' : 'after:content-none'}>{activeSession ? t('lobby.sessionChat') : t('lobby.sessions')}</NavButton>
      </div>
      {tab === 'online'
        ? <PlayersOnline online={online} unread={unread} onProfileClick={onProfileClick} onChatClick={onChatClick} canAddFriend={canAddFriend} onAddFriendClick={onAddFriendClick} />
        : activeSession
          ? <SessionChat messages={sessionMessages} onSendMessage={onSendSessionMessage} />
          : <SessionsList sessions={sessions} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />}
    </GlassPanel>
  )
}
