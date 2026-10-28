import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchUser } from '../auth.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import FormButton from './FormButton.jsx'

// friendStatus: 'friend' | 'incoming' | 'outgoing' | 'none'
function FriendAction({ username, friendStatus, onAddFriendClick, onRemoveClick }) {
  const { t } = useTranslation()
  if (friendStatus === 'friend') {
    return <FormButton type="button" onClick={() => onRemoveClick(username)}>{t('friends.removeFriend')}</FormButton>
  }
  if (friendStatus === 'outgoing') {
    return <FormButton type="button" disabled>{t('friends.requestSent')}</FormButton>
  }
  // adding someone who already asked us accepts their request
  return (
    <FormButton type="button" onClick={() => onAddFriendClick(username)}>
      {friendStatus === 'incoming' ? t('friends.acceptRequest') : t('friends.addFriend')}
    </FormButton>
  )
}

// Another user's public profile; online and friendStatus come from the app's live state
export default function UserProfilePopup({ token, username, online, friendStatus, onAddFriendClick, onRemoveClick, onChatClick, onClose }) {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setUser(null)
    setError('')
    fetchUser(token, username)
      .then((data) => { if (!cancelled) setUser(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [token, username])

  return (
    <Modal className="z-30 w-[min(90vw,20rem)] items-stretch gap-4">
      <div className="flex w-full justify-end">
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      {error && <p className="text-error text-xs font-sans text-center">{error}</p>}
      {!error && !user && <p className="text-black text-xs font-sans text-center">{t('common.loading')}</p>}
      {user && (
        <>
          <div className="flex items-center gap-4">
            <img src={user.avatar} alt="" className="block w-16 h-16 rounded-full object-cover" />
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-black text-sm font-medium font-sans break-all">{user.username}</h2>
              <span className="flex items-center gap-2 text-black/60 text-xs font-sans">
                <span className={`w-2 h-2 rounded-full ${online ? 'bg-online' : 'bg-black/30'}`} aria-hidden="true" />
                {online ? t('friends.online') : t('friends.offline')}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-xs font-sans">
            <dt className="text-black/60">{t('profile.memberSince')}</dt>
            <dd className="text-black">{new Date(user.createdAt).toLocaleDateString()}</dd>
          </dl>
          <div className="flex justify-end gap-2">
            {online && <FormButton type="button" onClick={() => onChatClick(user.username)}>{t('friends.chat')}</FormButton>}
            <FriendAction username={user.username} friendStatus={friendStatus} onAddFriendClick={onAddFriendClick} onRemoveClick={onRemoveClick} />
          </div>
        </>
      )}
    </Modal>
  )
}
