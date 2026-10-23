import { useState } from 'react'
import GlassPanel from './GlassPanel.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import MessageBubble from './MessageBubble.jsx'
import { MAX_MESSAGE_CHARS } from '../useChat.js'

// backend error reason → what to tell the user
const ERROR_TEXT = {
  user_offline: (recipient) => `${recipient} is offline, message not sent`,
  no_such_user: (recipient) => `${recipient} doesn't exist anymore, message not sent`,
  message_too_long: () => 'Message too long, not sent',
  empty_message: () => 'Empty message, not sent',
}

export default function ChatWindow({ recipient, messages, error, onSendMessage, onClose }) {
  const [draft, setDraft] = useState('')
  const errorText = error && (ERROR_TEXT[error]?.(recipient) ?? 'Message not sent')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <GlassPanel className="fixed bottom-25 right-12.5 w-[clamp(16rem,22vw,24rem)] max-w-[calc(100vw-4.125rem)] z-30 h-96 max-h-[calc(100vh-12rem)] flex flex-col gap-3 p-4">
      <CloseButton onClick={onClose}>x</CloseButton>
      <div className="text-white text-sm font-medium font-sans">{recipient}</div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white text-xs text-center py-2 font-sans">Say hi to {recipient}!</div>
          : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
        {errorText && <div className="text-white/60 text-xs text-center py-2 font-sans">{errorText}</div>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input className="flex-1 min-w-0" maxLength={MAX_MESSAGE_CHARS} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
        <FormButton type="submit" className="shrink-0">Send</FormButton>
      </form>
    </GlassPanel>
  )
}
