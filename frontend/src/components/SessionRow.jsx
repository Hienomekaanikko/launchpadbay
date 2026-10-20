import Icon from './Icon.jsx'

// why the backend turned our join request down (session_rejected's reason)
const REJECTION_TEXT = {
  rejected: 'Declined',
  full: 'Full',
  busy: 'Busy, retry',
  gone: 'Closed',
  already_in_session: 'In a session',
}

export default function SessionRow({ id, current, max, status = 'open', rejectedReason, onJoinClick, onCancelClick }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm font-sans flex-1 min-w-0 truncate">{id}</span>
      <span className="text-white/60 text-xs font-sans shrink-0">{current}/{max}</span>
      <Icon name="friends" className="w-4 h-4 shrink-0 text-white/70" />
      {rejectedReason
        ? <span className="w-24 shrink-0 text-right text-error text-xs font-medium tracking-nav font-sans">{REJECTION_TEXT[rejectedReason] ?? 'Not joined'}</span>
        : status === 'full'
        ? <span className="w-24 shrink-0 text-right text-white/40 text-xs font-medium tracking-nav font-sans">FULL</span>
        : status === 'pending'
        ? (
          <div className="w-24 shrink-0 flex items-center justify-end gap-1">
            <span className="text-white/50 text-xs font-medium tracking-nav font-sans">Pending...</span>
            <button
              type="button"
              onClick={() => onCancelClick?.(id)}
              aria-label={`Cancel join request for ${id}`}
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
            aria-label={`Request to join ${id}`}
            className="w-24 shrink-0 text-right text-brand text-xs font-medium tracking-nav font-sans hover:text-white transition-colors"
          >
            JOIN
          </button>
        )}
    </div>
  )
}
