import Icon from './Icon.jsx'

export default function UserRow({ username, online, onChatClick }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-online' : 'bg-white/30'}`} />
      <span className="text-white text-sm font-sans flex-1">{username}</span>
      {online && (
        <button
          type="button"
          onClick={() => onChatClick?.(username)}
          aria-label={`Chat with ${username}`}
          className="p-1 rounded-full text-white/90 hover:text-white hover:bg-white/50 transition-colors"
        >
          <Icon name="chat" className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
