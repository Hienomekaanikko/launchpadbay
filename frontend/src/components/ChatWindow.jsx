import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassPanel from './GlassPanel.jsx'
import Icon from './Icon.jsx'
import MessageBubble from './MessageBubble.jsx'
import MessageComposer from './MessageComposer.jsx'
import UserProfileDetails from './UserProfileDetails.jsx'
import NotificationDot from './NotificationDot.jsx'
import useStickToBottom from '../useStickToBottom.js'

const ERROR_KEYS = {
  user_offline: 'chat.errors.userOffline',
  no_such_user: 'chat.errors.noSuchUser',
  message_too_long: 'chat.errors.messageTooLong',
  empty_message: 'chat.errors.emptyMessage',
  rate_limited: 'chat.errors.rateLimited',
}

export default function ChatWindow({ token, socket, recipient, recipientOnline, unread, friendStatus, onAddFriendClick, onRemoveClick, onProfileClick, onChatClick, messages, error, onSendMessage, onClose }) {
  const { t } = useTranslation()
  const headingId = useId()
  const [draft, setDraft] = useState('')
  const viewingProfile = recipient.view === 'profile'
  const { listRef, onScroll } = useStickToBottom(messages, !viewingProfile)
  // presence says whether the recipient is offline right now, so a failed send's
  // 'user_offline' error is replaced by the live notice and is gone once they're back
  const errorText = recipientOnline
    ? error && error !== 'user_offline' && t(ERROR_KEYS[error] ?? 'chat.errors.notSent', { name: recipient.username })
    : t('chat.offline', { name: recipient.username })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!recipientOnline || !draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <GlassPanel role="dialog" aria-labelledby={headingId} className="fixed bottom-6 end-4 z-30 flex h-[480px] max-h-[calc(100svh-var(--app-nav-height)-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col bg-surface/30 p-0 text-white sm:end-[max(16px,calc((100vw-1120px)/2+24px))]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4">
        <button type="button" onClick={() => onChatClick(recipient)} aria-label={t(unread ? 'friends.chatWithUnread' : 'friends.chatWith', { username: recipient.username })} aria-pressed={!viewingProfile} className={`relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${viewingProfile ? 'bg-black/15' : 'bg-white/15'}`}>
          <Icon name="chat" className="size-5 text-white/80" />
          {unread && <NotificationDot className="top-1.5 end-1.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-base font-semibold">
            <button type="button" onClick={() => onProfileClick(recipient)} aria-label={t('nav.profileFor', { username: recipient.username })} aria-pressed={viewingProfile} className="block max-w-full cursor-pointer truncate rounded-md text-start transition-colors hover:text-white/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {recipient.username}
            </button>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/65">
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${recipientOnline ? 'bg-online' : 'bg-white/35'}`} />
            {t(recipientOnline ? 'friends.online' : 'friends.offline')}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <Icon name="close" className="size-5" />
        </button>
      </header>
      {viewingProfile && (
        <UserProfileDetails token={token} socket={socket} recipient={recipient} friendStatus={friendStatus} onAddFriendClick={onAddFriendClick} onRemoveClick={onRemoveClick} />
      )}
      <div className={viewingProfile ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <div ref={listRef} onScroll={onScroll} className="chat-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5 [overflow-wrap:anywhere]">
          {messages.length === 0
            ? <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
                  <Icon name="chat" className="size-7 text-white/60" />
                </div>
                <p className="max-w-[26ch] text-sm leading-relaxed text-white/70">{t('chat.sayHi', { name: recipient.username })}</p>
              </div>
            : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
          {errorText && <div className="text-white/60 text-xs text-center py-2">{errorText}</div>}
        </div>
        <MessageComposer value={draft} onChange={setDraft} onSubmit={handleSubmit} disabled={!recipientOnline} className="border-t border-white/10 p-4" />
      </div>
    </GlassPanel>
  )
}
