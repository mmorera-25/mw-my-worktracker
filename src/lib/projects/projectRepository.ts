import type { Database } from 'sql.js'
import type { Project } from '../../types/project'

export const listProjects = (db: Database): Project[] => {
  const stmt = db.prepare(
    'SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at DESC',
  )
  const projects: Project[] = []
  while (stmt.step()) {
    const row = stmt.get()
    projects.push({
      id: row[0],
      name: row[1],
      description: row[2] ?? '',
      createdAt: row[3],
      updatedAt: row[4],
    })
  }
  stmt.free()
  return projects
}

export const saveProject = (db: Database, project: Project) => {
  const stmt = db.prepare(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=excluded.updated_at',
  )
  stmt.run([
    project.id,
    project.name,
    project.description ?? null,
    project.createdAt,
    project.updatedAt,
  ])
  stmt.free()
}

export const deleteProject = (db: Database, projectId: string) => {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
  stmt.run([projectId])
  stmt.free()
}
