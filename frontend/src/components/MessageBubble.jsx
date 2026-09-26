export default function MessageBubble({ text, fromMe }) {
  return (
    <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`px-3 py-2 rounded-[10px] text-sm font-sans max-w-[75%] ${fromMe ? 'bg-brand/50 text-black' : 'bg-white/10 text-white'}`}>
        {text}
      </div>
    </div>
  )
}
