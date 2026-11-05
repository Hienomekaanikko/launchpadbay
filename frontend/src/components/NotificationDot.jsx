export default function NotificationDot({ className = '' }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 8 8" className={`absolute size-2 shrink-0 text-brand ${className}`}>
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  )
}
