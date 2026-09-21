import { twMerge } from 'tailwind-merge'

const baseClasses = [
  'bg-white/20',
  'border-t border-t-white/18',
  'border-b border-b-white/8',
  'rounded-[8px]',
  'text-white text-xs font-medium tracking-nav font-sans',
  'py-1.5 px-4',
  'cursor-pointer',
  'backdrop-blur-[15px]',
  'shadow-nav',
  'transition-all duration-200',
  'hover:bg-white/16 hover:shadow-nav-hover',
  'active:scale-[0.96]',
].join(' ')

export default function FormButton({ className = '', ...props }) {
  return <button className={twMerge(baseClasses, className)} {...props} />
}
