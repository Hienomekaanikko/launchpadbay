import { useTranslation } from 'react-i18next'
import { MAX_MESSAGE_CHARS } from '../useChat.js'

export default function MessageComposer({ value, onChange, onSubmit, disabled = false, className = '' }) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className={`flex shrink-0 gap-2 ${className}`}>
      <input aria-label={t('common.messagePlaceholder')} className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-black/15 px-3.5 text-sm text-white outline-none placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30" maxLength={MAX_MESSAGE_CHARS} value={value} onChange={(event) => onChange(event.target.value)} placeholder={t('common.messagePlaceholder')} />
      <button type="submit" disabled={disabled || !value.trim()} className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-black/15 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-black/25 hover:text-white active:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 disabled:cursor-default disabled:text-white/40 disabled:hover:bg-black/15 disabled:active:bg-black/15">{t('common.send')}</button>
    </form>
  )
}
