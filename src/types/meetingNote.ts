export type MeetingNote = {
  id: string
  title: string
  content: string
  color?: string
  project?: string
  attendees?: string
  meetingDate?: number | null
  createdAt: number
  updatedAt: number
}
