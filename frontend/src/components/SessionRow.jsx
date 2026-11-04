import { useTranslation } from 'react-i18next'

export default function SessionRow({ id, creatorName, current, max, status = 'open', rejectedReason, onJoinClick, onCancelClick }) {
  const { t } = useTranslation()
  const label = creatorName ? t('session.name', { username: creatorName }) : id

  const rejectionKey = {
    rejected: 'session.rejected',
    full: 'session.rejectionFull',
    busy: 'session.busy',
    gone: 'session.gone',
    already_in_session: 'session.alreadyInSession',
  }[rejectedReason]

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span title={label} className="text-white text-sm flex-1 min-w-0 truncate">{label}</span>
      <span className="text-white/60 text-xs shrink-0">{current}/{max}</span>
      {rejectedReason
        ? <span className="w-24 shrink-0 text-end text-error text-xs font-medium tracking-nav">{rejectionKey ? t(rejectionKey) : t('session.notJoined')}</span>
        : status === 'full'
        ? <span className="w-24 shrink-0 text-end text-white/40 text-xs font-medium tracking-nav">{t('session.full')}</span>
        : status === 'pending'
        ? (
          <div className="w-24 shrink-0 flex items-center justify-end gap-1">
            <span className="text-white/50 text-xs font-medium tracking-nav">{t('session.pending')}</span>
            <button
              type="button"
              onClick={() => onCancelClick?.(id)}
              aria-label={creatorName ? t('session.cancelJoinNamed', { username: creatorName }) : t('session.cancelJoin', { id })}
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
            aria-label={creatorName ? t('session.requestJoinNamed', { username: creatorName }) : t('session.requestJoin', { id })}
            className="w-24 shrink-0 text-end text-brand text-xs font-medium tracking-nav hover:text-white transition-colors"
          >
            {t('session.join')}
          </button>
        )}
    </div>
  )
}
