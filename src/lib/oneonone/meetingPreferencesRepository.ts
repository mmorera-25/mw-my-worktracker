import type { Database } from 'sql.js'

export type MeetingParticipantRole = 'management' | 'normal' | 'supervised' | 'general'

export type MeetingParticipant = {
  id: string
  name: string
  role: MeetingParticipantRole
  selectedTaskIds: string[]
  meetingNotes: MeetingNote[]
}

export type MeetingNote = {
  id: string
  createdAt: number
  content: string
  title?: string
  selectedEpicIds: string[]
  discussedStoryIds: string[]
  questionEpicId?: string
  questionStoryIds?: string[]
  questionStorySnapshots?: QuestionStorySnapshot[]
  selectedStoryIds?: string[]
  participants?: string[]
}

type QuestionStorySnapshot = {
  id: string
  title?: string
  epicId?: string
}

const getJson = (db: Database, key: string) => {
  const stmt = db.prepare('SELECT value FROM user_config WHERE key = ?')
  stmt.bind([key])
  const value = stmt.step() ? (stmt.get()[0] as string) : null
  stmt.free()
  return value ? JSON.parse(value) : null
}

const setJson = (db: Database, key: string, value: unknown) => {
  const stmt = db.prepare(
    'INSERT INTO user_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  )
  stmt.run([key, JSON.stringify(value)])
  stmt.free()
}

const normalizeParticipant = (raw: Partial<MeetingParticipant>): MeetingParticipant => {
  const legacyNotes = typeof (raw as { notes?: string }).notes === 'string'
    ? (raw as { notes?: string }).notes ?? ''
    : ''
  const meetingNotes = Array.isArray(raw.meetingNotes)
    ? raw.meetingNotes
        .filter((note) => note && typeof note.content === 'string')
        .map((note) => ({
          id: note.id || crypto.randomUUID(),
          createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
          content: note.content,
          title: typeof note.title === 'string' ? note.title : undefined,
          selectedEpicIds: Array.isArray(note.selectedEpicIds) ? note.selectedEpicIds : [],
          discussedStoryIds: Array.isArray(note.discussedStoryIds) ? note.discussedStoryIds : [],
          questionEpicId:
            typeof note.questionEpicId === 'string' ? note.questionEpicId : undefined,
          questionStoryIds: Array.isArray(note.questionStoryIds)
            ? note.questionStoryIds.filter((id) => typeof id === 'string')
            : undefined,
          questionStorySnapshots: Array.isArray(note.questionStorySnapshots)
            ? note.questionStorySnapshots
                .map((snapshot) => ({
                  id:
                    typeof snapshot.id === 'string'
                      ? snapshot.id
                      : crypto.randomUUID(),
                  title:
                    typeof snapshot.title === 'string'
                      ? snapshot.title
                      : 'Untitled story',
                  epicId: typeof snapshot.epicId === 'string' ? snapshot.epicId : '',
                }))
                .filter((snapshot) => Boolean(snapshot.id))
            : undefined,
          selectedStoryIds: Array.isArray(note.selectedStoryIds)
            ? note.selectedStoryIds
            : undefined,
          participants: Array.isArray(note.participants)
            ? note.participants.filter((p) => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
            : undefined,
        }))
    : []

  if (!meetingNotes.length && legacyNotes.trim()) {
    meetingNotes.push({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      content: legacyNotes.trim(),
      selectedEpicIds: [],
      discussedStoryIds: [],
    })
  }

  return {
    id: raw.id || '',
    name: raw.name || 'Unnamed',
    role: (raw.role as MeetingParticipantRole) || 'normal',
    selectedTaskIds: Array.isArray(raw.selectedTaskIds) ? raw.selectedTaskIds : [],
    meetingNotes,
  }
}

export const loadMeetingParticipants = (db: Database): MeetingParticipant[] => {
  const raw = getJson(db, 'meeting_participants')
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => normalizeParticipant(entry))
}

export const saveMeetingParticipants = (db: Database, participants: MeetingParticipant[]) => {
  setJson(db, 'meeting_participants', participants)
}
