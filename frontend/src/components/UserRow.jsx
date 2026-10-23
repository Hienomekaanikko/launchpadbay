import Icon from './Icon.jsx'

function RowIconButton({ icon, label, onClick, dot = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative p-1 rounded-full text-white/90 hover:text-white hover:bg-white/50 transition-colors"
    >
      <Icon name={icon} className="w-4 h-4" />
      {dot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand" aria-hidden="true" />}
    </button>
  )
}

// Optional actions render only when their handler is passed in.
// unread: they've sent messages we haven't seen; the chat button stays even if they went offline
export default function UserRow({ username, online, unread = false, onChatClick, onAddFriendClick, onRemoveClick }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-online' : 'bg-white/30'}`} />
      <span className="text-white text-sm font-sans flex-1">{username}</span>
      {onAddFriendClick && (
        <RowIconButton icon="user-plus" label={`Add ${username} as a friend`} onClick={() => onAddFriendClick(username)} />
      )}
      {(online || unread) && (
        <RowIconButton
          icon="chat"
          label={`Chat with ${username}${unread ? ' (unread messages)' : ''}`}
          onClick={() => onChatClick?.(username)}
          dot={unread}
        />
      )}
      {onRemoveClick && (
        <RowIconButton icon="close" label={`Remove ${username} from friends`} onClick={() => onRemoveClick(username)} />
      )}
    </div>
  )
}
