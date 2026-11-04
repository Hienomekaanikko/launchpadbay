export default function MessageBubble({ text, fromMe }) {
  return (
    <div dir="ltr" className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div
        dir="auto"
        className={`px-3 py-2 rounded-[10px] text-sm max-w-[75%]
          ${fromMe ? 'bg-black/15 text-white' : 'bg-white/10 text-white'}`}
      >
        {text}
      </div>
    </div>
  )
}
