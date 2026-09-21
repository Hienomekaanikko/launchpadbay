import { twMerge } from 'tailwind-merge'

const baseClasses = [
  'relative',
  'bg-black/25',
  'rounded-[8px]',
  'text-white/70 text-xs',
  'tracking-nav font-sans',
  'whitespace-nowrap',
  'px-3 py-1.5',
  'cursor-pointer',
  'backdrop-blur-[10px]',
  'transition-colors',
  'hover:bg-black/40',
  "after:content-[''] after:absolute after:left-1/2 after:-bottom-1.5 after:-translate-x-1/2",
  'after:w-[90%] after:h-0.5 after:rounded-full after:bg-brand',
  'after:shadow-glow-brand',
].join(' ')

export default function Tag({ className = '', ...props }) {
  return <button className={twMerge(baseClasses, className)} {...props} />
}
