import { useEffect, useState } from 'react'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import RichTextEditor from '../../components/ui/RichTextEditor'
import type { MeetingNote } from '../../types/meetingNote'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (note: MeetingNote) => void
  initial?: MeetingNote | null
}

const MeetingNoteModal = ({ open, onClose, onSave, initial }: Props) => {
  const [form, setForm] = useState<MeetingNote>({
    id: crypto.randomUUID(),
    title: '',
    content: '',
    meetingDate: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  useEffect(() => {
    if (initial) {
      setForm(initial)
    } else {
      setForm({
        id: crypto.randomUUID(),
        title: '',
        content: '',
        meetingDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }, [initial, open])

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, title: form.title.trim(), updatedAt: Date.now() })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit note' : 'New note'}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Date / Time</label>
            <Input
              type="datetime-local"
              value={form.meetingDate ? new Date(form.meetingDate).toISOString().slice(0, 16) : ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meetingDate: e.target.value ? Date.parse(e.target.value) : null,
                }))
              }
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Attendees</label>
            <Input
              value={form.attendees ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
              placeholder="Comma separated"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Epic</label>
            <Input
              value={form.project ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Notes</label>
          <RichTextEditor
            value={form.content}
            onChange={(value) => setForm((f) => ({ ...f, content: value }))}
            placeholder="Decisions, actions, learnings..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{initial ? 'Save changes' : 'Save note'}</Button>
        </div>
      </div>
    </Dialog>
  )
}

export default MeetingNoteModal
