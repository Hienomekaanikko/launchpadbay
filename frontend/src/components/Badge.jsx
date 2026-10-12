// Small count bubble pinned to the top-right corner of its parent (the parent must be positioned)
export default function Badge({ count }) {
  if (!count) return null
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-brand text-black text-[10px] font-medium font-sans leading-4 text-center pointer-events-none">
      {count}
    </span>
  )
}
