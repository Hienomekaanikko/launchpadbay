import { twMerge } from 'tailwind-merge'

const baseClasses = [
  'absolute top-2.5 right-2.5',
  'w-[15px] h-[15px] p-0',
  'flex items-center justify-center',
  'text-[11px] leading-none font-sans',
  'bg-white/20',
  'border-t border-t-white/18',
  'border-b border-b-white/8',
  'rounded-[6px]',
  'text-white',
  'cursor-pointer',
  'backdrop-blur-[15px]',
  'shadow-close',
  'transition-all duration-200',
  'hover:bg-white/16',
  'active:scale-90',
].join(' ')

export default function CloseButton({ className = '', ...props }) {
  return <button type="button" className={twMerge(baseClasses, className)} {...props} />
}
