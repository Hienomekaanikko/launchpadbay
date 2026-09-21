import { twMerge } from 'tailwind-merge'

const baseClasses = 'fixed right-12.5 w-1/5 z-20 rounded-[20px] px-10 pb-6 bg-surface/40 border-t border-t-white/18 border-b border-b-white/8 shadow-panel backdrop-blur-[15px]'

export default function GlassPanel({ className = '', ...props }) {
  return <div className={twMerge(baseClasses, className)} {...props} />
}
