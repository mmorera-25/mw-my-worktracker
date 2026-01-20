import { Database, Statement } from 'sql.js'
import type { Task } from '../../types/task'

const taskColumns = [
  'id',
  'title',
  'project',
  'enablement_id',
  'description',
  'config_notes',
  'complexity',
  'time_value',
  'time_unit',
  'sprint',
  'start_date',
  'due_date',
  'impact_percent',
  'okr_link',
  'lane',
  'swimlane',
  'created_at',
  'updated_at',
  'latest_update',
  'discussed',
] as const

export const mapRowToTask = (row: any[]): Task => ({
  id: row[0],
  title: row[1],
  project: row[2] || undefined,
  enablementId: row[3] || undefined,
  description: row[4] || undefined,
  configNotes: row[5] || undefined,
  complexity: (row[6] as Task['complexity']) || undefined,
  timeValue: row[7] ?? undefined,
  timeUnit: (row[8] as Task['timeUnit']) || undefined,
  sprint: row[9] || undefined,
  startDate: (row[10] as number) ?? null,
  dueDate: (row[11] as number) ?? null,
  impactPercent: (row[12] as number) ?? null,
  okrLink: (row[13] as string) ?? null,
  lane: row[14] || 'Backlog',
  swimlane: row[15] || 'Core',
  createdAt: row[16],
  updatedAt: row[17],
  latestUpdate: row[18] || undefined,
  discussed: Boolean(row[19]),
})

export const listTasks = (db: Database): Task[] => {
  const stmt = db.prepare(
    `SELECT ${taskColumns.join(', ')} FROM tasks ORDER BY updated_at DESC`,
  )
  const tasks: Task[] = []
  while (stmt.step()) {
    tasks.push(mapRowToTask(stmt.get()))
  }
  stmt.free()
  return tasks
}

const upsertStmt = (db: Database): Statement =>
  db.prepare(`
    INSERT INTO tasks (${taskColumns.join(', ')})
    VALUES (${taskColumns.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      project=excluded.project,
      enablement_id=excluded.enablement_id,
      description=excluded.description,
      config_notes=excluded.config_notes,
      complexity=excluded.complexity,
      time_value=excluded.time_value,
      time_unit=excluded.time_unit,
      sprint=excluded.sprint,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      impact_percent=excluded.impact_percent,
      okr_link=excluded.okr_link,
      lane=excluded.lane,
      swimlane=excluded.swimlane,
      updated_at=excluded.updated_at;
  `)

export const saveTask = (db: Database, task: Task) => {
  const stmt = upsertStmt(db)
  stmt.run([
    task.id,
    task.title,
    task.project ?? null,
    task.enablementId ?? null,
    task.description ?? null,
    task.configNotes ?? null,
    task.complexity ?? null,
    task.timeValue ?? null,
    task.timeUnit ?? null,
    task.sprint ?? null,
    task.startDate ?? null,
    task.dueDate ?? null,
    task.impactPercent ?? null,
    task.okrLink ?? null,
    task.lane,
    task.swimlane,
    task.createdAt,
    task.updatedAt,
    task.latestUpdate ?? null,
    task.discussed ? 1 : 0,
  ])
  stmt.free()
}

export const deleteTask = (db: Database, id: string) => {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  stmt.run([id])
  stmt.free()
}

export const updateLane = (db: Database, id: string, lane: string, swimlane: string) => {
  const stmt = db.prepare(
    'UPDATE tasks SET lane = ?, swimlane = ?, updated_at = ? WHERE id = ?',
  )
  stmt.run([lane, swimlane, Date.now(), id])
  stmt.free()
}

export const getConfigDefaults = (db: Database) => {
  const fetch = db.prepare('SELECT value FROM user_config WHERE key = ?')
  fetch.bind(['kanban_columns'])
  const columnsRow = fetch.step() ? (fetch.get()[0] as string) : null
  fetch.reset()
  fetch.bind(['kanban_swimlanes'])
  const swimRow = fetch.step() ? (fetch.get()[0] as string) : null
  fetch.free()
  return {
    columns: columnsRow ? JSON.parse(columnsRow) : ['Backlog', 'To Do', 'Doing', 'Done'],
    swimlanes: swimRow ? JSON.parse(swimRow) : ['Core', 'Enablement', 'Bugs'],
  }
}
