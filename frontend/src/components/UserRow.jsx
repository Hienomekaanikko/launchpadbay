import { useTranslation } from 'react-i18next'
import Icon from './Icon.jsx'
import NotificationDot from './NotificationDot.jsx'

function RowIconButton({ icon, label, onClick, dot = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center p-1 rounded-full text-white/90 hover:text-white hover:bg-white/50 transition-colors"
    >
      <span className="relative inline-flex size-4 shrink-0">
        <Icon name={icon} className="size-4" />
        {dot && <NotificationDot className="-top-1.5 -end-1.5" />}
      </span>
    </button>
  )
}

// Optional actions render only when their handler is passed in; each gets the row's { id, username }.
// unread: they've sent messages we haven't seen; the chat button stays even if they went offline
export default function UserRow({ id, username, online, unread = false, onProfileClick, onChatClick, onAddFriendClick, onRemoveClick }) {
  const { t } = useTranslation()
  const user = { id, username }
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-online' : 'bg-white/30'}`} />
      {onProfileClick
        ? <button type="button" onClick={() => onProfileClick(user)} className="min-h-11 min-w-11 break-words text-white text-sm flex-1 text-start cursor-pointer hover:underline underline-offset-4">{username}</button>
        : <span className="text-white text-sm flex-1">{username}</span>}
      {onAddFriendClick && (
        <RowIconButton icon="user-plus" label={t('friends.add', { username })} onClick={() => onAddFriendClick(user)} />
      )}
      {(online || unread) && (
        <RowIconButton
          icon="chat"
          label={t(unread ? 'friends.chatWithUnread' : 'friends.chatWith', { username })}
          onClick={() => onChatClick?.(user)}
          dot={unread}
        />
      )}
      {onRemoveClick && (
        <RowIconButton icon="close" label={t('friends.remove', { username })} onClick={() => onRemoveClick(user)} />
      )}
    </div>
  )
}
