import clsx from 'clsx'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-hover',
  ghost: 'text-ink-muted hover:bg-hover hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
}

/** Button styling, also usable on links. */
export const buttonClass = (variant: Variant = 'secondary', className?: string) =>
  clsx(
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    className,
  )

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}

export function IconButton({
  label,
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-hover hover:text-ink [&_svg]:size-[17px]',
        active ? 'bg-hover text-ink' : 'text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}

export const inputClass =
  'h-9 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-ink-faint focus:ring-4 focus:ring-hover'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/25 p-4 pt-[12vh] backdrop-blur-[2px] dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl', className)}
      >
        {title && <h2 className="px-5 pt-5 text-[15px] font-semibold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="px-5 pt-2 text-[14px] leading-relaxed text-ink-muted">{message}</p>
      <div className="flex justify-end gap-2 px-5 py-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

/** Small dropdown menu. Clicking any item closes it. */
export function Menu({
  label,
  icon,
  children,
  align = 'right',
}: {
  label: string
  icon: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <IconButton label={label} active={open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
      </IconButton>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={clsx(
            'absolute top-full z-30 mt-1 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  danger,
  onClick,
}: {
  icon?: ReactNode
  children: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-hover [&_svg]:size-4',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className={danger ? '' : 'text-ink-muted'}>{icon}</span>
      {children}
    </button>
  )
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx('inline-block size-4 animate-spin rounded-full border-2 border-line border-t-ink-muted', className)}
    />
  )
}

export function Logo({ className }: { className?: string }) {
  const gradient = `logo-${useId()}`
  return (
    <svg viewBox="0 0 32 32" className={clsx('size-6 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset="1" stopColor="#7a3cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradient})`} />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.8 22v-6.5a2.25 2.25 0 0 1 4.5 0V22m0-6.5a2.25 2.25 0 0 1 4.5 0V22" />
        <circle cx="22.6" cy="18.6" r="3.4" />
        <path d="M26 9.5V22" />
      </g>
    </svg>
  )
}
