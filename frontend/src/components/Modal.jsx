import { twMerge } from 'tailwind-merge'

const baseClasses = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 rounded-[8px] bg-surface/60 border-t border-t-white/18 border-b border-b-white/8 shadow-panel backdrop-blur-[15px] p-6'

export default function Modal({ as: Tag = 'div', className = '', ...props }) {
  return <Tag className={twMerge(baseClasses, className)} {...props} />
}
