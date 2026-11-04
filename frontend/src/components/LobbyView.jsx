import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassPanel from './GlassPanel.jsx'
import MessageBubble from './MessageBubble.jsx'
import MessageComposer from './MessageComposer.jsx'
import UserRow from './UserRow.jsx'
import FriendRequestRow from './FriendRequestRow.jsx'
import SessionRow from './SessionRow.jsx'
import useStickToBottom from '../useStickToBottom.js'

function LobbyTab({ selected, children, onClick }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${selected ? 'bg-white/15 text-white shadow-sm' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
      {children}
    </button>
  )
}

function FriendsPanel({ friends, incoming, unread, onProfileClick, onChatClick, onAcceptClick, onRejectClick, onRemoveClick }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:break-words">
      {incoming.length > 0 && (
        <section aria-labelledby="lobby-requests-heading">
          <h3 id="lobby-requests-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">{t('profile.requests')}</h3>
          {incoming.map((user) => (
            <FriendRequestRow key={user.id} {...user} onAcceptClick={onAcceptClick} onRejectClick={onRejectClick} />
          ))}
        </section>
      )}
      <section aria-labelledby="lobby-friends-heading">
        <h3 id="lobby-friends-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">{t('profile.friends')}</h3>
        {friends.length === 0
          ? <div className="px-4 py-6 text-white/70 text-sm text-center">{t('profile.noFriends')}</div>
          : friends.map((friend) => <UserRow key={friend.id} {...friend} unread={unread.includes(friend.id)} onProfileClick={onProfileClick} onChatClick={onChatClick} onRemoveClick={onRemoveClick} />)}
      </section>
    </div>
  )
}

// canAddFriend(id) decides whether a row gets the add-friend button
function PlayersOnline({ online, unread, onProfileClick, onChatClick, canAddFriend, onAddFriendClick }) {
  const { t } = useTranslation()
  // someone who wrote to us and then left stays listed until we've read it
  const onlineOnly = online.filter((user) => user.online || unread.includes(user.id))
  return (
    <section aria-labelledby="lobby-online-heading">
      <h3 id="lobby-online-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">{t('lobby.online')}</h3>
      <div className="flex flex-col gap-1">
        {onlineOnly.length === 0
          ? <div className="px-4 py-6 text-white/70 text-sm text-center">{t('lobby.noOneOnline')}</div>
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
    </section>
  )
}

function SessionsList({ sessions, onJoinClick, onCancelClick }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="lobby-sessions-heading">
      <h3 id="lobby-sessions-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">{t('lobby.sessions')}</h3>
      <div className="flex flex-col gap-1">
        {sessions.length === 0
          ? <div className="px-4 py-6 text-white/70 text-sm text-center">{t('lobby.noSessions')}</div>
          : sessions.map((session) => <SessionRow key={session.id} {...session} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />)}
      </div>
    </section>
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
      <div ref={listRef} onScroll={onScroll} className="chat-scrollbar h-[30vh] min-h-24 max-h-48 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white/60 text-xs text-center py-2">{t('lobby.noMessages')}</div>
          : messages.map((message) => message.system
              ? <div key={message.id} className="text-white/60 text-xs text-center py-1">{t(`session.${message.system}`, { username: message.username })}</div>
              : <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
      </div>
      <MessageComposer value={draft} onChange={setDraft} onSubmit={handleSubmit} />
    </div>
  )
}

export default function LobbyView({ online, unread, canAddFriend, onAddFriendClick, activeSession, sessions, onJoinClick, onCancelClick, onProfileClick, onChatClick, sessionMessages, onSendSessionMessage, friends, incoming, onAcceptClick, onRejectClick, onRemoveClick, onFriendsOpen }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('online')
  const currentSession = sessions.find((session) => session.id === activeSession)

  return (
    <GlassPanel className="flex min-h-0 flex-col overflow-hidden bg-surface/30 p-5 text-white">
      <div role="group" aria-label={t('lobby.sections')} className="mb-5 flex shrink-0 gap-1 rounded-xl bg-black/15 p-1">
        <LobbyTab selected={tab === 'online'} onClick={() => setTab('online')}>{t('lobby.online')}</LobbyTab>
        <LobbyTab selected={tab === 'sessions'} onClick={() => setTab('sessions')}>{t('lobby.sessions')}</LobbyTab>
        <LobbyTab selected={tab === 'friends'} onClick={() => {
          if (tab !== 'friends') onFriendsOpen()
          setTab('friends')
        }}>
          {t('profile.friends')}
          {incoming.length > 0 && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold leading-none text-black">
            <span aria-hidden="true">{incoming.length > 99 ? '99+' : incoming.length}</span>
            <span className="sr-only">{t('lobby.pendingRequests', { count: incoming.length })}</span>
          </span>}
        </LobbyTab>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {tab === 'online' && <PlayersOnline online={online} unread={unread} onProfileClick={onProfileClick} onChatClick={onChatClick} canAddFriend={canAddFriend} onAddFriendClick={onAddFriendClick} />}
        {tab === 'sessions' && (activeSession
          ? <section aria-labelledby="lobby-session-chat-heading">
              <h3 id="lobby-session-chat-heading" className="mb-3 break-words text-xs font-medium uppercase tracking-wide text-white/60">{currentSession?.creatorName ? t('session.name', { username: currentSession.creatorName }) : activeSession}</h3>
              <SessionChat messages={sessionMessages} onSendMessage={onSendSessionMessage} />
            </section>
          : <SessionsList sessions={sessions} onJoinClick={onJoinClick} onCancelClick={onCancelClick} />)}
        {tab === 'friends' && <FriendsPanel
          friends={friends}
          incoming={incoming}
          unread={unread}
          onProfileClick={onProfileClick}
          onChatClick={onChatClick}
          onAcceptClick={onAcceptClick}
          onRejectClick={onRejectClick}
          onRemoveClick={onRemoveClick}
        />}
      </div>
    </GlassPanel>
  )
}
