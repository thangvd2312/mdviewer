import clsx from 'clsx'
import { useState } from 'react'
import { initials } from '../lib/format'

/** Gradient per name, so people without a photo still look different from each other. */
const GRADIENTS = [
  'from-violet-500 to-pink-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-fuchsia-500 to-purple-600',
]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({
  name,
  src,
  className = 'size-8',
  muted,
  initialsClass = 'text-[11px]',
}: {
  name: string
  src?: string | null
  className?: string
  /** Grey placeholder (guests, deleted accounts). */
  muted?: boolean
  /** Font size of the initials (for large avatars). */
  initialsClass?: string
}) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-full border border-line object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 place-items-center rounded-full text-[0.8em] font-semibold select-none',
        muted ? 'bg-hover text-ink-muted' : `bg-gradient-to-br text-white ${GRADIENTS[hash(name) % GRADIENTS.length]}`,
        className,
      )}
    >
      <span className={initialsClass}>{initials(name) || '?'}</span>
    </span>
  )
}
