import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Dialog from '../../components/ui/Dialog'
import type { WorkflowConfig } from '../../lib/settings/configRepository'
import {
  backupDatabase,
  compactDatabase,
  ensureDatabase,
  getLastSaved,
  validateDatabase,
} from '../../lib/storage/fsStorage'
import { loadDirectoryHandle, saveDirectoryHandle } from '../../lib/storage/handleStore'
import { loadFromIdb, saveToIdb } from '../../lib/storage/idbFallback'
import { openDatabase, serialize } from '../../lib/storage/sqliteWasm'
import { bootstrapSchema } from '../../lib/storage/schema'
import { exportSnapshot, importSnapshot, type ImportStrategy, type Snapshot } from '../../lib/storage/jsonPort'
import { loadDb } from '../../lib/storage/dbManager'
import {
  getThemeMode,
  toggleThemeMode,
  type ThemeMode,
} from '../../theme/applyTheme'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'

type Mode = 'fs-access' | 'idb'

type StorageState = {
  path?: string
  lastSaved?: string
}

const hasFileSystemAccess = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

type Props = {
  workflow: WorkflowConfig
  onUpdateWorkflow: (config: WorkflowConfig) => Promise<void> | void
  typeOfWorkOptions: string[]
  onPersistTypeOfWorkOptions: (next: string[]) => Promise<void> | void
  onStorageReady?: () => void
  requiresStorageSetup?: boolean
}

const DataStoragePanel = ({
  workflow,
  onUpdateWorkflow,
  typeOfWorkOptions,
  onPersistTypeOfWorkOptions,
  onStorageReady,
  requiresStorageSetup = false,
}: Props) => {
  const [mode, setMode] = useState<Mode>(hasFileSystemAccess() ? 'fs-access' : 'idb')
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [status, setStatus] = useState<StorageState>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [columns, setColumns] = useState<string[]>(workflow.columns)
  const [swimlanes, setSwimlanes] = useState<string[]>(workflow.swimlanes)
  const [accent, setAccent] = useState<WorkflowConfig['accent']>(workflow.accent)
  const [typeOptions, setTypeOptions] = useState<string[]>(typeOfWorkOptions)
  const [newColumnLabel, setNewColumnLabel] = useState('')
  const [newSwimlaneLabel, setNewSwimlaneLabel] = useState('')
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [laneMessage, setLaneMessage] = useState<string | null>(null)
  const [typeMessage, setTypeMessage] = useState<string | null>(null)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [importPreview, setImportPreview] = useState<Snapshot | null>(null)
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('merge')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getThemeMode())
  const [activeTab, setActiveTab] = useState<'storage' | 'preferences' | 'theme'>(
    requiresStorageSetup ? 'storage' : 'preferences',
  )
  const [showStorageWarning, setShowStorageWarning] = useState(false)
  const storageReady = mode === 'fs-access' && !!dirHandle
  const dragState = useRef<{ listKey: string; index: number } | null>(null)

  useEffect(() => {
    if (mode !== 'fs-access') return
    ;(async () => {
      const stored = await loadDirectoryHandle()
      if (!stored) return
      const permission = await stored.queryPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        setDirHandle(stored)
        const last = await getLastSaved(stored)
        setStatus({ path: `/${stored.name}/worktracker.db`, lastSaved: last })
        onStorageReady?.()
      }
    })()
  }, [mode, onStorageReady])

  useEffect(() => {
    setColumns(workflow.columns)
    setSwimlanes(workflow.swimlanes)
    setAccent(workflow.accent)
  }, [workflow])
  useEffect(() => {
    setTypeOptions(typeOfWorkOptions)
  }, [typeOfWorkOptions])
  useEffect(() => {
    if (requiresStorageSetup) {
      setActiveTab('storage')
    }
  }, [requiresStorageSetup])


  const persistenceLabel = useMemo(
    () => (mode === 'fs-access' ? 'File System Access' : 'IndexedDB fallback'),
    [mode],
  )

  const chooseFolder = async () => {
    try {
      setBusy(true)
      setMessage(null)
      setError(null)
      const handle = await window.showDirectoryPicker()
      const permission = await handle.requestPermission({ mode: 'readwrite' })
      if (permission !== 'granted') throw new Error('Permission denied to selected folder.')
      await saveDirectoryHandle(handle)
      setDirHandle(handle)
      const info = await ensureDatabase(handle)
      setStatus(info)
      setMessage('Database ready in selected folder.')
      onStorageReady?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to access folder.')
    } finally {
      setBusy(false)
    }
  }

  const handleBackup = async () => {
    if (!dirHandle) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await backupDatabase(dirHandle)
      setMessage('Backup created.')
      setLastBackup(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed.')
    } finally {
      setBusy(false)
    }
  }

  const normalizeList = (list: string[]) =>
    list.map((c) => c.trim()).filter((c, idx, arr) => c && arr.indexOf(c) === idx)

  const reorderList = (list: string[], from: number, to: number) => {
    if (from === to) return list
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }

  const handleDragStart = (listKey: string, index: number) => {
    dragState.current = { listKey, index }
  }

  const handleDrop = (
    listKey: string,
    index: number,
    setter: (updater: (prev: string[]) => string[]) => void,
  ) => {
    if (!dragState.current || dragState.current.listKey !== listKey) return
    setter((prev) => reorderList(prev, dragState.current!.index, index))
    dragState.current = null
  }

  const handleDragEnd = () => {
    dragState.current = null
  }

  const handleSaveWorkflow = async () => {
    setSavingWorkflow(true)
    setMessage(null)
    setError(null)
    try {
      const nextColumns = normalizeList(columns) || workflow.columns
      const nextSwimlanes = normalizeList(swimlanes) || workflow.swimlanes
      const normalizedTypes = normalizeList(typeOptions)
      if (
        normalizedTypes.length !== typeOptions.length ||
        normalizedTypes.some((item, idx) => item !== typeOptions[idx])
      ) {
        setTypeOptions(normalizedTypes)
      }
      const next: WorkflowConfig = {
        columns: nextColumns.length ? nextColumns : workflow.columns,
        swimlanes: nextSwimlanes.length ? nextSwimlanes : workflow.swimlanes,
        accent,
      }
      await onUpdateWorkflow(next)
      await onPersistTypeOfWorkOptions(normalizedTypes)
      setMessage('Workflow updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow.')
    } finally {
      setSavingWorkflow(false)
    }
  }

  const addColumnLabel = () => {
    const trimmed = newColumnLabel.trim()
    if (!trimmed) {
      setStatusMessage('Enter a status label.')
      return
    }
    if (columns.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setStatusMessage('That status already exists.')
      return
    }
    setColumns((prev) => [...prev, trimmed])
    setNewColumnLabel('')
    setStatusMessage(null)
  }

  const renameColumnLabel = (index: number) => {
    const current = columns[index]
    const nextLabel = window.prompt('Rename status', current)?.trim()
    if (!nextLabel || nextLabel === current) return
    if (columns.some((item) => item.toLowerCase() === nextLabel.toLowerCase())) {
      setStatusMessage('A status with that name already exists.')
      return
    }
    setColumns((prev) => prev.map((item, idx) => (idx === index ? nextLabel : item)))
    setStatusMessage(null)
  }

  const deleteColumnLabel = (index: number) => {
    if (columns.length <= 1) {
      setStatusMessage('You need at least one status.')
      return
    }
    if (!window.confirm(`Delete "${columns[index]}"?`)) return
    setColumns((prev) => prev.filter((_, idx) => idx !== index))
  }

  const addSwimlaneLabel = () => {
    const trimmed = newSwimlaneLabel.trim()
    if (!trimmed) {
      setLaneMessage('Enter a swimlane name.')
      return
    }
    if (swimlanes.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setLaneMessage('That swimlane already exists.')
      return
    }
    setSwimlanes((prev) => [...prev, trimmed])
    setNewSwimlaneLabel('')
    setLaneMessage(null)
  }

  const renameSwimlaneLabel = (index: number) => {
    const current = swimlanes[index]
    const nextLabel = window.prompt('Rename swimlane', current)?.trim()
    if (!nextLabel || nextLabel === current) return
    if (swimlanes.some((item) => item.toLowerCase() === nextLabel.toLowerCase())) {
      setLaneMessage('A swimlane with that name already exists.')
      return
    }
    setSwimlanes((prev) => prev.map((item, idx) => (idx === index ? nextLabel : item)))
    setLaneMessage(null)
  }

  const deleteSwimlaneLabel = (index: number) => {
    if (!window.confirm(`Delete swimlane "${swimlanes[index]}"?`)) return
    setSwimlanes((prev) => prev.filter((_, idx) => idx !== index))
  }

  const addTypeLabel = () => {
    const trimmed = newTypeLabel.trim()
    if (!trimmed) {
      setTypeMessage('Enter a label.')
      return
    }
    if (typeOptions.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setTypeMessage('That option already exists.')
      return
    }
    setTypeOptions((prev) => [...prev, trimmed])
    setNewTypeLabel('')
    setTypeMessage(null)
  }

  const renameTypeLabel = (index: number) => {
    const current = typeOptions[index]
    const nextLabel = window.prompt('Rename option', current)?.trim()
    if (!nextLabel || nextLabel === current) return
    if (typeOptions.some((item) => item.toLowerCase() === nextLabel.toLowerCase())) {
      setTypeMessage('An option with that name already exists.')
      return
    }
    setTypeOptions((prev) => prev.map((item, idx) => (idx === index ? nextLabel : item)))
    setTypeMessage(null)
  }

  const deleteTypeLabel = (index: number) => {
    if (!window.confirm(`Delete option "${typeOptions[index]}"?`)) return
    setTypeOptions((prev) => prev.filter((_, idx) => idx !== index))
  }

  const downloadJson = (data: Snapshot, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportJson = async () => {
    try {
      const ctx = await loadDb()
      const snapshot = exportSnapshot(ctx.db)
      downloadJson(snapshot, 'worktracker-export.json')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Snapshot
      if (!parsed.tasks || !parsed.okrs || !parsed.meetingNotes) {
        throw new Error('Invalid snapshot structure.')
      }
      setImportPreview(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse import file.')
    }
  }

  const runImport = async () => {
    if (!importPreview) return
    try {
      setBusy(true)
      setMessage(null)
      setError(null)
      const ctx = await loadDb()
      // pre-import backup
      if (mode === 'fs-access' && dirHandle) {
        await backupDatabase(dirHandle)
        setLastBackup(new Date().toISOString())
      } else {
        const snapshot = exportSnapshot(ctx.db)
        downloadJson(snapshot, `worktracker-preimport-${Date.now()}.json`)
      }
      importSnapshot(ctx.db, importPreview, importStrategy)
      await persistDb(ctx)
      setMessage('Import completed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleThemeToggle = () => {
    const next = toggleThemeMode()
    setThemeMode(next)
  }

  const handleValidate = async () => {
    if (!dirHandle) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const ok = await validateDatabase(dirHandle)
      setMessage(ok ? 'Integrity check passed.' : 'Integrity check failed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleCompact = async () => {
    if (!dirHandle) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await compactDatabase(dirHandle)
      const last = await getLastSaved(dirHandle)
      setStatus((prev) => ({ ...prev, lastSaved: last }))
      setMessage('Database compacted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compact failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenFolder = async () => {
    if (!dirHandle) return
    // showFilePicker cannot open folder; rely on browser opening via handle
    try {
      await dirHandle.requestPermission({ mode: 'read' })
      setMessage('Folder handle available; open via browser UI (native file manager not supported here).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open folder.')
    }
  }

  const initIdb = async () => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const db = await openDatabase()
      bootstrapSchema(db)
      await saveToIdb(serialize(db))
      setStatus({ path: 'IndexedDB/worktracker.db', lastSaved: new Date().toISOString() })
      setMessage('Initialized database in IndexedDB.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize IndexedDB database.')
    } finally {
      setBusy(false)
    }
  }

  const exportIdb = async () => {
    try {
      const data = await loadFromIdb()
      if (!data) throw new Error('No stored database to export.')
      const blob = new Blob([data], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'worktracker.db'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const importIdb = async (file: File) => {
    setImporting(true)
    setError(null)
    setMessage(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      await saveToIdb(bytes)
      setStatus({ path: 'IndexedDB/worktracker.db', lastSaved: new Date().toISOString() })
      setMessage('Database imported.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Dialog open={showStorageWarning} onClose={() => setShowStorageWarning(false)} title="Storage required">
        <div className="space-y-4 text-sm text-text-secondary">
          <p>
            Please create and select a database folder in Storage before continuing to other settings.
          </p>
          <p>
            This app stores data locally on your machine to keep confidential information safe. Choose a secure
            location and avoid folders that might be cleaned automatically to prevent accidental deletion.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowStorageWarning(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Dialog>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-text-secondary">
            Settings
          </p>
          <h2 className="text-3xl font-semibold text-text-primary">Workflow & Storage</h2>
          <p className="text-text-secondary">
            Customize your board and control where WorkTracker saves data.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-secondary">
          Mode: {persistenceLabel}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['preferences', 'theme', 'storage'] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={activeTab === tab ? 'primary' : 'ghost'}
            onClick={() => {
              if (tab !== 'storage' && !storageReady) {
                setShowStorageWarning(true)
                return
              }
              setActiveTab(tab)
            }}
          >
            {tab === 'storage' ? 'Storage' : tab === 'preferences' ? 'User preferences' : 'Theme'}
          </Button>
        ))}
      </div>

      {activeTab === 'preferences' ? (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Workflow layout</p>
              <p className="text-xs text-text-secondary">
                Drag handles to reorder statuses, swimlanes, and type-of-work values. Rename or delete items directly.
              </p>
            </div>
            {(message || error) && (
              <div className="text-right space-y-1">
                {message ? <p className="text-xs text-emerald-500">{message}</p> : null}
                {error ? <p className="text-xs text-red-500">{error}</p> : null}
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-panel-border bg-surface-2/70 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Epic status</p>
                  <p className="text-[11px] text-text-secondary">Drag to reorder, rename, or remove.</p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {columns.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto">
                {columns.map((col, idx) => (
                  <div
                    key={`status-${idx}-${col}`}
                    draggable
                    onDragStart={() => handleDragStart('columns', idx)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      handleDrop('columns', idx, setColumns)
                    }}
                    onDragEnd={handleDragEnd}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-background px-2 py-1 text-sm shadow-sm transition hover:border-border"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-text-primary">{col}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => renameColumnLabel(idx)}
                        aria-label="Rename status"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteColumnLabel(idx)}
                        aria-label="Delete status"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Add status"
                  value={newColumnLabel}
                  onChange={(e) => {
                    setNewColumnLabel(e.target.value)
                    setStatusMessage(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addColumnLabel()
                    }
                  }}
                  className="flex-1"
                />
                <Button size="sm" onClick={addColumnLabel}>
                  Add
                </Button>
              </div>
              {statusMessage ? <p className="text-[11px] text-amber-500">{statusMessage}</p> : null}
            </div>

            <div className="rounded-2xl border border-panel-border bg-surface-2/70 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Swimlanes</p>
                  <p className="text-[11px] text-text-secondary">Drag to reorder and rename lanes.</p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {swimlanes.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto">
                {swimlanes.map((lane, idx) => (
                  <div
                    key={`lane-${idx}-${lane}`}
                    draggable
                    onDragStart={() => handleDragStart('swimlanes', idx)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      handleDrop('swimlanes', idx, setSwimlanes)
                    }}
                    onDragEnd={handleDragEnd}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-background px-2 py-1 text-sm shadow-sm transition hover:border-border"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-text-primary">{lane}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => renameSwimlaneLabel(idx)}
                        aria-label="Rename swimlane"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteSwimlaneLabel(idx)}
                        aria-label="Delete swimlane"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Add swimlane"
                  value={newSwimlaneLabel}
                  onChange={(e) => {
                    setNewSwimlaneLabel(e.target.value)
                    setLaneMessage(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSwimlaneLabel()
                    }
                  }}
                  className="flex-1"
                />
                <Button size="sm" onClick={addSwimlaneLabel}>
                  Add
                </Button>
              </div>
              {laneMessage ? <p className="text-[11px] text-amber-500">{laneMessage}</p> : null}
            </div>

            <div className="rounded-2xl border border-panel-border bg-surface-2/70 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Type of work</p>
                  <p className="text-[11px] text-text-secondary">
                    Manage values that show in story and meeting picklists.
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {typeOptions.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto">
                {typeOptions.map((value, idx) => (
                  <div
                    key={`type-${idx}-${value}`}
                    draggable
                    onDragStart={() => handleDragStart('type', idx)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      handleDrop('type', idx, setTypeOptions)
                    }}
                    onDragEnd={handleDragEnd}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-background px-2 py-1 text-sm shadow-sm transition hover:border-border"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-text-primary">{value}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => renameTypeLabel(idx)}
                        aria-label="Rename type of work option"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteTypeLabel(idx)}
                        aria-label="Delete type of work option"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Add option"
                  value={newTypeLabel}
                  onChange={(e) => {
                    setNewTypeLabel(e.target.value)
                    setTypeMessage(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTypeLabel()
                    }
                  }}
                  className="flex-1"
                />
                <Button size="sm" onClick={addTypeLabel}>
                  Add
                </Button>
              </div>
              {typeMessage ? <p className="text-[11px] text-amber-500">{typeMessage}</p> : null}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-text-secondary">
              Reordering also updates the kanban board layout and story detail picklists.
            </p>
            <Button onClick={handleSaveWorkflow} disabled={savingWorkflow}>
              {savingWorkflow ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>
      ) : null
      }

      {activeTab === 'theme' ? (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Theme</p>
              <p className="text-xs text-text-secondary">
                Toggle between the dark system skin and a lighter, high-contrast option.
              </p>
            </div>
            <Button variant="ghost" onClick={handleThemeToggle}>
              {themeMode === 'dark' ? 'Switch to light version' : 'Switch to dark version'}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-text-secondary">Accent</p>
            <Button
              size="sm"
              variant={accent === 'indigo' ? 'primary' : 'ghost'}
              onClick={() => setAccent('indigo')}
            >
              Indigo
            </Button>
            <Button
              size="sm"
              variant={accent === 'teal' ? 'primary' : 'ghost'}
              onClick={() => setAccent('teal')}
            >
              Teal
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === 'storage' ? (
        <>
          {mode === 'fs-access' ? (
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
              <Button onClick={chooseFolder} disabled={busy}>
                {dirHandle ? 'Change folder' : 'Choose folder'}
              </Button>
              <Button variant="ghost" onClick={handleBackup} disabled={busy || !dirHandle}>
                Backup now
              </Button>
                <Button variant="ghost" onClick={handleValidate} disabled={busy || !dirHandle}>
                  Validate DB
                </Button>
                <Button variant="ghost" onClick={handleCompact} disabled={busy || !dirHandle}>
                  Compact DB
                </Button>
                <Button variant="ghost" onClick={handleOpenFolder} disabled={!dirHandle}>
                  Open folder
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">Database path</p>
                  <Input readOnly value={status.path ?? 'Not selected'} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">Last saved</p>
                  <Input readOnly value={status.lastSaved ?? 'N/A'} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">Last backup</p>
                <Input readOnly value={lastBackup ?? 'N/A'} />
              </div>

              <p className="text-sm text-text-secondary">
                Backups are stored in /backups within the selected folder. Retention: last 10 backups.
              </p>
            </Card>
          ) : (
            <Card className="p-6 space-y-4">
              <p className="text-text-secondary">
                File System Access is not available in this browser. Using IndexedDB as the primary
                store. Export/import to move the .db file.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={initIdb} disabled={busy}>
                  Initialize DB
                </Button>
                <Button variant="ghost" onClick={exportIdb}>
                  Export .db
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-accent">
                  <input
                    type="file"
                    accept=".db,application/octet-stream"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) importIdb(file)
                    }}
                  />
                  Import .db
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">Database path</p>
                  <Input readOnly value={status.path ?? 'IndexedDB/worktracker.db'} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">Last saved</p>
                  <Input readOnly value={status.lastSaved ?? 'N/A'} />
                </div>
              </div>
              {importing ? <p className="text-sm text-text-secondary">Importing…</p> : null}
            </Card>
          )}

          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">JSON import/export</p>
                <p className="text-xs text-text-secondary">
                  Portable backup alongside the .db. Imports create a pre-import backup.
                </p>
              </div>
              <Button variant="ghost" onClick={exportJson}>
                Export JSON
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-accent">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportFile(file)
                  }}
                />
                Choose JSON to import
              </label>
              <Select
                value={importStrategy}
                onChange={(e) => setImportStrategy(e.target.value as ImportStrategy)}
                className="max-w-[180px]"
              >
                <option value="merge">Merge</option>
                <option value="overwrite">Overwrite</option>
              </Select>
              <Button onClick={runImport} disabled={!importPreview || busy}>
                Import
              </Button>
            </div>
            {importPreview ? (
              <div className="grid gap-2 md:grid-cols-2 text-sm text-text-secondary">
                <div>Stories: {importPreview.tasks.length}</div>
                <div>Notes: {importPreview.meetingNotes.length}</div>
                <div>OKRs: {importPreview.okrs.length}</div>
                <div>Comments: {importPreview.comments.length}</div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Select a JSON file to preview counts.</p>
            )}
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('fs-access')}
              disabled={mode === 'fs-access' || !hasFileSystemAccess()}
            >
              Use File System Access
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMode('idb')} disabled={mode === 'idb'}>
              Use IndexedDB fallback
            </Button>
          </div>

          {message ? (
            <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-text-primary">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default DataStoragePanel
