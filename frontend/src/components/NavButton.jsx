import { twMerge } from 'tailwind-merge'

const baseClasses = [
  'relative',
  'bg-white/20',
  'border-t border-t-white/18',
  'border-b border-b-white/8',
  'rounded-[10px]',
  'text-white text-sm font-medium tracking-nav font-sans',
  'py-2.5 px-7',
  'cursor-pointer',
  'backdrop-blur-[15px]',
  'shadow-nav',
  'transition-all duration-200',
  'hover:bg-white/16 hover:shadow-nav-hover',
  'active:scale-[0.96]',
  "after:content-[''] after:absolute after:left-1/2 after:-bottom-1.5 after:-translate-x-1/2",
  'after:w-[90%] after:h-0.5 after:rounded-full after:bg-brand',
  'after:shadow-glow-brand',
].join(' ')

export default function NavButton({ className = '', ...props }) {
  return <button className={twMerge(baseClasses, className)} {...props} />
}
