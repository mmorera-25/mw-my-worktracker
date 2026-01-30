import type { Database } from 'sql.js'

export type KanbanBucket = 'not-started' | 'working' | 'completed'

export const KANBAN_BUCKETS: { id: KanbanBucket; label: string }[] = [
  { id: 'not-started', label: 'Not started' },
  { id: 'working', label: 'Working on it' },
  { id: 'completed', label: 'Completed' },
]

export type WorkflowConfig = {
  columns: string[]
  swimlanes: string[]
  accent: 'indigo' | 'teal'
  savedStatusIndex?: number
  kanbanStatusBuckets: Record<string, KanbanBucket>
}

const defaultColumns = [
  'Backlog',
  'Scheduled',
  'On Hold / Waiting',
  'New',
  'To Ask',
  'To Do',
  'Done',
] as const

export const inferKanbanBucket = (status: string): KanbanBucket => {
  const lower = status.toLowerCase()
  if (['done', 'completed', 'complete', 'saved'].some((keyword) => lower.includes(keyword))) {
    return 'completed'
  }
  if (['progress', 'doing', 'work', 'active'].some((keyword) => lower.includes(keyword))) {
    return 'working'
  }
  if (['hold', 'blocked', 'wait', 'on hold'].some((keyword) => lower.includes(keyword))) {
    return 'working'
  }
  if (['ask', 'schedule', 'new', 'backlog'].some((keyword) => lower.includes(keyword))) {
    return 'not-started'
  }
  return 'not-started'
}

const buildDefaultBuckets = (columns: readonly string[]) => {
  const base: Record<string, KanbanBucket> = {}
  columns.forEach((status) => {
    base[status] = inferKanbanBucket(status)
  })
  base.Saved = 'completed'
  return base
}

const defaultConfig: WorkflowConfig = {
  columns: [...defaultColumns],
  swimlanes: ['Core', 'Enablement', 'Bugs'],
  accent: 'indigo',
  savedStatusIndex: undefined,
  kanbanStatusBuckets: buildDefaultBuckets(defaultColumns),
}

export const normalizeKanbanBuckets = (
  columns: string[],
  buckets?: Record<string, KanbanBucket> | null,
) => {
  const next: Record<string, KanbanBucket> = {}
  const source = buckets ?? {}
  columns.forEach((status) => {
    next[status] = source[status] ?? inferKanbanBucket(status)
  })
  next.Saved = source.Saved ?? 'completed'
  return next
}

const get_json = (db: Database, key: string) => {
  const stmt = db.prepare('SELECT value FROM user_config WHERE key = ?')
  stmt.bind([key])
  const value = stmt.step() ? (stmt.get()[0] as string) : null
  stmt.free()
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (error) {
    console.error(`Failed to parse user_config key "${key}":`, error)
    return null
  }
}

const set_json = (db: Database, key: string, value: any) => {
  const stmt = db.prepare(
    'INSERT INTO user_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  )
  stmt.run([key, JSON.stringify(value)])
  stmt.free()
}

export const loadWorkflowConfig = (db: Database): WorkflowConfig => {
  const storedColumns = get_json(db, 'kanban_columns') ?? defaultConfig.columns
  const columnsSet = new Set(storedColumns)
  let columns = storedColumns
  if (!columnsSet.has('To Ask')) {
    columns = ['Backlog', 'To Ask', ...columns.filter((col: string) => col !== 'Backlog')]
  }
  if (!columnsSet.has('Scheduled')) {
    columns = [
      'Backlog',
      'Scheduled',
      ...columns.filter((col: string) => col !== 'Backlog'),
    ]
  }
  if (!columnsSet.has('On Hold / Waiting')) {
    columns = [
      'Backlog',
      'Scheduled',
      'On Hold / Waiting',
      ...columns.filter((col: string) => !['Backlog', 'Scheduled'].includes(col)),
    ]
  }
  if (!new Set(columns).has('New')) {
    const toAskIndex = columns.findIndex((col: string) => col === 'To Ask')
    if (toAskIndex === -1) {
      columns = ['New', ...columns]
    } else {
      columns = [
        ...columns.slice(0, toAskIndex),
        'New',
        ...columns.slice(toAskIndex),
      ]
    }
  }
  if (columnsSet.has('Doing')) {
    columns = columns.filter((col: string) => col !== 'Doing')
  }
  const swimlanes = get_json(db, 'kanban_swimlanes') ?? defaultConfig.swimlanes
  const accent = (get_json(db, 'accent_color') as WorkflowConfig['accent'] | null) ?? 'indigo'
  const savedStatusIndex =
    (get_json(db, 'saved_status_index') as number | null) ?? defaultConfig.savedStatusIndex
  const storedBuckets = get_json(db, 'kanban_status_buckets') as
    | Record<string, KanbanBucket>
    | null
  const kanbanStatusBuckets = normalizeKanbanBuckets(columns, storedBuckets ?? defaultConfig.kanbanStatusBuckets)
  return { columns, swimlanes, accent, savedStatusIndex, kanbanStatusBuckets }
}

export const saveWorkflowConfig = (db: Database, config: WorkflowConfig) => {
  set_json(db, 'kanban_columns', config.columns)
  set_json(db, 'kanban_swimlanes', config.swimlanes)
  set_json(db, 'accent_color', config.accent)
  if (typeof config.savedStatusIndex === 'number') {
    set_json(db, 'saved_status_index', config.savedStatusIndex)
  }
  set_json(db, 'kanban_status_buckets', config.kanbanStatusBuckets)
}
