import clsx from 'clsx'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth'
import { useSavedSlugs, useSaveMutations } from '../../lib/queries'
import { useUI } from '../../lib/ui'
import { buttonClass } from '../ui'

/** A guest who pressed Save: saved once they come back signed in (the post page picks it up). */
const PENDING_KEY = 'viewmd.pendingSave'

/** Save a post to read later. Guests are asked to sign in first, then it's saved for them. */
export function SaveButton({
  slug,
  variant = 'icon',
  className,
}: {
  slug: string
  /** icon: a small round button (lists, toolbar); button: with a label. */
  variant?: 'icon' | 'button'
  className?: string
}) {
  const { user } = useAuth()
  const { toast } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const slugs = useSavedSlugs(Boolean(user))
  const { post } = useSaveMutations()
  const saved = Boolean(slugs.data?.has(slug))

  const onClick = () => {
    if (!user) {
      try {
        sessionStorage.setItem(PENDING_KEY, slug)
      } catch {
        // Private mode: they'll just press Save again after signing in.
      }
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    post.mutate(
      { slug, save: !saved },
      {
        onSuccess: () => toast(saved ? 'Removed from Saved' : 'Saved — it’s in Saved, in your sidebar'),
        onError: () => toast('Couldn’t update Saved'),
      },
    )
  }

  const Icon = saved ? BookmarkCheck : Bookmark
  const label = saved ? 'Saved' : 'Save'
  return variant === 'icon' ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from Saved' : 'Save to read later'}
      title={saved ? 'Remove from Saved' : 'Save to read later'}
      className={clsx(
        'relative z-10 grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-hover',
        saved ? 'text-accent' : 'text-ink-muted hover:text-ink',
        className,
      )}
    >
      <Icon className={clsx('size-[18px]', saved && 'fill-current')} />
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      className={clsx(buttonClass(saved ? 'secondary' : 'primary', 'h-9 rounded-full px-4'), className)}
    >
      <Icon className={clsx('size-4', saved && 'fill-current')} /> {label}
    </button>
  )
}

/** On a post page: finish the save a guest started before signing in. */
export function useFinishPendingSave(slug: string | undefined) {
  const { user } = useAuth()
  const { toast } = useUI()
  const { post } = useSaveMutations()
  const { mutate } = post
  useEffect(() => {
    if (!user || !slug) return
    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING_KEY)
      if (pending === slug) sessionStorage.removeItem(PENDING_KEY)
    } catch {
      return
    }
    if (pending === slug) mutate({ slug, save: true }, { onSuccess: () => toast('Saved — it’s in Saved, in your sidebar') })
  }, [user, slug, mutate, toast])
}
