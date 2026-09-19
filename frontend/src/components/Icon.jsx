export default function Icon({ name, className = 'w-5 h-5', ...props }) {
  return (
    <svg className={className} aria-hidden="true" {...props}>
      <use href={`/icons.svg#${name}-icon`} />
    </svg>
  )
}
