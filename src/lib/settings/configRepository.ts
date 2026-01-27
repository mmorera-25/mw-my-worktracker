import type { Database } from 'sql.js'

export type WorkflowConfig = {
  columns: string[]
  swimlanes: string[]
  accent: 'indigo' | 'teal'
}

const defaultConfig: WorkflowConfig = {
  columns: ['Backlog', 'Scheduled', 'On Hold / Waiting', 'New', 'To Ask', 'To Do', 'Done'],
  swimlanes: ['Core', 'Enablement', 'Bugs'],
  accent: 'indigo',
}

const get_json = (db: Database, key: string) => {
  const stmt = db.prepare('SELECT value FROM user_config WHERE key = ?')
  stmt.bind([key])
  const value = stmt.step() ? (stmt.get()[0] as string) : null
  stmt.free()
  return value ? JSON.parse(value) : null
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
  return { columns, swimlanes, accent }
}

export const saveWorkflowConfig = (db: Database, config: WorkflowConfig) => {
  set_json(db, 'kanban_columns', config.columns)
  set_json(db, 'kanban_swimlanes', config.swimlanes)
  set_json(db, 'accent_color', config.accent)
}
