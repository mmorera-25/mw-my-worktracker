import type { Database } from 'sql.js'
import type { Task } from '../../types/task'
import type { TaskComment } from '../../types/comment'
import { mapRowToTask } from '../kanban/taskRepository'

export const listFeedTasks = (db: Database): Task[] => {
  const stmt = db.prepare(
    `SELECT id, title, project, enablement_id, description, config_notes, complexity, time_value, time_unit, sprint, start_date, due_date, impact_percent, okr_link, lane, swimlane, created_at, updated_at, latest_update, discussed
     FROM tasks
     WHERE lane IN ('Backlog','To Do','Done')
     ORDER BY updated_at DESC`,
  )
  const tasks: Task[] = []
  while (stmt.step()) tasks.push(mapRowToTask(stmt.get()))
  stmt.free()
  return tasks
}

export const listComments = (db: Database): TaskComment[] => {
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

export const addComment = (db: Database, taskId: string, content: string, author: string) => {
  const now = Date.now()
  const stmt = db.prepare(
    'INSERT INTO task_comments (id, task_id, content, author, created_at) VALUES (?,?,?,?,?)',
  )
  stmt.run([crypto.randomUUID(), taskId, content, author, now])
  stmt.free()
  db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [now, taskId])
}

export const updateComment = (db: Database, commentId: string, content: string) => {
  const now = Date.now()
  db.run('UPDATE task_comments SET content = ? WHERE id = ?', [content, commentId])
  db.run('UPDATE tasks SET updated_at = ? WHERE id = (SELECT task_id FROM task_comments WHERE id = ?)', [
    now,
    commentId,
  ])
}

export const deleteComment = (db: Database, commentId: string) => {
  const stmt = db.prepare('SELECT task_id FROM task_comments WHERE id = ?')
  stmt.bind([commentId])
  const taskId = stmt.step() ? (stmt.get()[0] as string) : null
  stmt.free()
  db.run('DELETE FROM task_comments WHERE id = ?', [commentId])
  if (taskId) {
    db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [Date.now(), taskId])
  }
}

export const updateLatestUpdate = (db: Database, taskId: string, content: string) => {
  const now = Date.now()
  db.run('UPDATE tasks SET latest_update = ?, updated_at = ? WHERE id = ?', [
    content,
    now,
    taskId,
  ])
}

export const toggleDiscussed = (db: Database, taskId: string, discussed: boolean) => {
  db.run('UPDATE tasks SET discussed = ?, updated_at = ? WHERE id = ?', [
    discussed ? 1 : 0,
    Date.now(),
    taskId,
  ])
}
