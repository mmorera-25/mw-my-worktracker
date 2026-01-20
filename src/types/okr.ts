export type KeyResult = {
  id: string
  okrId: string
  title: string
  target: number
  current: number
  createdAt: number
  updatedAt: number
}

export type OKR = {
  id: string
  objective: string
  impactWeight: number
  createdAt: number
  updatedAt: number
  keyResults: KeyResult[]
}
