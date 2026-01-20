import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import type { OKR } from '../../types/okr'
import type { Task } from '../../types/task'
import { loadDb, persistDb } from '../../lib/storage/dbManager'
import { deleteOkr, listOkrs, saveOkr, tasksForOkr } from '../../lib/okr/okrRepository'
import OKRModal from './OKRModal'

type Props = {
  focusId?: string | null
}

const OKRPage = ({ focusId }: Props) => {
  const [okrs, setOkrs] = useState<OKR[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<Record<string, Task[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOkr, setModalOkr] = useState<OKR | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await loadDb()
        const data = listOkrs(ctx.db)
        setOkrs(data)
        if (data.length && !selectedId) {
          setSelectedId(data[0].id)
        }
        await persistDb(ctx)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load OKRs.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId)
    }
  }, [focusId])

  const selected = useMemo(
    () => okrs.find((o) => o.id === selectedId) || null,
    [okrs, selectedId],
  )

  useEffect(() => {
    const loadTasks = async () => {
      if (!selectedId) return
      const ctx = await loadDb()
      setTasks((prev) => ({ ...prev, [selectedId]: tasksForOkr(ctx.db, selectedId) }))
    }
    loadTasks()
  }, [selectedId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return okrs
    return okrs.filter((o) => o.objective.toLowerCase().includes(q))
  }, [okrs, search])

  const progress = (okr: OKR) => {
    if (!okr.keyResults.length) return 0
    const ratios = okr.keyResults.map((kr) =>
      kr.target ? Math.min(1, Math.max(0, kr.current / kr.target)) : 0,
    )
    const avg = ratios.reduce((sum, n) => sum + n, 0) / ratios.length
    return Number((avg * 100).toFixed(1))
  }

  const newOkr = (): OKR => {
    const now = Date.now()
    return {
      id: crypto.randomUUID(),
      objective: '',
      impactWeight: 0.1,
      createdAt: now,
      updatedAt: now,
      keyResults: [],
    }
  }

  const handleSaveModal = async (okr: OKR) => {
    const ctx = await loadDb()
    saveOkr(ctx.db, okr)
    await persistDb(ctx)
    const nextOkrs = listOkrs(ctx.db)
    setOkrs(nextOkrs)
    setSelectedId(okr.id)
    setModalOkr(null)
  }

  const handleDelete = async (id?: string | null) => {
    const target = id ?? selectedId
    if (!target) return
    const ctx = await loadDb()
    deleteOkr(ctx.db, target)
    await persistDb(ctx)
    const next = listOkrs(ctx.db)
    setOkrs(next)
    setSelectedId(next[0]?.id ?? null)
    setModalOkr(null)
  }

  if (loading) return <Card className="p-6 text-text-secondary">Loading OKRs…</Card>
  if (error)
    return (
      <Card className="p-6 text-red-200 border border-red-400/60 bg-red-500/10">
        {error}
      </Card>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setModalOkr(newOkr())}>New OKR</Button>
        <Input
          placeholder="Search objectives"
          className="max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[320px,1fr]">
        <Card className="p-4 space-y-3">
          {filtered.map((okr) => (
            <button
              key={okr.id}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                okr.id === selectedId
                  ? 'border-accent bg-accent/10 text-text-primary'
                  : 'border-border bg-background text-text-primary hover:border-accent/60'
              }`}
              onClick={() => {
                setSelectedId(okr.id)
              }}
            >
              <p className="font-semibold">{okr.objective}</p>
              <div className="mt-2 flex items-center justify-between text-sm text-text-secondary">
                <span>Impact: {(okr.impactWeight * 100).toFixed(0)}%</span>
                <span>{progress(okr)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full bg-accent" style={{ width: `${progress(okr)}%` }} />
              </div>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="text-sm text-text-secondary">No OKRs yet.</p>
          ) : null}
        </Card>

        <Card className="p-5 space-y-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-text-secondary">Objective</p>
                  <h2 className="text-2xl font-semibold text-text-primary">{selected.objective}</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Impact weight: {(selected.impactWeight * 100).toFixed(0)}%
                  </p>
                  <p className="text-sm text-text-secondary mt-1">Progress: {progress(selected)}%</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setModalOkr(selected)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(selected.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">Key Results</p>
                  <Badge>{selected.keyResults.length} KRs</Badge>
                </div>
                {selected.keyResults.length === 0 ? (
                  <p className="text-sm text-text-secondary">No key results yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.keyResults.map((kr) => (
                      <Card key={kr.id} className="p-3 bg-background">
                        <p className="font-semibold text-text-primary">{kr.title}</p>
                        <p className="text-xs text-text-secondary">
                          Target: {kr.target} • Current: {kr.current}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">Linked stories</p>
                  <Badge>{tasks[selected.id]?.length ?? 0} stories</Badge>
                </div>
                <div className="space-y-2">
                  {(tasks[selected.id] ?? []).map((task) => (
                    <Card key={task.id} className="p-3 bg-background">
                      <p className="font-semibold text-text-primary">{task.title}</p>
                      <p className="text-xs text-text-secondary">
                        {task.lane} • {task.project || 'No epic'}
                      </p>
                    </Card>
                  ))}
                  {(tasks[selected.id] ?? []).length === 0 ? (
                    <p className="text-sm text-text-secondary">No stories linked yet.</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="text-text-secondary">Select or create an OKR.</p>
          )}
        </Card>
      </div>

      <OKRModal
        open={modalOkr !== null}
        initial={modalOkr ?? undefined}
        onClose={() => setModalOkr(null)}
        onSave={handleSaveModal}
        onDelete={(id) => handleDelete(id)}
      />
    </div>
  )
}

export default OKRPage
