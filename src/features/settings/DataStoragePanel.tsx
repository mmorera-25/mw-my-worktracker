import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
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
  onStorageReady?: () => void
  requiresStorageSetup?: boolean
}

const DataStoragePanel = ({
  workflow,
  onUpdateWorkflow,
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
  const [importPreview, setImportPreview] = useState<Snapshot | null>(null)
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('merge')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getThemeMode())
  const [activeTab, setActiveTab] = useState<'storage' | 'preferences' | 'theme'>(
    requiresStorageSetup ? 'storage' : 'preferences',
  )
  const [showStorageWarning, setShowStorageWarning] = useState(false)
  const storageReady = mode === 'fs-access' && !!dirHandle

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
    if (requiresStorageSetup) {
      setActiveTab('storage')
    }
  }, [requiresStorageSetup])
  useEffect(() => {
    if (!storageReady) {
      setActiveTab('storage')
    }
  }, [storageReady])


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

  const handleSaveWorkflow = async () => {
    const nextColumns = normalizeList(columns) || workflow.columns
    const nextSwimlanes = normalizeList(swimlanes) || workflow.swimlanes
    const next: WorkflowConfig = {
      columns: nextColumns.length ? nextColumns : workflow.columns,
      swimlanes: nextSwimlanes.length ? nextSwimlanes : workflow.swimlanes,
      accent,
    }
    await onUpdateWorkflow(next)
    setMessage('Workflow updated.')
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
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">User preferences</p>
              <p className="text-xs text-text-secondary">
                Update epic status and swimlanes. Changes apply immediately.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Epic Status</p>
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={col}
                    onChange={(e) =>
                      setColumns((list) => list.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setColumns((list) => {
                        const next = [...list]
                        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                        return next
                      })
                    }
                    disabled={idx === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setColumns((list) => {
                        const next = [...list]
                        ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                        return next
                      })
                    }
                    disabled={idx === columns.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setColumns((list) => list.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setColumns((list) => [...list, `Status ${list.length + 1}`])}
              >
                Add status
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Swimlanes</p>
              {swimlanes.map((lane, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={lane}
                    onChange={(e) =>
                      setSwimlanes((list) => list.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSwimlanes((list) => {
                        const next = [...list]
                        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                        return next
                      })
                    }
                    disabled={idx === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSwimlanes((list) => {
                        const next = [...list]
                        ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                        return next
                      })
                    }
                    disabled={idx === swimlanes.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSwimlanes((list) => list.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSwimlanes((list) => [...list, `Lane ${list.length + 1}`])}
              >
                Add swimlane
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveWorkflow}>Save workflow</Button>
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
