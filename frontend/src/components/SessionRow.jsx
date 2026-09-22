import Icon from './Icon.jsx'

export default function SessionRow({ id, current, max, status = 'open', onJoinClick }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm font-sans flex-1">{id}</span>
      <span className="text-white/60 text-xs font-sans">{current}/{max}</span>
      <Icon name="friends" className="w-4 h-4 text-white/70" />
      {status === 'pending'
        ? <span className="w-16 text-right text-white/50 text-xs font-medium tracking-nav font-sans">Pending...</span>
        : (
          <button
            type="button"
            onClick={() => onJoinClick?.(id)}
            aria-label={`Request to join ${id}`}
            className="w-16 text-right text-brand text-xs font-medium tracking-nav font-sans hover:text-white transition-colors"
          >
            JOIN
          </button>
        )}
    </div>
  )
}
