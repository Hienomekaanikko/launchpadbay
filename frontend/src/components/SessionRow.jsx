import { useTranslation } from 'react-i18next'
import Icon from './Icon.jsx'

export default function SessionRow({ id, current, max, status = 'open', rejectedReason, onJoinClick, onCancelClick }) {
  const { t } = useTranslation()

  const rejectionKey = {
    rejected: 'session.rejected',
    full: 'session.rejectionFull',
    busy: 'session.busy',
    gone: 'session.gone',
    already_in_session: 'session.alreadyInSession',
  }[rejectedReason]

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm font-sans flex-1 min-w-0 truncate">{id}</span>
      <span className="text-white/60 text-xs font-sans shrink-0">{current}/{max}</span>
      <Icon name="friends" className="w-4 h-4 shrink-0 text-white/70" />
      {rejectedReason
        ? <span className="w-24 shrink-0 text-end text-error text-xs font-medium tracking-nav font-sans">{rejectionKey ? t(rejectionKey) : t('session.notJoined')}</span>
        : status === 'full'
        ? <span className="w-24 shrink-0 text-end text-white/40 text-xs font-medium tracking-nav font-sans">{t('session.full')}</span>
        : status === 'pending'
        ? (
          <div className="w-24 shrink-0 flex items-center justify-end gap-1">
            <span className="text-white/50 text-xs font-medium tracking-nav font-sans">{t('session.pending')}</span>
            <button
              type="button"
              onClick={() => onCancelClick?.(id)}
              aria-label={t('session.cancelJoin', { id })}
              className="text-white/50 text-xs leading-none hover:text-error transition-colors"
            >
              X
            </button>
          </div>
        )
        : (
          <button
            type="button"
            onClick={() => onJoinClick?.(id)}
            aria-label={t('session.requestJoin', { id })}
            className="w-24 shrink-0 text-end text-brand text-xs font-medium tracking-nav font-sans hover:text-white transition-colors"
          >
            {t('session.join')}
          </button>
        )}
    </div>
  )
}
