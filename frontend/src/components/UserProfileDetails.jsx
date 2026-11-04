import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchUser } from '../auth.js'
import { onMessage } from '../useSocket.js'
import { translateServerError } from '../i18n/serverErrors.js'
import Icon from './Icon.jsx'

// This view mounts inside the user panel when its profile is selected.
export default function UserProfileDetails({ token, socket, recipient, friendStatus, onAddFriendClick, onRemoveClick }) {
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const latestAvatar = useRef(null)

  useEffect(() => {
    let cancelled = false
    setUser(null)
    setError(null)
    latestAvatar.current = null
    fetchUser(token, recipient.id)
      // Prefer a live avatar update that arrived while this request was in flight.
      .then((data) => { if (!cancelled) setUser({ ...data, avatar: latestAvatar.current ?? data.avatar }) })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [token, recipient.id])

  // Keep the integrated profile in sync when that user changes their avatar.
  useEffect(() => {
    if (!socket) return
    return onMessage(socket, (msg) => {
      if (msg.type !== 'user_avatar_updated' || msg.id !== recipient.id) return
      latestAvatar.current = msg.avatar
      setUser((previous) => (previous ? { ...previous, avatar: msg.avatar } : previous))
    })
  }, [socket, recipient.id])

  const isFriend = friendStatus === 'friend'
  const requestSent = friendStatus === 'outgoing'
  const actionLabel = isFriend ? 'friends.removeFriend'
    : requestSent ? 'friends.requestSent'
      : friendStatus === 'incoming' ? 'friends.acceptRequest' : 'friends.addFriend'

  return (
    <section aria-label={t('nav.profileFor', { username: recipient.username })} className="chat-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
      {error && <p role="alert" className="text-center text-sm text-error">{translateServerError(t, error)}</p>}
      {!error && !user && <p role="status" className="py-6 text-center text-sm text-white/65">{t('common.loading')}</p>}
      {user && (
        <>
          <div className="flex flex-col items-center gap-4 text-center">
            <img src={user.avatar} alt="" className="size-28 shrink-0 rounded-full object-cover ring-4 ring-white/10" />
            <h3 className="max-w-full break-words text-xl font-semibold">{recipient.username}</h3>
          </div>
          <dl className="px-4 py-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-white/60">{t('profile.memberSince')}</dt>
            <dd className="mt-1.5 text-sm text-white/90">{new Date(user.createdAt).toLocaleDateString(i18n.resolvedLanguage, { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
          </dl>
          <button type="button" disabled={requestSent} onClick={() => isFriend ? onRemoveClick(recipient) : onAddFriendClick(recipient)} className="mt-auto flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-black/15 px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default disabled:text-white/50 disabled:hover:bg-black/15">
            {!requestSent && <Icon name={isFriend ? 'close' : 'user-plus'} className="size-4 shrink-0" />}
            {t(actionLabel)}
          </button>
        </>
      )}
    </section>
  )
}
