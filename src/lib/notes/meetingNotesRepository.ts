import type { Database } from 'sql.js'
import type { MeetingNote } from '../../types/meetingNote'

const columns = [
  'id',
  'title',
  'content',
  'color',
  'project',
  'attendees',
  'meeting_date',
  'created_at',
  'updated_at',
] as const

const mapRow = (row: any[]): MeetingNote => ({
  id: row[0],
  title: row[1],
  content: row[2] || '',
  color: row[3] || undefined,
  project: row[4] || undefined,
  attendees: row[5] || undefined,
  meetingDate: (row[6] as number) ?? null,
  createdAt: Number(row[7] ?? 0),
  updatedAt: Number(row[8] ?? 0),
})

export const listNotes = (db: Database): MeetingNote[] => {
  const stmt = db.prepare(
    `SELECT ${columns.join(', ')} FROM meeting_notes ORDER BY meeting_date DESC, updated_at DESC`,
  )
  const notes: MeetingNote[] = []
  while (stmt.step()) {
    notes.push(mapRow(stmt.get()))
  }
  stmt.free()
  return notes
}

export const saveNote = (db: Database, note: MeetingNote) => {
  const placeholders = columns.map(() => '?').join(', ')
  const stmt = db.prepare(
    `INSERT INTO meeting_notes (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      content=excluded.content,
      color=excluded.color,
      project=excluded.project,
      attendees=excluded.attendees,
      meeting_date=excluded.meeting_date,
      created_at=excluded.created_at,
      updated_at=excluded.updated_at;`,
  )
  stmt.run([
    note.id,
    note.title,
    note.content,
    note.color ?? null,
    note.project ?? null,
    note.attendees ?? null,
    note.meetingDate ?? null,
    note.createdAt,
    note.updatedAt,
  ])
  stmt.free()
}

export const deleteNote = (db: Database, id: string) => {
  const stmt = db.prepare('DELETE FROM meeting_notes WHERE id = ?')
  stmt.run([id])
  stmt.free()
}
