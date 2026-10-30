import { useTranslation } from 'react-i18next'
import FormButton from './FormButton.jsx'

export default function FriendRequestRow({ id, username, onAcceptClick, onRejectClick }) {
  const { t } = useTranslation()
  const user = { id, username }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm flex-1 min-w-0 truncate">{username}</span>
      <FormButton type="button" className="px-2 py-1" onClick={() => onAcceptClick(user)}>{t('common.accept')}</FormButton>
      <FormButton type="button" className="px-2 py-1" onClick={() => onRejectClick(user)}>{t('common.reject')}</FormButton>
    </div>
  )
}
