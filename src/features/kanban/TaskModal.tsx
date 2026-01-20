import { useEffect, useState } from 'react'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import RichTextEditor from '../../components/ui/RichTextEditor'
import type { Task } from '../../types/task'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (task: Task) => void
  initial?: Task
  lanes: string[]
  swimlanes: string[]
  projects?: string[]
}

const complexities: Task['complexity'][] = ['XS', 'S', 'M', 'L', 'XL']
const timeUnits: Task['timeUnit'][] = ['h', 'd']
const projectDatalistId = 'projects-suggestions'

const TaskModal = ({
  open,
  onClose,
  onSave,
  initial,
  lanes,
  swimlanes,
  projects = [],
}: Props) => {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Task>(() => {
    const now = Date.now()
    return {
      id: crypto.randomUUID(),
      title: '',
      lane: lanes[0] ?? 'Backlog',
      swimlane: swimlanes[0] ?? 'Core',
      createdAt: now,
      updatedAt: now,
      startDate: now,
    }
  })

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        startDate: initial.startDate ?? initial.createdAt,
      })
      setStep(0)
    } else {
      const now = Date.now()
      setForm((prev) => ({
        ...prev,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        startDate: now,
      }))
      setStep(0)
    }
  }, [initial, open])

  const handleChange = (field: keyof Task, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value, updatedAt: Date.now() }))
  }

  const handleSubmit = () => {
    if (!form.title.trim()) return
    onSave({ ...form, title: form.title.trim() })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit story' : 'New story'}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="flex items-center gap-2">
          {[0, 1].map((idx) => (
            <span
              key={idx}
              className={`h-2 w-full rounded-full ${step === idx ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <Card className="p-4 space-y-4 bg-background">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Title</label>
              <Input
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Story title"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Epic</label>
                <Input
                  value={form.project ?? ''}
                  onChange={(e) => handleChange('project', e.target.value)}
                  list={projects.length ? projectDatalistId : undefined}
                />
                {projects.length ? (
                  <datalist id={projectDatalistId}>
                    {projects.map((project) => (
                      <option key={project} value={project} />
                    ))}
                  </datalist>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Enablement ID</label>
                <Input
                  value={form.enablementId ?? ''}
                  onChange={(e) => handleChange('enablementId', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Complexity</label>
                <Select
                  value={form.complexity ?? ''}
                  onChange={(e) => handleChange('complexity', e.target.value as Task['complexity'])}
                >
                  <option value="">Select</option>
                  {complexities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Time</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={form.timeValue ?? ''}
                    onChange={(e) =>
                      handleChange('timeValue', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                  <Select
                    value={form.timeUnit ?? ''}
                    onChange={(e) => handleChange('timeUnit', e.target.value as Task['timeUnit'])}
                  >
                    <option value="">Unit</option>
                    {timeUnits.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Status</label>
                <Select value={form.lane} onChange={(e) => handleChange('lane', e.target.value)}>
                  {lanes.map((lane) => (
                    <option key={lane}>{lane}</option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="p-4 space-y-4 bg-background">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Start</label>
                <Input
                  type="date"
                  value={form.startDate ? new Date(form.startDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    handleChange('startDate', e.target.value ? Date.parse(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">Due</label>
                <Input
                  type="date"
                  value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    handleChange('dueDate', e.target.value ? Date.parse(e.target.value) : null)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Description</label>
              <RichTextEditor
                value={form.description ?? ''}
                onChange={(value) => handleChange('description', value)}
                placeholder="Describe the work, scope, risks..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Config notes</label>
              <RichTextEditor
                value={form.configNotes ?? ''}
                onChange={(value) => handleChange('configNotes', value)}
                placeholder="Architecture, decisions, integrations..."
              />
            </div>
          </Card>
        ) : null}

        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
            ) : null}
            {step < 1 ? (
              <Button onClick={() => setStep((s) => Math.min(1, s + 1))}>Next</Button>
            ) : (
              <Button onClick={handleSubmit}>{initial ? 'Save changes' : 'Create story'}</Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default TaskModal
