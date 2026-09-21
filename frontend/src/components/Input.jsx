import { twMerge } from 'tailwind-merge'

const baseClasses = [
  'bg-black/1',
  'border-t border-t-white/18',
  'border-b border-b-white/8',
  'rounded-[8px]',
  'text-white text-sm font-sans',
  'py-2.5 px-3.5',
  'backdrop-blur-[10px]',
  'shadow-input',
  'transition-all duration-200',
  "placeholder:text-white placeholder:[text-shadow:0_0_8px_rgba(255,255,255,0.4)]",
  'focus:outline-none focus:bg-black/35 focus:shadow-input-focus',
].join(' ')

export default function Input({ className = '', ...props }) {
  return <input className={twMerge(baseClasses, className)} {...props} />
}
