import { ChevronDown } from 'lucide-react'
import { useProjects } from '../lib/queries'

/** Compact native select for choosing a project (or none). */
export function ProjectSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { data: projects = [] } = useProjects()
  return (
    <label className="relative inline-flex h-8 items-center rounded-lg text-[13px] text-ink-muted hover:bg-hover hover:text-ink">
      <span className="sr-only">Project</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-full max-w-48 cursor-pointer appearance-none truncate bg-transparent pr-7 pl-2.5 font-medium outline-none"
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.icon} {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5" />
    </label>
  )
}
