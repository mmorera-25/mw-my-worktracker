import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Dialog from '../../components/ui/Dialog'
import RichTextEditor from '../../components/ui/RichTextEditor'
import { StoryDetail } from '@inbox/components/StoryDetail'
import type { Epic, Story, StoryComment } from '@inbox/types'
import { cn } from '@inbox/lib/utils'
import { loadDb, persistDb } from '../../lib/storage/dbManager'
import { loadInboxState, saveInboxState } from '@inbox/data/inboxRepository'
import {
  loadMeetingParticipants,
  saveMeetingParticipants,
  type MeetingParticipant,
  type MeetingParticipantRole,
  type MeetingNote,
} from '../../lib/oneonone/meetingPreferencesRepository'
const HOME_TAB_ID = 'home'
const MEETING_PREFS_TAB_ID = 'meeting-preferences'

const formatRole = (role: MeetingParticipantRole) => {
  if (role === 'management') return 'Manager'
  if (role === 'supervised') return 'Team member'
  return 'Colleague'
}

const isSameDay = (a: Date, b: Date) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const formatMeetingHeaderDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })
  const rawMonth = date.toLocaleDateString(undefined, { month: 'short' })
  const month = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase()
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const time = date
    .toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
  return `${day}-${month}-${year} @ ${time} (${weekday})`
}

const getNotePreview = (value: string, maxLength = 100) => {
  const text = value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}...`
}

const getEffectiveDueDate = (story: Story) => {
  const dates = story.dueDates && story.dueDates.length > 0 ? story.dueDates : [story.createdAt]
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime())
  const now = new Date()
  const upcoming = sorted.find((date) => date >= now)
  return upcoming ?? sorted[sorted.length - 1]
}

const normalizeStatus = (status?: string) => status?.trim().toLowerCase() ?? ''

const isStoryDone = (story: Story, doneStatusNormalized: string) => {
  const status = normalizeStatus(story.status)
  if (status === doneStatusNormalized) return true
  const doneKeywords = new Set(['done', 'complete', 'completed', 'closed'])
  if (doneKeywords.has(status)) return true
  if (story.completedAt) return true
  return false
}

const OneOnOneFeed = ({
  userFirstName,
}: {
  userFirstName: string
}) => {
  const [epics, setEpics] = useState<Epic[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [participants, setParticipants] = useState<MeetingParticipant[]>([])
  const [activeTabId, setActiveTabId] = useState(HOME_TAB_ID)
  const [newParticipantName, setNewParticipantName] = useState('')
  const [newParticipantRole, setNewParticipantRole] =
    useState<MeetingParticipantRole>('normal')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteDate, setEditingNoteDate] = useState<number | null>(null)
  const [editingNoteTitle, setEditingNoteTitle] = useState('')
  const [editingNoteDraft, setEditingNoteDraft] = useState('')
  const [editingMeetingSelectedEpicIds, setEditingMeetingSelectedEpicIds] = useState<
    string[]
  >([])
  const [isEpicPickerOpen, setIsEpicPickerOpen] = useState(false)
  const [epicPickerSelection, setEpicPickerSelection] = useState<string[]>([])
  const [activeEpicId, setActiveEpicId] = useState<string | null>(null)
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await loadDb()
        const inboxState = loadInboxState(ctx.db)
        setEpics(inboxState.epics)
        setStories(inboxState.stories)
        const storedParticipants = loadMeetingParticipants(ctx.db)
        setParticipants(storedParticipants)
        await persistDb(ctx)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meetings.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const availableTabs = new Set([
      HOME_TAB_ID,
      MEETING_PREFS_TAB_ID,
      ...participants.map((participant) => participant.id),
    ])
    if (!availableTabs.has(activeTabId)) {
      setActiveTabId(HOME_TAB_ID)
    }
  }, [participants, activeTabId])

  useEffect(() => {
    setActiveEpicId(null)
  }, [activeTabId])

  const commentMap = useMemo(() => {
    const byStory: Record<string, StoryComment[]> = {}
    stories.forEach((story) => {
      if (story.comments && story.comments.length > 0) {
        byStory[story.id] = story.comments
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }
    })
    return byStory
  }, [stories])

  const lastActivity = (story: Story) => {
    const latestComment = commentMap[story.id]?.[0]?.createdAt?.getTime?.() ?? 0
    return Math.max(story.createdAt.getTime(), latestComment)
  }

  const sortedStories = useMemo(
    () =>
      stories
        .filter((story) => !story.isDeleted)
        .slice()
        .sort((a, b) => lastActivity(b) - lastActivity(a)),
    [stories, commentMap],
  )

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    stories.forEach((story) => {
      if (story.status) set.add(story.status)
    })
    if (![...set].some((status) => status.toLowerCase() === 'done')) {
      set.add('Done')
    }
    return Array.from(set)
  }, [stories])

  const doneStatus = useMemo(() => {
    return statusOptions.find((status) => normalizeStatus(status) === 'done') ?? 'Done'
  }, [statusOptions])

  const doneStatusNormalized = useMemo(
    () => normalizeStatus(doneStatus),
    [doneStatus],
  )

  const defaultStatus = useMemo(() => {
    const firstNonDone = statusOptions.find(
      (status) => normalizeStatus(status) !== 'done',
    )
    return firstNonDone ?? doneStatus
  }, [statusOptions, doneStatus])

  const getNewStoryStatus = () => {
    const firstNonDone = statusOptions.find(
      (status) => normalizeStatus(status) !== doneStatusNormalized,
    )
    if (firstNonDone) return firstNonDone
    return 'To Do'
  }

  const activeParticipant = useMemo(
    () => participants.find((participant) => participant.id === activeTabId) ?? null,
    [participants, activeTabId],
  )

  const persistStories = async (nextStories: Story[]) => {
    setStories(nextStories)
    const ctx = await loadDb()
    const inboxState = loadInboxState(ctx.db)
    saveInboxState(ctx.db, { ...inboxState, stories: nextStories })
    await persistDb(ctx)
    window.dispatchEvent(new Event('inbox-stories-updated'))
  }

  const persistParticipants = async (next: MeetingParticipant[]) => {
    setParticipants(next)
    const ctx = await loadDb()
    saveMeetingParticipants(ctx.db, next)
    await persistDb(ctx)
  }

  const updateMeetingSelection = async (nextSelected: string[]) => {
    setEditingMeetingSelectedEpicIds(nextSelected)
    if (!activeParticipant || !editingNoteId) return
    const nextParticipants = participants.map((participant) => {
      if (participant.id !== activeParticipant.id) return participant
      const notes = participant.meetingNotes ?? []
      return {
        ...participant,
        meetingNotes: notes.map((note) =>
          note.id === editingNoteId
            ? {
                ...note,
                selectedEpicIds: nextSelected,
              }
            : note,
        ),
      }
    })
    await persistParticipants(nextParticipants)
  }

  const handleOpenEpicPicker = () => {
    setEpicPickerSelection(editingMeetingSelectedEpicIds)
    setIsEpicPickerOpen(true)
  }

  const handleSaveEpicPicker = async () => {
    const nextSelected = epicPickerSelection
    await updateMeetingSelection(nextSelected)
    setIsEpicPickerOpen(false)
  }

  const handleAddParticipant = async () => {
    const trimmed = newParticipantName.trim()
    if (!trimmed) return
    const nextParticipant: MeetingParticipant = {
      id: crypto.randomUUID(),
      name: trimmed,
      role: newParticipantRole,
      selectedTaskIds: [],
      meetingNotes: [],
    }
    const next = [...participants, nextParticipant]
    await persistParticipants(next)
    setNewParticipantName('')
    setNewParticipantRole('normal')
    setActiveTabId(nextParticipant.id)
  }

  const handleStartNoteEdit = (note: MeetingNote) => {
    const legacyEpicIds = (note.selectedStoryIds ?? [])
      .map((storyId) => stories.find((story) => story.id === storyId)?.epicId)
      .filter((epicId): epicId is string => Boolean(epicId))
    const normalizedEpicIds =
      note.selectedEpicIds.length > 0
        ? note.selectedEpicIds
        : Array.from(new Set(legacyEpicIds))
    setEditingNoteId(note.id)
    setEditingNoteDate(note.createdAt)
    setEditingNoteTitle(note.title ?? '')
    setEditingNoteDraft(note.content)
    setEditingMeetingSelectedEpicIds(normalizedEpicIds)
  }

  const handleStartMeeting = async () => {
    if (editingNoteDate && editingNoteId && activeParticipant) {
      await handleSaveNote(activeParticipant.id)
    }
    setEditingNoteId(null)
    setEditingNoteDate(Date.now())
    setEditingNoteTitle('')
    setEditingNoteDraft('')
    setEditingMeetingSelectedEpicIds([])
  }

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null)
    setEditingNoteDate(null)
    setEditingNoteTitle('')
    setEditingNoteDraft('')
    setEditingMeetingSelectedEpicIds([])
  }

  const handleDeleteMeetingNote = async (noteId: string) => {
    if (!activeParticipant) return
    const next = participants.map((participant) => {
      if (participant.id !== activeParticipant.id) return participant
      return {
        ...participant,
        meetingNotes: (participant.meetingNotes ?? []).filter((note) => note.id !== noteId),
      }
    })
    await persistParticipants(next)
    if (editingNoteId === noteId) {
      handleCancelNoteEdit()
    }
  }

  const handleSaveNote = async (participantId: string) => {
    const content = editingNoteDraft.trim()
    const title = editingNoteTitle.trim()
    if (!activeParticipant) return
    const newNoteId = editingNoteId ? null : crypto.randomUUID()
    const createdAt = editingNoteDate ?? Date.now()
    const next = participants.map((participant) => {
      if (participant.id !== participantId) return participant
      const notes = participant.meetingNotes ?? []
      if (editingNoteId) {
        const existingDiscussed =
          notes.find((note) => note.id === editingNoteId)?.discussedStoryIds ?? []
        return {
          ...participant,
          meetingNotes: notes.map((note) =>
            note.id === editingNoteId
              ? {
                  ...note,
                  content,
                  title,
                  selectedEpicIds:
                    activeParticipant.role === 'management'
                      ? nonArchivedEpics.map((epic) => epic.id)
                      : editingMeetingSelectedEpicIds,
                  discussedStoryIds: existingDiscussed,
                }
              : note,
        ),
      }
    }
      return {
        ...participant,
        meetingNotes: [
          {
            id: newNoteId ?? crypto.randomUUID(),
            createdAt,
            content,
            title,
            selectedEpicIds:
              activeParticipant.role === 'management'
                ? nonArchivedEpics.map((epic) => epic.id)
                : editingMeetingSelectedEpicIds,
            discussedStoryIds: [],
          },
          ...notes,
        ],
      }
    })
    await persistParticipants(next)
    if (newNoteId) {
      const updatedParticipant = next.find((p) => p.id === participantId)
      const created = updatedParticipant?.meetingNotes?.find(
        (note) => note.id === newNoteId,
      )
      if (created) {
        handleStartNoteEdit(created)
        return
      }
    }
    handleCancelNoteEdit()
  }

  const handleUpdateStory = async (updatedStory: Story) => {
    const nextStories = stories.map((story) =>
      story.id === updatedStory.id ? updatedStory : story,
    )
    await persistStories(nextStories)
  }

  const handleAddStoryForEpic = async () => {
    if (!activeEpic) return
    const now = new Date()
    const count = stories.filter((story) => story.epicId === activeEpic.id).length
    const status = getNewStoryStatus()
    const nextStory: Story = {
      id: crypto.randomUUID(),
      key: `${activeEpic.key}-${count + 1}`,
      title: 'New Story',
      description: '',
      epicId: activeEpic.id,
      dueDates: [],
      status,
      priority: 'low',
      createdAt: now,
      discussed: false,
      isDeleted: false,
      comments: [],
    }
    const nextStories = [nextStory, ...stories]
    await persistStories(nextStories)
    setSelectedStoryId(nextStory.id)
  }
  const handleToggleTakeaway = async (
    storyId: string,
    commentId: string,
    isCompleted: boolean,
  ) => {
    const nextStories = stories.map((story) => {
      if (story.id !== storyId) return story
      return {
        ...story,
        comments: (story.comments ?? []).map((comment) =>
          comment.id === commentId ? { ...comment, isCompleted } : comment,
        ),
      }
    })
    await persistStories(nextStories)
  }

  const activeEpic = useMemo(
    () => epics.find((epic) => epic.id === activeEpicId) ?? null,
    [activeEpicId, epics],
  )
  const selectedStory = useMemo(
    () => stories.find((story) => story.id === selectedStoryId) ?? null,
    [stories, selectedStoryId],
  )
  const selectedStoryEpic = useMemo(
    () =>
      selectedStory ? epics.find((epic) => epic.id === selectedStory.epicId) ?? null : null,
    [epics, selectedStory],
  )
  const activeEpicStories = useMemo(
    () =>
      stories.filter(
        (story) =>
          story.epicId === activeEpicId &&
          !story.isDeleted &&
          !isStoryDone(story, doneStatusNormalized),
      ),
    [stories, activeEpicId, doneStatusNormalized],
  )
  const nonArchivedEpics = useMemo(() => {
    return epics.filter(
      (epic) =>
        !epic.isArchived &&
        epic.id !== 'no-epic-assigned' &&
        epic.name !== 'No Epic Assigned',
    )
  }, [epics])
  const meetingEpicIds = useMemo(() => {
    const allowed = new Set(nonArchivedEpics.map((epic) => epic.id))
    if (activeParticipant?.role === 'management') {
      return Array.from(allowed)
    }
    return editingMeetingSelectedEpicIds.filter((epicId) => allowed.has(epicId))
  }, [activeParticipant?.role, nonArchivedEpics, editingMeetingSelectedEpicIds])
  const meetingStories = useMemo(() => {
    const selected = new Set(meetingEpicIds)
    return sortedStories.filter(
      (story) =>
        selected.has(story.epicId) &&
        !story.isDeleted &&
        !isStoryDone(story, doneStatusNormalized),
    )
  }, [sortedStories, meetingEpicIds, doneStatusNormalized])
  const tabItems = useMemo(
    () => [
      { id: HOME_TAB_ID, label: 'Home' },
      ...participants.map((participant) => ({
        id: participant.id,
        label: participant.name,
      })),
      { id: MEETING_PREFS_TAB_ID, label: 'Meeting preferences' },
    ],
    [participants],
  )

  useEffect(() => {
    setEditingNoteId(null)
    setEditingNoteDate(null)
    setEditingNoteDraft('')
    setEditingMeetingSelectedEpicIds([])
  }, [activeTabId])

  const exportMarkdown = () => {
    if (!activeParticipant) return
    setExporting(true)
    try {
      const lines: string[] = []
      meetingStories.forEach((story) => {
        lines.push(`## ${story.title} (${story.id})`)
        lines.push(
          `- Epic: ${
            epics.find((epic) => epic.id === story.epicId)?.name ?? 'No epic'
          } | Status: ${story.status} | Due: ${getEffectiveDueDate(story).toLocaleDateString()}`,
        )
        if (story.description) {
          lines.push(`- Description: ${story.description}`)
        }
        const storyComments = commentMap[story.id] ?? []
        if (storyComments.length) {
          lines.push('')
          lines.push('Comments:')
          storyComments
            .slice()
            .reverse()
            .forEach((c) => {
              lines.push(`- [${new Date(c.createdAt).toLocaleString()}] ${c.text}`)
            })
        }
        lines.push('')
      })
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'meetings.md'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <Card className="p-6 text-text-secondary">Loading meetings…</Card>
  if (error)
    return (
      <Card className="p-6 text-red-200 border border-red-400/60 bg-red-500/10">
        {error}
      </Card>
    )

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTabId === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTabId === HOME_TAB_ID ? (
          <Card className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">People</p>
              <p className="text-xs text-text-secondary">
                Overview of meeting participants and note counts.
              </p>
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-text-secondary">No meeting participants yet.</p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">{participant.name}</p>
                      <p className="text-xs uppercase text-text-secondary">
                        {formatRole(participant.role)}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        {participant.meetingNotes?.length ?? 0} meetings
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveTabId(participant.id)}
                    >
                      Open tab
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : activeTabId === MEETING_PREFS_TAB_ID ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
            <Card className="p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Add person</p>
                <p className="text-xs text-text-secondary">
                  Create a meeting tab and set their default role.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr,180px,auto]">
                <Input
                  placeholder="Name"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                />
                <Select
                  value={newParticipantRole}
                  onChange={(e) =>
                    setNewParticipantRole(e.target.value as MeetingParticipantRole)
                  }
                >
                  <option value="management">Manager</option>
                  <option value="normal">Colleague</option>
                  <option value="supervised">Team member</option>
                </Select>
                <Button onClick={handleAddParticipant}>Add</Button>
              </div>
            </Card>
          </div>
        ) : activeParticipant ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-text-primary">
                  {activeParticipant.name}
                </p>
                <p className="text-xs uppercase text-text-secondary">
                  Role: {formatRole(activeParticipant.role)}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={exportMarkdown}
                disabled={exporting || meetingStories.length === 0}
              >
                Export Markdown
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[15%,85%] items-center">
              <Button
                size="md"
                onClick={() => {
                  if (editingNoteDate && activeParticipant) {
                    handleSaveNote(activeParticipant.id)
                    return
                  }
                  handleStartMeeting()
                }}
                className={cn(
                  "w-full",
                  editingNoteDate && "bg-emerald-500 text-white hover:bg-emerald-600"
                )}
              >
                {editingNoteDate ? 'Save meeting' : 'Add new meeting'}
              </Button>
              <Select
                className="w-full"
                value={editingNoteId ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (!value) {
                    handleCancelNoteEdit()
                    return
                  }
                  const note = (activeParticipant.meetingNotes ?? []).find(
                    (entry) => entry.id === value,
                  )
                  if (note) {
                    handleStartNoteEdit(note)
                  }
                }}
              >
                <option value="">Select previous meeting</option>
                {(activeParticipant.meetingNotes ?? [])
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.title
                        ? `${note.title} | ${formatMeetingHeaderDate(note.createdAt)}`
                        : formatMeetingHeaderDate(note.createdAt)}
                    </option>
                  ))}
              </Select>
            </div>

            <Card className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-text-primary">
                  {editingNoteDate
                    ? `${editingNoteId ? 'Editing' : 'New Meeting'}: ${
                        editingNoteTitle.trim()
                          ? `${editingNoteTitle.trim()} | `
                          : ''
                      }${formatMeetingHeaderDate(editingNoteDate ?? Date.now())}`
                    : 'Meeting notes'}
                </div>
                {editingNoteId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMeetingNote(editingNoteId)}
                    title="Delete meeting"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {!editingNoteDate ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-text-secondary">
                  Click "Add Meeting" or select a previous meeting to view content.
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Add a meeting title (optional)"
                    value={editingNoteTitle}
                    onChange={(e) => setEditingNoteTitle(e.target.value)}
                  />
                  <RichTextEditor
                    value={editingNoteDraft}
                    onChange={setEditingNoteDraft}
                    placeholder="Write meeting notes..."
                    className="min-h-[200px]"
                  />
                </div>
              )}
            </Card>

            {editingNoteDate && activeParticipant.role !== 'management' ? (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">Epics to discuss</p>
                  <span className="text-xs text-text-secondary">
                    {editingMeetingSelectedEpicIds.length} selected
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={handleOpenEpicPicker}>
                  Add Epics to today&apos;s meeting
                </Button>
              </Card>
            ) : null}

            {editingNoteDate ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">To discuss</p>
                    <span className="text-xs text-text-secondary">
                      {meetingStories.length} Stories
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {meetingEpicIds.map((epicId) => {
                      const epic = epics.find((entry) => entry.id === epicId)
                      if (!epic) return null
                      const count = meetingStories.filter(
                        (story) => story.epicId === epic.id,
                      ).length
                      return (
                        <Card
                          key={epic.id}
                          className="cursor-pointer rounded-2xl border border-border bg-surface/70 p-4 text-text-primary transition hover:border-accent/80 hover:bg-surface/90"
                          onClick={() => setActiveEpicId(epic.id)}
                        >
                          <p className="text-lg font-semibold text-text-primary">{epic.name}</p>
                          <p className="text-sm uppercase text-text-secondary mt-1">
                            {epic.key}
                          </p>
                          <p className="text-[0.65rem] uppercase text-text-secondary mt-2">
                            {count} stories
                          </p>
                        </Card>
                      )
                    })}
                    {meetingEpicIds.length === 0 ? (
                      <Card className="p-6 text-text-secondary">
                        No epics selected yet.
                      </Card>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
      ) : (
        <Card className="p-6 text-text-secondary">
          Add someone in meeting preferences to get started.
        </Card>
      )}
    </div>

      <Dialog
        open={isEpicPickerOpen}
        onClose={() => setIsEpicPickerOpen(false)}
        title="Add epics to today's meeting"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Select the epics you want to cover in this meeting.
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {nonArchivedEpics.length === 0 ? (
              <p className="text-sm text-text-secondary">No epics available.</p>
            ) : (
              nonArchivedEpics.map((epic) => (
                <label
                  key={epic.id}
                  className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={epicPickerSelection.includes(epic.id)}
                    onChange={() => {
                      setEpicPickerSelection((prev) => {
                        const set = new Set(prev)
                        if (set.has(epic.id)) {
                          set.delete(epic.id)
                        } else {
                          set.add(epic.id)
                        }
                        return Array.from(set)
                      })
                    }}
                  />
                  <span className="flex-1">
                    <span className="block font-semibold text-text-primary">
                      {epic.name}
                    </span>
                    <span className="block text-xs uppercase text-text-secondary">
                      {epic.key}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEpicPickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEpicPicker}>Save selection</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(activeEpic)}
        onClose={() => setActiveEpicId(null)}
        title={activeEpic ? `Epic: ${activeEpic.name}` : undefined}
        contentClassName="max-w-3xl"
      >
        {activeEpic ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-text-secondary">
              <div>
                <p className="text-xs uppercase">Created</p>
                <p>{new Date(activeEpic.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase">Key</p>
                <p>{activeEpic.key}</p>
              </div>
              <div>
                <p className="text-xs uppercase">Stories</p>
                <p>{activeEpicStories.length}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-text-secondary">Description</p>
              <p className="text-text-primary whitespace-pre-wrap">
                {activeEpic.description || 'No description provided.'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-text-primary">Stories</p>
              {activeEpicStories.length === 0 ? (
                <p className="text-xs text-text-secondary">No stories yet.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-secondary">
                      {activeEpicStories.length} open stor{activeEpicStories.length === 1 ? 'y' : 'ies'}
                    </p>
                    <Button size="sm" onClick={handleAddStoryForEpic}>
                      Add story
                    </Button>
                  </div>
                  <ol className="space-y-2">
                    {activeEpicStories.map((story, index) => {
                      const dueDate = getEffectiveDueDate(story)
                      return (
                        <li
                          key={story.id}
                          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                        >
                          <button
                            className="grid w-full items-center gap-3 text-left transition hover:text-accent"
                            style={{ gridTemplateColumns: 'minmax(0, 1fr) 25%' }}
                            onClick={() => setSelectedStoryId(story.id)}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-secondary">
                                {index + 1}.
                              </span>
                              <span className="font-semibold underline underline-offset-2">
                                {story.title || 'Untitled story'}
                              </span>
                            </span>
                            <span className="text-xs text-text-secondary text-right">
                              Due: {dueDate ? dueDate.toLocaleDateString() : '—'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(selectedStory)}
        onClose={() => setSelectedStoryId(null)}
        title={selectedStory ? selectedStory.title : undefined}
        contentClassName="max-w-4xl"
      >
        {selectedStory ? (
          <StoryDetail
            story={selectedStory}
            epic={selectedStoryEpic ?? undefined}
            epics={epics}
            statusOptions={statusOptions}
            doneStatus={doneStatus}
            defaultStatus={defaultStatus}
            onUpdateStory={handleUpdateStory}
          />
        ) : null}
      </Dialog>
    </>
  )
}

export default OneOnOneFeed
