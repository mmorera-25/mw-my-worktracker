import type { Database } from 'sql.js'
import type { OKR, KeyResult } from '../../types/okr'
import type { Task } from '../../types/task'
import { mapRowToTask } from '../kanban/taskRepository'

const okrColumns = ['id', 'objective', 'impact_weight', 'created_at', 'updated_at'] as const
const krColumns = [
  'id',
  'okr_id',
  'title',
  'target',
  'current',
  'created_at',
  'updated_at',
] as const

const mapOkrs = (rows: any[][]) =>
  rows.map(
    (row) =>
      ({
        id: row[0],
        objective: row[1],
        impactWeight: Number(row[2] ?? 0),
        createdAt: row[3],
        updatedAt: row[4],
        keyResults: [],
      }) as OKR,
  )

const mapKrs = (rows: any[][]): KeyResult[] =>
  rows.map((row) => ({
    id: row[0],
    okrId: row[1],
    title: row[2],
    target: Number(row[3] ?? 0),
    current: Number(row[4] ?? 0),
    createdAt: row[5],
    updatedAt: row[6],
  }))

export const listOkrs = (db: Database): OKR[] => {
  const okrStmt = db.prepare(`SELECT ${okrColumns.join(', ')} FROM okrs ORDER BY updated_at DESC`)
  const okrRows: any[][] = []
  while (okrStmt.step()) okrRows.push(okrStmt.get())
  okrStmt.free()
  const okrs = mapOkrs(okrRows)
  const krStmt = db.prepare(
    `SELECT ${krColumns.join(', ')} FROM okr_key_results ORDER BY okr_id, updated_at DESC`,
  )
  const krRows: any[][] = []
  while (krStmt.step()) krRows.push(krStmt.get())
  krStmt.free()
  const krs = mapKrs(krRows)
  const grouped = okrs.reduce<Record<string, OKR>>((acc, okr) => {
    acc[okr.id] = okr
    return acc
  }, {})
  krs.forEach((kr) => {
    const parent = grouped[kr.okrId]
    if (parent) parent.keyResults.push(kr)
  })
  return Object.values(grouped)
}

export const saveOkr = (db: Database, okr: OKR) => {
  db.run('BEGIN;')
  try {
    const okrStmt = db.prepare(
      `INSERT INTO okrs (${okrColumns.join(',')}) VALUES (?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
        objective=excluded.objective,
        impact_weight=excluded.impact_weight,
        updated_at=excluded.updated_at;`,
    )
    okrStmt.run([okr.id, okr.objective, okr.impactWeight, okr.createdAt, okr.updatedAt])
    okrStmt.free()

    const deleteKr = db.prepare('DELETE FROM okr_key_results WHERE okr_id = ?')
    deleteKr.run([okr.id])
    deleteKr.free()

    const krStmt = db.prepare(
      `INSERT INTO okr_key_results (${krColumns.join(',')}) VALUES (?,?,?,?,?,?,?)`,
    )
    okr.keyResults.forEach((kr) =>
      krStmt.run([kr.id, okr.id, kr.title, kr.target, kr.current, kr.createdAt, kr.updatedAt]),
    )
    krStmt.free()
    db.run('COMMIT;')
  } catch (error) {
    db.run('ROLLBACK;')
    throw error
  }
}

export const deleteOkr = (db: Database, id: string) => {
  db.run('BEGIN;')
  try {
    db.run('DELETE FROM okr_key_results WHERE okr_id = ?', [id])
    db.run('DELETE FROM okrs WHERE id = ?', [id])
    db.run('COMMIT;')
  } catch (error) {
    db.run('ROLLBACK;')
    throw error
  }
}

export const tasksForOkr = (db: Database, okrId: string): Task[] => {
  const stmt = db.prepare(
    `SELECT id, title, project, enablement_id, description, config_notes, complexity, time_value, time_unit, sprint, start_date, due_date, impact_percent, okr_link, lane, swimlane, created_at, updated_at
     FROM tasks WHERE okr_link = ? ORDER BY updated_at DESC`,
  )
  stmt.bind([okrId])
  const tasks: Task[] = []
  while (stmt.step()) tasks.push(mapRowToTask(stmt.get()))
  stmt.free()
  return tasks
}
