import { useTranslation } from 'react-i18next'

const buttonClass = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black/15 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export default function FriendRequestRow({ id, username, onAcceptClick, onRejectClick }) {
  const { t } = useTranslation()
  const user = { id, username }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm flex-1 min-w-0 truncate">{username}</span>
      <button type="button" className={buttonClass} onClick={() => onAcceptClick(user)}>{t('common.accept')}</button>
      <button type="button" className={buttonClass} onClick={() => onRejectClick(user)}>{t('common.reject')}</button>
    </div>
  )
}
