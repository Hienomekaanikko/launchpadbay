import { useState } from 'react'
import GlassPanel from './GlassPanel.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import MessageBubble from './MessageBubble.jsx'

export default function ChatWindow({ recipient, messages, onSendMessage, onClose }) {
  const [draft, setDraft] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendMessage(draft)
    setDraft('')
  }

  return (
    <GlassPanel className="bottom-25 z-30 h-96 flex flex-col gap-3 p-4">
      <CloseButton onClick={onClose}>x</CloseButton>
      <div className="text-white text-sm font-medium font-sans">{recipient}</div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0
          ? <div className="text-white text-xs text-center py-2 font-sans">Say hi to {recipient}!</div>
          : messages.map((message) => <MessageBubble key={message.id} text={message.text} fromMe={message.fromMe} />)}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input className="flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
        <FormButton type="submit">Send</FormButton>
      </form>
    </GlassPanel>
  )
}
