import { useEffect, useState } from 'react'
import { fetchProfile } from '../auth.js'
import NavButton from './NavButton.jsx'
import Icon from './Icon.jsx'
import UserRow from './UserRow.jsx'
import GlassPanel from './GlassPanel.jsx'

/* This is just a placeholder list of friends that will be pulled from db when it has been designed, should be a rather
simple addition */
const MOCK_FRIENDS = [
  { username: 'superdj', online: true },
  { username: 'woopwoop', online: false },
  { username: 'duck', online: true },
]

function Avatar() {
  return (
    <div className="absolute top-5 left-10">AVATAR HERE</div>
  )
}

function FriendsButton({ open, onClick }) {
  return (
    <NavButton onClick={onClick} aria-label="Friends" aria-pressed={open} className="absolute top-5 right-5 p-2">
      <Icon name="friends" />
    </NavButton>
  )
}

function FriendsPanel({ friends, onChatClick }) {
  return (
    <div className="flex flex-col gap-1">
      <div>Friends: maybe their avatars to left side too?</div>
      {friends.length === 0
        ? <div className="text-white/60 text-xs text-center py-2 font-sans">No friends yet</div>
        : friends.map((friend) => <UserRow key={friend.username} {...friend} onChatClick={onChatClick} />)}
    </div>
  )
}

export default function ProfileView({ token, onChatClick }) {
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
    <GlassPanel className="top-25 pt-20">
      {error && <div className="text-error text-xs text-center max-w-55">{error}</div>}
      {!error && !profile && <div>Loading...</div>}
      {profile && (
        <div>
          {showFriends ? <FriendsPanel friends={MOCK_FRIENDS} onChatClick={onChatClick} /> : 'Some additional information here?'}
        </div>
      )}
      {profile && <Avatar />}
      {profile && <FriendsButton open={showFriends} onClick={() => setShowFriends((s) => !s)} />}
    </GlassPanel>
  )
}
