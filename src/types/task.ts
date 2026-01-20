export type Task = {
  id: string
  title: string
  project?: string
  enablementId?: string
  description?: string
  configNotes?: string
  complexity?: 'XS' | 'S' | 'M' | 'L' | 'XL'
  timeValue?: number
  timeUnit?: 'h' | 'd'
  sprint?: string
  startDate?: number | null
  dueDate?: number | null
  impactPercent?: number | null
  okrLink?: string | null
  lane: string
  swimlane: string
  createdAt: number
  updatedAt: number
  latestUpdate?: string
  discussed?: boolean
}
