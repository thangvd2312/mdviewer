import clsx from 'clsx'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

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

/** How many dialogs are open: the app behind them is inert (no focus, clicks or screen reader) while any is. */
let openDialogs = 0

/**
 * Recently focused or pressed elements, newest last — what a dialog gives focus back to. A dialog
 * takes the newest one outside itself: its own autoFocus moves focus inside before its effects run,
 * Safari doesn't focus buttons on click, and an opener may itself sit in another (parent) dialog.
 */
const recentTriggers: HTMLElement[] = []
if (typeof document !== 'undefined') {
  const remember = (e: Event) => {
    const el =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>('button, a, input, textarea, select, [tabindex]')
        : null
    if (!el || recentTriggers.at(-1) === el) return
    recentTriggers.push(el)
    if (recentTriggers.length > 20) recentTriggers.shift()
  }
  document.addEventListener('focusin', remember, true)
  document.addEventListener('pointerdown', remember, true)
}
const setAppInert = (inert: boolean) => document.getElementById('root')?.toggleAttribute('inert', inert)

const openerFor = (dialog: HTMLElement | null) =>
  [...recentTriggers].reverse().find((el) => el.isConnected && !dialog?.contains(el)) ?? null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog over a dimmed page. Takes focus when it opens (unless a child already did, e.g. with
 * autoFocus), keeps Tab inside, gives focus back on close, and scrolls inside on short screens.
 */
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
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // The open/close lifecycle must not re-run when the parent passes a new onClose.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    const opener = openerFor(dialog)
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    openDialogs += 1
    setAppInert(true)
    // Escape closes only the topmost dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !dialog) return
      const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (all[all.length - 1] === dialog) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openDialogs -= 1
      if (openDialogs === 0) setAppInert(false)
      // Back to what opened it — unless that's gone (e.g. a menu item), then to the page.
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  // Keep Tab / Shift+Tab within the dialog.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (items.length === 0) return e.preventDefault()
    const first = items[0]!
    const last = items.at(-1)!
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/25 p-4 pt-[10vh] backdrop-blur-[2px] dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={clsx(
          'flex max-h-[calc(100dvh-10vh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl outline-none',
          className,
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center gap-2 pt-3.5 pr-3 pl-5">
            <h2 id={titleId} className="flex-1 pt-1 text-[15px] font-semibold">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
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

/** On/off toggle. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-emerald-500 dark:bg-emerald-500' : 'bg-line',
      )}
    >
      <span
        className={clsx(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block size-4 animate-spin rounded-full border-2 border-line border-t-ink-muted',
        className,
      )}
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
