import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchProfile } from '../auth.js'
import NavButton from './NavButton.jsx'
import Icon from './Icon.jsx'
import UserRow from './UserRow.jsx'
import GlassPanel from './GlassPanel.jsx'
import FriendRequestRow from './FriendRequestRow.jsx'
import AvatarUploadPopup from './AvatarUploadPopup.jsx'

function Avatar({ src, token, onAvatarChange }) {
  const { t } = useTranslation()
  const [showUpload, setShowUpload] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('profile.changeAvatar')}
        onClick={() => setShowUpload(true)}
        className="cursor-pointer rounded-full p-0 border-0 bg-transparent
  transition duration-200 hover:opacity-80 active:scale-[0.96]"
      >
        <img
          src={src}
          alt=""
          className="block w-16 h-16 rounded-full object-cover"
        />
      </button>
      {showUpload && (
        <AvatarUploadPopup
          token={token}
          onClose={() => setShowUpload(false)}
          onAvatarChange={onAvatarChange}
        />
      )}
    </>
  )
}

function FriendsButton({ open, onClick }) {
  const { t } = useTranslation()
  return (
    <NavButton
      onClick={onClick}
      aria-label={t('profile.friends')}
      aria-pressed={open}
      className="p-2">
      <Icon name="friends" />
    </NavButton>
  )
}

function FriendsPanel({ friends, incoming, unread, onChatClick, onAcceptClick, onRejectClick, onRemoveClick }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {incoming.length > 0 && (
        <>
          <div>{t('profile.requests')}</div>
          {incoming.map((username) => (
            <FriendRequestRow key={username} username={username} onAcceptClick={onAcceptClick} onRejectClick={onRejectClick} />
          ))}
        </>
      )}
      <div>Friends: maybe their avatars to left side too?</div>
      {friends.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">{t('profile.noFriends')}</div>
        : friends.map((friend) => <UserRow key={friend.username} {...friend} unread={unread.includes(friend.username)} onChatClick={onChatClick} onRemoveClick={onRemoveClick} />)}
    </div>
  )
}

// friends: [{ username, online }], incoming: [username]
export default function ProfileView({ token, friends, incoming, unread, onChatClick, onAcceptClick, onRejectClick, onRemoveClick, onFriendsOpen }) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [showFriends, setShowFriends] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchProfile(token)
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [token])

  return (
    <GlassPanel className="min-h-0 overflow-y-auto pt-5">
      {profile && (
        <div className="flex items-center justify-between mb-4">
          <Avatar
            src={profile.avatar}
            token={token}
            onAvatarChange={(avatarUrl) =>
              setProfile((p) => ({ ...p, avatar: avatarUrl }))
            }
          />
          <FriendsButton open={showFriends} onClick={() => {
            if (!showFriends) onFriendsOpen()
            setShowFriends((s) => !s)
          }} />
        </div>
      )}
      {error && <div className="text-error text-xs text-center max-w-55">{error}</div>}
      {!error && !profile && <div>{t('common.loading')}</div>}
      {profile && (
        <div>
          {showFriends ? <FriendsPanel
                            friends={friends}
                            incoming={incoming}
                            unread={unread}
                            onChatClick={onChatClick}
                            onAcceptClick={onAcceptClick}
                            onRejectClick={onRejectClick}
                            onRemoveClick={onRemoveClick}
                          /> : 'Some additional information here?'}
        </div>
      )}
    </GlassPanel>
  )
}
