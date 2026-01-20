import { useEffect, useState } from 'react'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import type { OKR, KeyResult } from '../../types/okr'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (okr: OKR) => void
  onDelete?: (id: string) => void
  initial?: OKR | null
}

const OKRModal = ({ open, onClose, onSave, onDelete, initial }: Props) => {
  const [okr, setOkr] = useState<OKR>({
    id: crypto.randomUUID(),
    objective: '',
    impactWeight: 0.1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    keyResults: [],
  })

  useEffect(() => {
    if (initial) {
      setOkr(initial)
    } else {
      const now = Date.now()
      setOkr({
        id: crypto.randomUUID(),
        objective: '',
        impactWeight: 0.1,
        createdAt: now,
        updatedAt: now,
        keyResults: [],
      })
    }
  }, [initial, open])

  const updateKr = (id: string, patch: Partial<KeyResult>) => {
    setOkr((prev) => ({
      ...prev,
      keyResults: prev.keyResults.map((kr) => (kr.id === id ? { ...kr, ...patch } : kr)),
    }))
  }

  const addKr = () => {
    const now = Date.now()
    setOkr((prev) => ({
      ...prev,
      keyResults: [
        ...prev.keyResults,
        { id: crypto.randomUUID(), okrId: prev.id, title: '', target: 1, current: 0, createdAt: now, updatedAt: now },
      ],
    }))
  }

  const removeKr = (id: string) => {
    setOkr((prev) => ({ ...prev, keyResults: prev.keyResults.filter((kr) => kr.id !== id) }))
  }

  const handleSave = () => {
    if (!okr.objective.trim()) return
    const now = Date.now()
    onSave({
      ...okr,
      objective: okr.objective.trim(),
      updatedAt: now,
      keyResults: okr.keyResults.map((kr) => ({
        ...kr,
        okrId: okr.id,
        title: kr.title.trim(),
        updatedAt: now,
      })),
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit OKR' : 'New OKR'}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Objective</label>
            <Input
              value={okr.objective}
              onChange={(e) => setOkr((o) => ({ ...o, objective: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Impact weight (0-1)</label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={okr.impactWeight}
              onChange={(e) => setOkr((o) => ({ ...o, impactWeight: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Key Results</p>
            <Button size="sm" variant="ghost" onClick={addKr}>
              Add KR
            </Button>
          </div>
          <div className="space-y-3">
            {okr.keyResults.map((kr) => (
              <Card key={kr.id} className="p-3 bg-background space-y-2">
                <Input
                  value={kr.title}
                  onChange={(e) => updateKr(kr.id, { title: e.target.value })}
                  placeholder="Key result"
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    type="number"
                    value={kr.target}
                    onChange={(e) => updateKr(kr.id, { target: Number(e.target.value) || 0 })}
                    placeholder="Target"
                  />
                  <Input
                    type="number"
                    value={kr.current}
                    onChange={(e) => updateKr(kr.id, { current: Number(e.target.value) || 0 })}
                    placeholder="Current"
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => removeKr(kr.id)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
            {okr.keyResults.length === 0 ? (
              <p className="text-sm text-text-secondary">No key results yet.</p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-between">
          {initial && onDelete ? (
            <Button variant="ghost" onClick={() => onDelete(initial.id)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{initial ? 'Save changes' : 'Save OKR'}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default OKRModal
