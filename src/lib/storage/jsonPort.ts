import type { Database } from 'sql.js'
import type { Task } from '../../types/task'
import type { MeetingNote } from '../../types/meetingNote'
import type { TaskComment } from '../../types/comment'
import type { OKR } from '../../types/okr'
import type { Project } from '../../types/project'
import { listTasks, saveTask } from '../kanban/taskRepository'
import { listNotes, saveNote } from '../notes/meetingNotesRepository'
import { listOkrs, saveOkr } from '../okr/okrRepository'
import { listProjects } from '../projects/projectRepository'
import { loadFromIdb, saveToIdb } from './idbFallback'
import { serialize } from './sqliteWasm'

export type Snapshot = {
  tasks: Task[]
  meetingNotes: MeetingNote[]
  okrs: OKR[]
  comments: TaskComment[]
  projects: Project[]
  userConfig: Record<string, string>
}

const listComments = (db: Database): TaskComment[] => {
  const stmt = db.prepare(
    'SELECT id, task_id, content, author, created_at FROM task_comments ORDER BY created_at DESC',
  )
  const comments: TaskComment[] = []
  while (stmt.step()) {
    const row = stmt.get()
    comments.push({
      id: row[0],
      taskId: row[1],
      content: row[2],
      author: typeof row[3] === 'string' && row[3].trim() ? row[3] : 'User',
      createdAt: row[4],
    })
  }
  stmt.free()
  return comments
}

const listUserConfig = (db: Database) => {
  const stmt = db.prepare('SELECT key, value FROM user_config')
  const data: Record<string, string> = {}
  while (stmt.step()) {
    const row = stmt.get()
    data[row[0] as string] = row[1] as string
  }
  stmt.free()
  return data
}

export const exportSnapshot = (db: Database): Snapshot => ({
  tasks: listTasks(db),
  meetingNotes: listNotes(db),
  okrs: listOkrs(db),
  comments: listComments(db),
  projects: listProjects(db),
  userConfig: listUserConfig(db),
})

const insertComments = (db: Database, comments: TaskComment[]) => {
  const stmt = db.prepare(
    'INSERT INTO task_comments (id, task_id, content, author, created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content, author=excluded.author, created_at=excluded.created_at',
  )
  comments.forEach((c) => stmt.run([c.id, c.taskId, c.content, c.author, c.createdAt]))
  stmt.free()
}

const insertProjects = (db: Database, projects: Project[]) => {
  const stmt = db.prepare(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=excluded.updated_at',
  )
  projects.forEach((p) =>
    stmt.run([p.id, p.name, p.description ?? null, p.createdAt, p.updatedAt]),
  )
  stmt.free()
}

const insertUserConfig = (db: Database, config: Record<string, string>) => {
  const stmt = db.prepare(
    'INSERT INTO user_config (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  )
  Object.entries(config).forEach(([key, value]) => stmt.run([key, value]))
  stmt.free()
}

export type ImportStrategy = 'merge' | 'overwrite'

export const importSnapshot = (db: Database, snap: Snapshot, strategy: ImportStrategy) => {
  db.run('BEGIN;')
  try {
    if (strategy === 'overwrite') {
      db.run('DELETE FROM task_comments')
      db.run('DELETE FROM meeting_notes')
      db.run('DELETE FROM tasks')
      db.run('DELETE FROM okr_key_results')
      db.run('DELETE FROM okrs')
      db.run('DELETE FROM user_config')
    }
    snap.okrs.forEach((okr) => saveOkr(db, okr))
    snap.tasks.forEach((t) => saveTask(db, t))
    snap.meetingNotes.forEach((n) => saveNote(db, n))
    insertComments(db, snap.comments)
    insertProjects(db, snap.projects)
    insertUserConfig(db, snap.userConfig)
    db.run('COMMIT;')
  } catch (error) {
    db.run('ROLLBACK;')
    throw error
  }
}

export const backupIdbToJson = async (db: Database) => {
  const data = serialize(db)
  await saveToIdb(data)
}

export const loadIdbBytes = async () => loadFromIdb()
