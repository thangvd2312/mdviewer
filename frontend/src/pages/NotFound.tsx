import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { TopBar } from '../components/AppLayout'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <>
      <TopBar crumbs={[]} />
      <div className="grid flex-1 place-items-center px-6 pb-24 text-center">
        <div>
          <FileQuestion className="mx-auto size-10 text-ink-faint" strokeWidth={1.5} />
          <h1 className="mt-4 text-[18px] font-semibold">This {what} doesn’t exist</h1>
          <p className="mt-1 text-[14px] text-ink-muted">It may have been deleted, or the link is wrong.</p>
          <Link to="/" className="mt-5 inline-block text-[14px] font-medium text-accent hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </>
  )
}

export function PageLoading() {
  return (
    <>
      <TopBar crumbs={[]} />
      <div className="mx-auto w-full max-w-[760px] animate-pulse space-y-4 px-6 pt-10">
        <div className="h-8 w-2/3 rounded-lg bg-hover" />
        <div className="h-4 w-full rounded bg-hover" />
        <div className="h-4 w-5/6 rounded bg-hover" />
        <div className="h-4 w-4/6 rounded bg-hover" />
      </div>
    </>
  )
}
