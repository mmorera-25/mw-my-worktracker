import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, CalendarRange, Folder, Inbox, ListChecks, Plus, Sparkles } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Dialog from '../../components/ui/Dialog'
import Select from '../../components/ui/Select'
import RichTextEditor from '../../components/ui/RichTextEditor'
import { loadDb, persistDb } from '../../lib/storage/dbManager'
import { listTasks, saveTask, deleteTask, updateLane } from '../../lib/kanban/taskRepository'
import { listProjects, saveProject } from '../../lib/projects/projectRepository'
import type { Task } from '../../types/task'
import type { Project } from '../../types/project'
import { CheckCircle2, Trash2, Check } from 'lucide-react'

type TodoPageProps = {
  lanes: string[]
  swimlanes: string[]
}


const viewMeta = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'today', label: 'Today', icon: CalendarCheck },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarRange },
  { id: 'all', label: 'All Stories', icon: ListChecks },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
] as const

const formatDate = (value: number) => {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

const isSameDay = (a: number, b: number) => {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

const TodoPage = ({ lanes, swimlanes }: TodoPageProps) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeView, setActiveView] = useState('inbox')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '' })
  const [savingProject, setSavingProject] = useState(false)
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [draftStory, setDraftStory] = useState<Task | null>(null)
  const quickAddRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await loadDb()
        setTasks(listTasks(ctx.db))
        setProjects(listProjects(ctx.db))
        await persistDb(ctx)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load stories right now.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const doneLane = useMemo(() => {
    const match = lanes.find((lane) => lane.toLowerCase() === 'done')
    return match ?? 'Done'
  }, [lanes])

  const defaultLane = useMemo(() => {
    const match = lanes.find((lane) => lane.toLowerCase().includes('to do'))
    return match ?? lanes[0] ?? 'To Do'
  }, [lanes])

  const defaultSwimlane = swimlanes[0] ?? 'Core'

  const projectMap = useMemo(() => {
    return projects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project
      return acc
    }, {})
  }, [projects])

  const todayRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    end.setMilliseconds(end.getMilliseconds() - 1)
    return { start: start.getTime(), end: end.getTime() }
  }, [])

  const upcomingRange = useMemo(() => {
    const nextWeek = new Date(todayRange.start)
    nextWeek.setDate(nextWeek.getDate() + 7)
    return nextWeek.getTime()
  }, [todayRange.start])

  const activeProjectId = activeView.startsWith('project:') ? activeView.slice(8) : null
  const activeProject = activeProjectId ? projectMap[activeProjectId] : null

  const isDone = (task: Task) => task.lane === doneLane

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return tasks
    return tasks.filter((task) =>
      `${task.title} ${task.project ?? ''}`.toLowerCase().includes(needle),
    )
  }, [query, tasks])

  const visibleTasks = useMemo(() => {
    const remaining = filteredTasks.filter((task) => !isDone(task))
    if (activeView === 'completed') return filteredTasks.filter((task) => isDone(task))
    if (activeView === 'inbox') return remaining.filter((task) => !task.project)
    if (activeView === 'today') {
      return remaining.filter((task) => task.dueDate && task.dueDate <= todayRange.end)
    }
    if (activeView === 'upcoming') {
      return remaining.filter((task) => !task.dueDate || task.dueDate > todayRange.end)
    }
    if (activeView === 'all') return remaining
    if (activeProject) {
      return remaining.filter((task) => task.project === activeProject.name)
    }
    return remaining
  }, [activeProject, activeView, filteredTasks, todayRange.end])

  const listStories = useMemo(() => {
    if (activeView === 'today') {
      return visibleTasks.filter((task) => task.dueDate && task.dueDate <= todayRange.end)
    }
    if (activeView === 'upcoming') {
      return visibleTasks.filter((task) => !task.dueDate || task.dueDate > todayRange.end)
    }
    return visibleTasks
  }, [activeView, todayRange.end, visibleTasks])

  const counts = useMemo(() => {
    const remaining = tasks.filter((task) => !isDone(task))
    const inbox = remaining.filter((task) => !task.project).length
    const today = remaining.filter((task) => task.dueDate && task.dueDate <= todayRange.end).length
    const upcoming = remaining.filter((task) => task.dueDate && task.dueDate > todayRange.end).length
    const completed = tasks.filter((task) => isDone(task)).length
    return { inbox, today, upcoming, remaining: remaining.length, completed }
  }, [tasks, todayRange.end])

  const projectCounts = useMemo(() => {
    return projects.reduce<Record<string, number>>((acc, project) => {
      acc[project.id] = tasks.filter(
        (task) => !isDone(task) && task.project === project.name,
      ).length
      return acc
    }, {})
  }, [projects, tasks])

  useEffect(() => {
    if (!listStories.length) {
      setSelectedStoryId(null)
      return
    }
    if (!selectedStoryId || !listStories.some((task) => task.id === selectedStoryId)) {
      setSelectedStoryId(listStories[0].id)
    }
  }, [listStories, selectedStoryId])

  const handleRefresh = async () => {
    const ctx = await loadDb()
    setTasks(listTasks(ctx.db))
    setProjects(listProjects(ctx.db))
    await persistDb(ctx)
  }

  const handleUpdateStory = async (next: Task) => {
    const ctx = await loadDb()
    saveTask(ctx.db, next)
    await persistDb(ctx)
    await handleRefresh()
    setSelectedStoryId(next.id)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this story permanently?')) return
    const ctx = await loadDb()
    deleteTask(ctx.db, taskId)
    await persistDb(ctx)
    await handleRefresh()
  }

  const toggleComplete = async (task: Task) => {
    const ctx = await loadDb()
    const nextLane = isDone(task) ? defaultLane : doneLane
    updateLane(ctx.db, task.id, nextLane, task.swimlane || defaultSwimlane)
    await persistDb(ctx)
    await handleRefresh()
  }

  const handleQuickAdd = async () => {
    const title = quickTitle.trim()
    if (!title) return
    const now = Date.now()
    const dueDate = activeView === 'today' ? todayRange.start : null
    const projectName = activeProject?.name
    const ctx = await loadDb()
    saveTask(ctx.db, {
      id: crypto.randomUUID(),
      title,
      project: projectName,
      lane: defaultLane,
      swimlane: defaultSwimlane,
      createdAt: now,
      updatedAt: now,
      dueDate,
    })
    await persistDb(ctx)
    setQuickTitle('')
    await handleRefresh()
  }

  const handleSaveProject = async () => {
    const name = projectForm.name.trim()
    if (!name) return
    setSavingProject(true)
    try {
      const ctx = await loadDb()
      const now = Date.now()
      saveProject(ctx.db, {
        id: crypto.randomUUID(),
        name,
        description: undefined,
        createdAt: now,
        updatedAt: now,
      })
      await persistDb(ctx)
      setProjectForm({ name: '' })
      setProjectModalOpen(false)
      await handleRefresh()
    } finally {
      setSavingProject(false)
    }
  }

  const dueBadge = (task: Task) => {
    if (!task.dueDate) return 'No date'
    if (isSameDay(task.dueDate, todayRange.start)) return 'Today'
    const tomorrow = new Date(todayRange.start)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (isSameDay(task.dueDate, tomorrow.getTime())) return 'Tomorrow'
    return formatDate(task.dueDate)
  }

  const soonTasks = useMemo(() => {
    return filteredTasks
      .filter((task) => !isDone(task) && task.dueDate && task.dueDate >= todayRange.start)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 4)
  }, [filteredTasks, todayRange.start])

  const selectedStory = useMemo(
    () => listStories.find((task) => task.id === selectedStoryId) ?? null,
    [listStories, selectedStoryId],
  )

  useEffect(() => {
    setDraftStory(selectedStory)
    setEditingField(null)
  }, [selectedStory])

  const renderRichText = (value?: string) => {
    if (!value) return null
    return { __html: value }
  }

  const extractPreview = (value?: string) => {
    if (!value) return ''
    return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }

  if (loading) {
    return <div className="text-text-secondary">Loading todo list...</div>
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px,minmax(0,1fr),minmax(0,1fr)] lg:grid-cols-[220px,320px,minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-3xl border border-border bg-surface/80 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Sparkles size={16} />
            <span>My space</span>
          </div>
          <Input
            placeholder="Search or jump to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <nav className="space-y-1">
            {viewMeta.map((view) => {
              const selected = activeView === view.id
              return (
                <button
                  key={view.id}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-overlay-hover)]'
                  }`}
                  onClick={() => setActiveView(view.id)}
                >
                  <span className="inline-flex items-center gap-2">
                    <view.icon size={16} />
                    {view.label}
                  </span>
                  <span className="text-xs text-text-secondary/80">
                    {view.id === 'inbox' && counts.inbox}
                    {view.id === 'today' && counts.today}
                    {view.id === 'upcoming' && counts.upcoming}
                    {view.id === 'all' && counts.remaining}
                    {view.id === 'completed' && counts.completed}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="rounded-3xl border border-border bg-surface/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
          <p className="text-xs uppercase text-text-secondary">Epics</p>
            <Button size="sm" variant="ghost" onClick={() => setProjectModalOpen(true)}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <p className="text-sm text-text-secondary">No epics yet.</p>
            ) : null}
            {projects.map((project) => {
              const selected = activeView === `project:${project.id}`
              return (
                <button
                  key={project.id}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? 'bg-surface-2 text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-overlay-hover)]'
                  }`}
                  onClick={() => setActiveView(`project:${project.id}`)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Folder size={16} />
                    {project.name}
                  </span>
                  <span className="text-xs text-text-secondary/80">
                    {projectCounts[project.id] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface/80 p-4 space-y-3">
          <p className="text-xs uppercase text-text-secondary">Coming up</p>
          <div className="space-y-2">
            {soonTasks.length === 0 ? (
              <p className="text-sm text-text-secondary">No scheduled work yet.</p>
            ) : (
              soonTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-border/70 bg-background/40 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-text-primary">{task.title}</p>
                  <p className="text-xs text-text-secondary">{dueBadge(task)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface/80 p-4 space-y-3">
          <p className="text-xs uppercase text-text-secondary">Filters & Labels</p>
          <div className="flex flex-wrap gap-2">
            {['Priority', 'Next action', 'Waiting', 'Deep work'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-5 md:col-start-2">
        <div className="rounded-3xl border border-border bg-surface/80 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-text-secondary">Stories</p>
              <h2 className="text-2xl font-semibold text-text-primary">
                {activeProject?.name ||
                  viewMeta.find((view) => view.id === activeView)?.label ||
                  'All stories'}
              </h2>
              <p className="text-sm text-text-secondary">
                {activeView === 'today'
                  ? 'Focus on what must happen today.'
                  : activeView === 'upcoming'
                    ? 'Plan the next stretch of work.'
                    : activeView === 'completed'
                      ? 'Archive of completed stories.'
                      : 'Capture stories, then keep moving.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                quickAddRef.current?.focus()
              }}
            >
              <Plus size={16} /> Add story
            </Button>
              <Button size="sm" variant="ghost" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <Input
                ref={quickAddRef}
                placeholder="Add a story, then hit Enter"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickAdd()
                }}
              />
            </div>
            <Button size="sm" onClick={handleQuickAdd}>
              <Plus size={16} /> Quick add
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface/70 p-3">
          <div className="flex items-center justify-between px-2 pb-2 text-xs text-text-secondary">
            <span>{listStories.length} stories</span>
            <span>{activeView === 'completed' ? 'Archived' : 'Active'}</span>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {listStories.length === 0 ? (
              <div className="py-6 text-sm text-text-secondary px-2">
                Nothing here yet. Add a story to start.
              </div>
            ) : (
              listStories.map((task) => {
                const selected = task.id === selectedStoryId
                const preview = extractPreview(task.description || task.configNotes)
                return (
                  <button
                    key={task.id}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-accent bg-background'
                        : 'border-border/60 bg-surface/60 hover:border-accent/60 hover:bg-background/70'
                    }`}
                    onClick={() => setSelectedStoryId(task.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary truncate">{task.title}</p>
                        {preview ? (
                          <p className="mt-1 text-xs text-text-secondary line-clamp-2">{preview}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                          <span className="inline-flex items-center gap-1">
                            <Folder size={12} />
                            Epic: {task.project || 'None'}
                          </span>
                          <span>{task.lane}</span>
                          <span
                            className={
                              task.dueDate && task.dueDate < todayRange.start
                                ? 'text-red-300'
                                : undefined
                            }
                          >
                            {dueBadge(task)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${
                          isDone(task) ? 'bg-accent' : 'bg-text-secondary/40'
                        }`}
                      />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </section>

      <section className="md:col-start-3">
        <div className="rounded-3xl border border-border bg-surface/80 p-6 min-h-[520px] lg:sticky lg:top-24">
          {selectedStory ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-text-secondary">Story details</p>
                  {editingField === 'title' ? (
                    <Input
                      value={draftStory?.title ?? ''}
                      onChange={(e) =>
                        setDraftStory((prev) =>
                          prev ? { ...prev, title: e.target.value, updatedAt: Date.now() } : prev,
                        )
                      }
                      onBlur={() => {
                        if (draftStory) handleUpdateStory(draftStory)
                        setEditingField(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (draftStory) handleUpdateStory(draftStory)
                          setEditingField(null)
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="text-left"
                      onClick={() => setEditingField('title')}
                    >
                      <h3 className="text-2xl font-semibold text-text-primary">
                        {selectedStory.title}
                      </h3>
                    </button>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    {editingField === 'status' ? (
                      <Select
                        value={draftStory?.lane ?? selectedStory.lane}
                        onChange={(e) => {
                          const next = draftStory
                            ? { ...draftStory, lane: e.target.value, updatedAt: Date.now() }
                            : selectedStory
                          setDraftStory(next)
                          handleUpdateStory(next)
                          setEditingField(null)
                        }}
                      >
                        {lanes.map((lane) => (
                          <option key={lane}>{lane}</option>
                        ))}
                      </Select>
                    ) : (
                      <button onClick={() => setEditingField('status')}>
                        <Badge>{selectedStory.lane}</Badge>
                      </button>
                    )}
                    {editingField === 'epic' ? (
                      <Select
                        value={draftStory?.project ?? ''}
                        onChange={(e) => {
                          const value = e.target.value || undefined
                          const next = draftStory
                            ? { ...draftStory, project: value, updatedAt: Date.now() }
                            : { ...selectedStory, project: value, updatedAt: Date.now() }
                          setDraftStory(next)
                          handleUpdateStory(next)
                          setEditingField(null)
                        }}
                      >
                        <option value="">No epic</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.name}>
                            {project.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <button onClick={() => setEditingField('epic')}>
                        <Badge>{selectedStory.project || 'No epic'}</Badge>
                      </button>
                    )}
                    <Badge>{dueBadge(selectedStory)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleComplete(selectedStory)}
                    aria-label={isDone(selectedStory) ? 'Mark active' : 'Mark done'}
                  >
                    <CheckCircle2 size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTask(selectedStory.id)}
                    aria-label="Delete story"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-text-secondary">Start</p>
                  {editingField === 'start' ? (
                    <Input
                      type="date"
                      value={
                        draftStory?.startDate
                          ? new Date(draftStory.startDate).toISOString().slice(0, 10)
                          : ''
                      }
                      onChange={(e) => {
                        const next = draftStory
                          ? {
                              ...draftStory,
                              startDate: e.target.value ? Date.parse(e.target.value) : null,
                              updatedAt: Date.now(),
                            }
                          : draftStory
                        setDraftStory(next)
                      }}
                      onBlur={() => {
                        if (draftStory) handleUpdateStory(draftStory)
                        setEditingField(null)
                      }}
                    />
                  ) : (
                    <button onClick={() => setEditingField('start')}>
                      <p className="text-sm font-semibold text-text-primary">
                        {selectedStory.startDate
                          ? new Date(selectedStory.startDate).toLocaleDateString()
                          : 'Not set'}
                      </p>
                    </button>
                  )}
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-text-secondary">Due</p>
                  {editingField === 'due' ? (
                    <Input
                      type="date"
                      value={
                        draftStory?.dueDate
                          ? new Date(draftStory.dueDate).toISOString().slice(0, 10)
                          : ''
                      }
                      onChange={(e) => {
                        const next = draftStory
                          ? {
                              ...draftStory,
                              dueDate: e.target.value ? Date.parse(e.target.value) : null,
                              updatedAt: Date.now(),
                            }
                          : draftStory
                        setDraftStory(next)
                      }}
                      onBlur={() => {
                        if (draftStory) handleUpdateStory(draftStory)
                        setEditingField(null)
                      }}
                    />
                  ) : (
                    <button onClick={() => setEditingField('due')}>
                      <p className="text-sm font-semibold text-text-primary">
                        {selectedStory.dueDate
                          ? new Date(selectedStory.dueDate).toLocaleDateString()
                          : 'No deadline'}
                      </p>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase text-text-secondary">Description</p>
                {editingField === 'description' ? (
                  <div className="space-y-2">
                    <RichTextEditor
                      value={draftStory?.description ?? ''}
                      onChange={(value) =>
                        setDraftStory((prev) =>
                          prev ? { ...prev, description: value, updatedAt: Date.now() } : prev,
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (draftStory) handleUpdateStory(draftStory)
                        setEditingField(null)
                      }}
                    >
                      <Check size={16} /> Done
                    </Button>
                  </div>
                ) : selectedStory.description ? (
                  <button className="text-left w-full" onClick={() => setEditingField('description')}>
                    <div
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={renderRichText(selectedStory.description)}
                    />
                  </button>
                ) : (
                  <button onClick={() => setEditingField('description')}>
                    <p className="text-sm text-text-secondary">Add description...</p>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase text-text-secondary">Notes</p>
                {editingField === 'notes' ? (
                  <div className="space-y-2">
                    <RichTextEditor
                      value={draftStory?.configNotes ?? ''}
                      onChange={(value) =>
                        setDraftStory((prev) =>
                          prev ? { ...prev, configNotes: value, updatedAt: Date.now() } : prev,
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (draftStory) handleUpdateStory(draftStory)
                        setEditingField(null)
                      }}
                    >
                      <Check size={16} /> Done
                    </Button>
                  </div>
                ) : selectedStory.configNotes ? (
                  <button className="text-left w-full" onClick={() => setEditingField('notes')}>
                    <div
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={renderRichText(selectedStory.configNotes)}
                    />
                  </button>
                ) : (
                  <button onClick={() => setEditingField('notes')}>
                    <p className="text-sm text-text-secondary">Add notes...</p>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              Select a story to see details.
            </div>
          )}
        </div>
      </section>

      <Dialog open={projectModalOpen} onClose={() => setProjectModalOpen(false)} title="New epic">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Name</label>
            <Input
              value={projectForm.name}
              onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Epic name"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveProject} disabled={!projectForm.name.trim() || savingProject}>
              {savingProject ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default TodoPage
