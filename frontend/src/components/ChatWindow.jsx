import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassPanel from './GlassPanel.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import MessageBubble from './MessageBubble.jsx'
import { MAX_MESSAGE_CHARS } from '../useChat.js'
import useStickToBottom from '../useStickToBottom.js'

const ERROR_KEYS = {
  user_offline: 'chat.errors.userOffline',
  no_such_user: 'chat.errors.noSuchUser',
  message_too_long: 'chat.errors.messageTooLong',
  empty_message: 'chat.errors.emptyMessage',
}

export default function ChatWindow({ recipient, recipientOnline, messages, error, onSendMessage, onClose }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const { listRef, onScroll } = useStickToBottom(messages)
  // presence says whether the recipient is offline right now, so a failed send's
  // 'user_offline' error is replaced by the live notice and is gone once they're back
  const errorText = recipientOnline
    ? error && error !== 'user_offline' && t(ERROR_KEYS[error] ?? 'chat.errors.notSent', { name: recipient })
    : t('chat.offline', { name: recipient })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!recipientOnline || !draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <GlassPanel className="fixed bottom-25 end-12.5 w-[clamp(16rem,22vw,24rem)] max-w-[calc(100vw-4.125rem)] z-30 h-96 max-h-[calc(100vh-12rem)] flex flex-col gap-3 p-4">
      <CloseButton onClick={onClose}>x</CloseButton>
      <div className="text-white text-sm font-medium font-sans">{recipient}</div>
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white text-xs text-center py-2 font-sans">{t('chat.sayHi', { name: recipient })}</div>
          : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
        {errorText && <div className="text-white/60 text-xs text-center py-2 font-sans">{errorText}</div>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input className="flex-1 min-w-0" maxLength={MAX_MESSAGE_CHARS} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('common.messagePlaceholder')} />
        <FormButton type="submit" disabled={!recipientOnline} className="shrink-0 disabled:opacity-50 disabled:cursor-default disabled:active:scale-100">{t('common.send')}</FormButton>
      </form>
    </GlassPanel>
  )
}
