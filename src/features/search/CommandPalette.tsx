import { useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import type { Task } from '../../types/task'
import type { MeetingNote } from '../../types/meetingNote'
import type { OKR } from '../../types/okr'
import { loadDb } from '../../lib/storage/dbManager'
import { listTasks } from '../../lib/kanban/taskRepository'
import { listNotes } from '../../lib/notes/meetingNotesRepository'
import { listOkrs } from '../../lib/okr/okrRepository'

type Result =
  | { type: 'task'; id: string; title: string; meta: string }
  | { type: 'note'; id: string; title: string; meta: string }
  | { type: 'okr'; id: string; title: string; meta: string }

type Props = {
  onNavigate: (res: Result) => void
}

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase())

const CommandPalette = ({ onNavigate }: Props) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [okrs, setOkrs] = useState<OKR[]>([])

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  }, [])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const ctx = await loadDb()
      setTasks(listTasks(ctx.db))
      setNotes(listNotes(ctx.db))
      setOkrs(listOkrs(ctx.db))
    })()
  }, [open])

  const results = useMemo(() => {
    if (!query) return []
    const limit = 5
    const taskRes: Result[] = tasks
      .filter((t) => matches(`${t.title} ${t.id} ${t.project ?? ''}`, query))
      .slice(0, limit)
      .map((t) => ({
        type: 'task',
        id: t.id,
        title: t.title,
        meta: `${t.project || 'No epic'} • ${t.id}`,
      }))
    const noteRes: Result[] = notes
      .filter((n) => matches(`${n.title} ${n.project ?? ''} ${n.attendees ?? ''}`, query))
      .slice(0, limit)
      .map((n) => ({
        type: 'note',
        id: n.id,
        title: n.title,
        meta: `${n.project || 'No epic'}`,
      }))
    const okrRes: Result[] = okrs
      .filter((o) => matches(`${o.objective} ${o.id}`, query))
      .slice(0, limit)
      .map((o) => ({
        type: 'okr',
        id: o.id,
        title: o.objective,
        meta: 'OKR',
      }))
    return [...taskRes, ...noteRes, ...okrRes]
  }, [query, tasks, notes, okrs])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24">
      <Card className="w-full max-w-2xl p-4 space-y-3">
        <Input
          autoFocus
          placeholder="Search stories, notes, OKRs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-sm text-text-secondary">No results.</p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left transition hover:border-accent"
                onClick={() => {
                  onNavigate(r)
                  setOpen(false)
                }}
              >
                <div>
                  <p className="font-semibold text-text-primary">{r.title}</p>
                  <p className="text-xs text-text-secondary">{r.meta}</p>
                </div>
                <Badge>{r.type === 'task' ? 'story' : r.type}</Badge>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

export default CommandPalette
