import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

const baseClasses = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 rounded-[8px] bg-surface/60 border-t border-t-white/18 border-b border-b-white/8 shadow-panel backdrop-blur-[15px] p-6'

export default function Modal({ as: Tag = 'div', className = '', onClose, ...props }) {
  useEffect(() => {
    if (!onClose) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const panel = <Tag className={twMerge(baseClasses, className)} {...props} />

  if (!onClose) return panel

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      {panel}
    </>
  )
}
