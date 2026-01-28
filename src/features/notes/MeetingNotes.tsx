import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import RichTextEditor from '../../components/ui/RichTextEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@inbox/components/ui/select'
import type { MeetingNote } from '../../types/meetingNote'
import { loadDb, persistDb } from '../../lib/storage/dbManager'
import { listNotes, saveNote, deleteNote } from '../../lib/notes/meetingNotesRepository'
import { Trash2, Check } from 'lucide-react'

const colorOptions = [
  { value: 'hsl(210, 60%, 92%)', label: 'Cloud Blue' },
  { value: 'hsl(340, 70%, 92%)', label: 'Blush' },
  { value: 'hsl(150, 60%, 90%)', label: 'Mint Fog' },
  { value: 'hsl(30, 70%, 92%)', label: 'Apricot' },
  { value: 'hsl(260, 50%, 90%)', label: 'Lavender Mist' },
  { value: 'hsl(200, 60%, 90%)', label: 'Sea Breeze' },
  { value: 'hsl(25, 70%, 90%)', label: 'Peach Bloom' },
  { value: 'hsl(50, 80%, 90%)', label: 'Sunny Cream' },
  { value: 'hsl(170, 40%, 90%)', label: 'Pistachio' },
  { value: 'hsl(330, 60%, 92%)', label: 'Rose Quartz' },
  { value: 'hsl(190, 60%, 92%)', label: 'Ice Flow' },
  { value: 'hsl(290, 45%, 92%)', label: 'Lilac Whisper' },
  { value: 'hsl(10, 70%, 90%)', label: 'Coral Cloud' },
  { value: 'hsl(80, 60%, 88%)', label: 'Limeade' },
  { value: 'hsl(0, 0%, 95%)', label: 'Paper White' },
]
const defaultColor = 'hsl(210, 60%, 92%)'

type MeetingNotesProps = {
  lanes?: string[]
  swimlanes?: string[]
}

const MeetingNotes = ({
  lanes: _lanes,
  swimlanes: _swimlanes,
}: MeetingNotesProps) => {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [draftColor, setDraftColor] = useState(defaultColor)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const newNote = (): MeetingNote => ({
    id: crypto.randomUUID(),
    title: '',
    content: '',
    color: defaultColor,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meetingDate: Date.now(),
  })

  useEffect(() => {
    const refreshNotes = async () => {
      try {
        const ctx = await loadDb()
        const loaded = listNotes(ctx.db)
        setNotes(loaded)
        await persistDb(ctx)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting notes.')
      } finally {
        setLoading(false)
      }
    }
    refreshNotes()
    const handleFocus = () => {
      refreshNotes()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return notes
    return notes.filter((n) => {
      const haystack = `${n.title} ${n.content}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [notes, search])

  const handleSave = async (note: MeetingNote) => {
    setSaving(true)
    setError(null)
    try {
      const ctx = await loadDb()
      saveNote(ctx.db, note)
      await persistDb(ctx)
      setNotes(listNotes(ctx.db))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meeting note.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (note: MeetingNote) => {
    setEditingId(note.id)
    setDraftTitle(note.title)
    setDraftContent(note.content)
    setDraftColor(note.color ?? defaultColor)
  }

  const handleDelete = async (id: string) => {
    const ctx = await loadDb()
    deleteNote(ctx.db, id)
    await persistDb(ctx)
    setNotes(listNotes(ctx.db))
    if (editingId === id) setEditingId(null)
  }
  const handleCreate = async () => {
    const note = newNote()
    await handleSave(note)
    setEditingId(note.id)
    setDraftTitle(note.title)
    setDraftContent(note.content)
    setDraftColor(note.color ?? defaultColor)
  }

  const handleSaveEdit = async (note: MeetingNote) => {
    await handleSave({
      ...note,
      title: draftTitle.trim(),
      content: draftContent,
      color: draftColor,
      meetingDate: note.meetingDate ?? note.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  if (loading) {
    return <Card className="p-6 text-text-secondary">Loading meeting notes…</Card>
  }

  if (error) {
    return (
      <Card className="p-6 text-red-200 border border-red-400/60 bg-red-500/10">
        {error}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCreate}>New note</Button>
        <Input
          placeholder="Search title or content"
          className="max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {filtered.length === 0 ? (
          <Card className="p-6 text-text-secondary">No notes yet.</Card>
        ) : (
          filtered.map((note) => {
            const noteDate = new Date(note.meetingDate ?? note.createdAt)
            const noteStyle = note.color
              ? { backgroundColor: note.color, borderColor: note.color }
              : undefined
            return (
              <Card
                key={note.id}
                className="group w-64 p-4 space-y-3 shadow-[0_4px_0_rgba(0,0,0,0.08)] bg-yellow-100/80 border-yellow-200 text-slate-900"
                style={noteStyle}
                onClick={() => {
                  handleEdit(note)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-slate-900">
                      {note.title || 'Untitled note'}
                    </p>
                    <p className="text-xs text-slate-800/80">
                      {noteDate.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
                      aria-label="Delete note"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div
                  className="text-sm text-slate-800/90 ql-editor note-preview"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
              </Card>
            )
          })
        )}
      </div>

      <Dialog
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Edit note"
        contentClassName="max-w-5xl max-h-[80vh] overflow-y-auto"
      >
        {editingId ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs uppercase text-text-secondary">Title</p>
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Title"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase text-text-secondary">Color</p>
                <Select value={draftColor} onValueChange={setDraftColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: option.value }}
                          />
                          <span>{option.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <RichTextEditor
              value={draftContent}
              onChange={setDraftContent}
              placeholder="Write your note..."
              className="min-h-[220px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const note = notes.find((n) => n.id === editingId)
                  if (note) handleSaveEdit(note)
                }}
                disabled={saving}
              >
                <Check className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

export default MeetingNotes
