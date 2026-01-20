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
  { value: 'hsl(217, 91%, 60%)', label: 'Skyfire' },
  { value: 'hsl(0, 84%, 60%)', label: 'Crimson Tide' },
  { value: 'hsl(270, 70%, 60%)', label: 'Violet Drift' },
  { value: 'hsl(142, 70%, 45%)', label: 'Emerald Glow' },
  { value: 'hsl(25, 95%, 53%)', label: 'Sunforge' },
  { value: 'hsl(330, 80%, 60%)', label: 'Neon Bloom' },
  { value: 'hsl(199, 89%, 48%)', label: 'Blue Nebula' },
  { value: 'hsl(280, 82%, 50%)', label: 'Royal Pulse' },
  { value: 'hsl(210, 40%, 50%)', label: 'Steel Harbor' },
  { value: 'hsl(210, 10%, 45%)', label: 'Slate Echo' },
  { value: 'hsl(150, 45%, 45%)', label: 'Fern Trail' },
  { value: 'hsl(10, 80%, 55%)', label: 'Lava Jet' },
  { value: 'hsl(50, 90%, 55%)', label: 'Saffron Ray' },
  { value: 'hsl(120, 50%, 45%)', label: 'Pine Ridge' },
  { value: 'hsl(190, 70%, 45%)', label: 'Glacier Bay' },
  { value: 'hsl(230, 75%, 55%)', label: 'Midnight Surf' },
  { value: 'hsl(260, 60%, 55%)', label: 'Iris Circuit' },
  { value: 'hsl(300, 70%, 55%)', label: 'Orchid Spark' },
  { value: 'hsl(340, 70%, 55%)', label: 'Rose Signal' },
  { value: 'hsl(20, 85%, 55%)', label: 'Copper Flame' },
  { value: 'hsl(80, 70%, 45%)', label: 'Lime Crest' },
]
const defaultColor = 'hsl(50, 90%, 55%)'

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
    const init = async () => {
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
    init()
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
    const ctx = await loadDb()
    saveNote(ctx.db, note)
    await persistDb(ctx)
    setNotes(listNotes(ctx.db))
    setEditingId(null)
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
              >
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

export default MeetingNotes
