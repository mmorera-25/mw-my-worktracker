import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Dialog from '../../components/ui/Dialog'
import type { WorkflowConfig } from '../../lib/settings/configRepository'
import type { Story } from '../../inbox-dreams/types'
import {
  backupDatabase,
  ensureDatabase,
  getLastBackup,
  getLastSaved,
  validateDatabase,
  writeDatabase,
} from '../../lib/storage/fsStorage'
import { loadDirectoryHandle, saveDirectoryHandle } from '../../lib/storage/handleStore'
import { loadFromIdb, saveToIdb } from '../../lib/storage/idbFallback'
import { openDatabase, serialize } from '../../lib/storage/sqliteWasm'
import { bootstrapSchema } from '../../lib/storage/schema'
import { loadDb } from '../../lib/storage/dbManager'
import { loadInboxState, saveInboxState } from '../../inbox-dreams/data/inboxRepository'
import { downloadLatestEncryptedBackup, uploadEncryptedBackup } from '../../lib/storage/cloudBackup'
import { auth } from '../../firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
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
  statusUsageCounts?: Record<string, number>
  typeUsageCounts?: Record<string, number>
  onStorageReady?: () => void
  requiresStorageSetup?: boolean
}

const DataStoragePanel = ({
  workflow,
  onUpdateWorkflow,
  typeOfWorkOptions,
  onPersistTypeOfWorkOptions,
  statusUsageCounts = {},
  typeUsageCounts = {},
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
  const [savedStatusIndex, setSavedStatusIndex] = useState<number>(
    workflow.savedStatusIndex ?? workflow.columns.length,
  )
  const [swimlanes, setSwimlanes] = useState<string[]>(workflow.swimlanes)
  const [accent, setAccent] = useState<WorkflowConfig['accent']>(workflow.accent)
  const [typeOptions, setTypeOptions] = useState<string[]>(typeOfWorkOptions)
  const [newColumnLabel, setNewColumnLabel] = useState('')
  const [newSwimlaneLabel, setNewSwimlaneLabel] = useState('')
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [storiesSnapshot, setStoriesSnapshot] = useState<Story[]>([])
  const [laneMessage, setLaneMessage] = useState<string | null>(null)
  const [typeMessage, setTypeMessage] = useState<string | null>(null)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [cloudUser, setCloudUser] = useState<User | null>(auth.currentUser)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [lastCloudBackup, setLastCloudBackup] = useState<string | null>(null)
  const [cloudPassphrase, setCloudPassphrase] = useState('')
  const [cloudRestorePassphrase, setCloudRestorePassphrase] = useState('')
  const [showCloudBackupModal, setShowCloudBackupModal] = useState(false)
  const [showCloudRestoreModal, setShowCloudRestoreModal] = useState(false)
  const [showCloudBackupPass, setShowCloudBackupPass] = useState(false)
  const [showCloudRestorePass, setShowCloudRestorePass] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const minPassphraseLength = 12
  const lastLocalBackupKey = 'worktracker:last-local-backup'
  const lastCloudBackupKey = 'worktracker:last-cloud-backup'
  const passphraseRules = useMemo(
    () => ({
      minLength: (value: string) => value.length >= minPassphraseLength,
      hasUpper: (value: string) => /[A-Z]/.test(value),
      hasLower: (value: string) => /[a-z]/.test(value),
      hasNumber: (value: string) => /[0-9]/.test(value),
      hasSymbol: (value: string) => /[^A-Za-z0-9]/.test(value),
    }),
    [minPassphraseLength],
  )
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getThemeMode())
  const [activeTab, setActiveTab] = useState<'storage' | 'preferences' | 'theme'>(
    requiresStorageSetup ? 'storage' : 'preferences',
  )
  const [showStorageWarning, setShowStorageWarning] = useState(false)
  const storageReady = mode === 'fs-access' && !!dirHandle
  const dragState = useRef<{ listKey: string; index: number } | null>(null)
  const savedStatusLabel = 'Saved'
  const statusList = useMemo(() => {
    const base = columns.filter((item) => item.toLowerCase() !== savedStatusLabel.toLowerCase())
    const index = Math.min(Math.max(savedStatusIndex, 0), base.length)
    const next = [...base]
    next.splice(index, 0, savedStatusLabel)
    return next
  }, [columns, savedStatusIndex])

  useEffect(() => {
    if (mode !== 'fs-access') return
    ;(async () => {
      const stored = await loadDirectoryHandle()
      if (!stored) return
      const permission = await stored.queryPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        setDirHandle(stored)
        const last = await getLastSaved(stored)
        const lastUserBackup = await getLastBackup(stored)
        setStatus({ path: `/${stored.name}/worktracker.db`, lastSaved: last })
        const storedLocalBackup = window.localStorage.getItem(lastLocalBackupKey)
        setLastBackup(lastUserBackup ?? storedLocalBackup)
        if (lastUserBackup) {
          window.localStorage.setItem(lastLocalBackupKey, lastUserBackup)
        }
        onStorageReady?.()
      }
    })()
  }, [mode, onStorageReady])

  useEffect(() => {
    setColumns(workflow.columns)
    setSwimlanes(workflow.swimlanes)
    setAccent(workflow.accent)
    setSavedStatusIndex(workflow.savedStatusIndex ?? workflow.columns.length)
  }, [workflow])
  useEffect(() => {
    setTypeOptions(typeOfWorkOptions)
  }, [typeOfWorkOptions])
  useEffect(() => {
    if (requiresStorageSetup) {
      setActiveTab('storage')
    }
  }, [requiresStorageSetup])
  useEffect(() => onAuthStateChanged(auth, setCloudUser), [])
  useEffect(() => {
    const loadStories = async () => {
      try {
        const ctx = await loadDb()
        const inboxState = loadInboxState(ctx.db)
        setStoriesSnapshot(inboxState.stories ?? [])
      } catch {
        setStoriesSnapshot([])
      }
    }
    loadStories()
  }, [])
  useEffect(() => {
    setLastBackup(window.localStorage.getItem(lastLocalBackupKey))
    setLastCloudBackup(window.localStorage.getItem(lastCloudBackupKey))
  }, [])
  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    },
    [],
  )

  const getPassphraseStatus = (value: string) => ({
    minLength: passphraseRules.minLength(value),
    hasUpper: passphraseRules.hasUpper(value),
    hasLower: passphraseRules.hasLower(value),
    hasNumber: passphraseRules.hasNumber(value),
    hasSymbol: passphraseRules.hasSymbol(value),
  })

  const isPassphraseValid = (value: string) => {
    const status = getPassphraseStatus(value)
    return Object.values(status).every(Boolean)
  }

  const getPassphraseStrength = (value: string) => {
    const status = getPassphraseStatus(value)
    const score =
      (status.minLength ? 1 : 0) +
      (status.hasUpper ? 1 : 0) +
      (status.hasLower ? 1 : 0) +
      (status.hasNumber ? 1 : 0) +
      (status.hasSymbol ? 1 : 0)
    if (!value) {
      return { label: 'Enter password', percent: 0, color: 'bg-border' }
    }
    if (score <= 2) return { label: 'Weak', percent: 40, color: 'bg-red-500' }
    if (score === 3) return { label: 'Fair', percent: 60, color: 'bg-amber-400' }
    if (score === 4) return { label: 'Good', percent: 80, color: 'bg-lime-400' }
    return { label: 'Strong', percent: 100, color: 'bg-emerald-500' }
  }

  const formatBackupLabel = (value?: string | null) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'N/A'
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const daysDiff = Math.round(
      (startOfDay(new Date()).getTime() - startOfDay(parsed).getTime()) / 86400000,
    )
    let relative = ''
    if (daysDiff === 0) relative = 'today'
    else if (daysDiff === 1) relative = '1 day ago'
    else if (daysDiff > 1) relative = `${daysDiff} days ago`
    else relative = `${Math.abs(daysDiff)} days from now`
    return `${formatted} (${relative})`
  }


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
      const lastUserBackup = await getLastBackup(handle)
      setStatus(info)
      setLastBackup(lastUserBackup)
      if (lastUserBackup) {
        window.localStorage.setItem(lastLocalBackupKey, lastUserBackup)
      }
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
      const lastUserBackup = await getLastBackup(dirHandle)
      const resolvedBackup = lastUserBackup ?? new Date().toISOString()
      setLastBackup(resolvedBackup)
      window.localStorage.setItem(lastLocalBackupKey, resolvedBackup)
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
    const current = dragState.current
    if (!current || current.listKey !== listKey) return
    const fromIndex = current.index
    if (listKey === 'statuses') {
      const next = reorderList(statusList, fromIndex, index)
      const nextSavedIndex = next.findIndex((item) => item === savedStatusLabel)
      const nextColumns = next.filter((item) => item !== savedStatusLabel)
      setColumns(nextColumns)
      setSavedStatusIndex(nextSavedIndex >= 0 ? nextSavedIndex : nextColumns.length)
      dragState.current = null
      return
    }
    // use the captured index to avoid reading cleared ref when React flushes updates later
    setter((prev) => reorderList(prev, fromIndex, index))
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
      const clampedSavedIndex = Math.min(Math.max(savedStatusIndex, 0), nextColumns.length)
      const next: WorkflowConfig = {
        columns: nextColumns.length ? nextColumns : workflow.columns,
        swimlanes: nextSwimlanes.length ? nextSwimlanes : workflow.swimlanes,
        accent,
        savedStatusIndex: clampedSavedIndex,
      }
      if (storiesSnapshot.length > 0) {
        const ctx = await loadDb()
        const inboxState = loadInboxState(ctx.db)
        saveInboxState(ctx.db, {
          epics: inboxState.epics,
          stories: storiesSnapshot,
          preferences: inboxState.preferences,
        })
        await persistDb(ctx)
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
    if (trimmed.toLowerCase() === savedStatusLabel.toLowerCase()) {
      setStatusMessage('Saved is reserved for Documentation stories.')
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
    if (nextLabel.toLowerCase() === savedStatusLabel.toLowerCase()) {
      setStatusMessage('Saved is reserved for Documentation stories.')
      return
    }
    if (columns.some((item) => item.toLowerCase() === nextLabel.toLowerCase())) {
      setStatusMessage('A status with that name already exists.')
      return
    }
    setStoriesSnapshot((prev) =>
      prev.map((story) =>
        story.status === current ? { ...story, status: nextLabel } : story,
      ),
    )
    setColumns((prev) => prev.map((item, idx) => (idx === index ? nextLabel : item)))
    setStatusMessage(null)
  }

  const deleteColumnLabel = (index: number) => {
    if (columns.length <= 1) {
      setStatusMessage('You need at least one status.')
      return
    }
    const label = columns[index]
    const usage = statusUsageCounts[label] ?? 0
    if (usage > 0) {
      setStatusMessage(`Cannot delete "${label}" while ${usage} stor${usage === 1 ? 'y' : 'ies'} use it.`)
      return
    }
    if (!window.confirm(`Delete "${label}"?`)) return
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
    setStoriesSnapshot((prev) =>
      prev.map((story) =>
        story.typeOfWork === current ? { ...story, typeOfWork: nextLabel } : story,
      ),
    )
    setTypeOptions((prev) => prev.map((item, idx) => (idx === index ? nextLabel : item)))
    setTypeMessage(null)
  }

  const deleteTypeLabel = (index: number) => {
    const label = typeOptions[index]
    const usage = typeUsageCounts[label] ?? 0
    if (usage > 0) {
      setTypeMessage(`Cannot delete "${label}" while ${usage} stor${usage === 1 ? 'y' : 'ies'} use it.`)
      return
    }
    if (!window.confirm(`Delete option "${label}"?`)) return
    setTypeOptions((prev) => prev.filter((_, idx) => idx !== index))
  }

  const showToast = (type: 'success' | 'error', messageText: string) => {
    setToast({ type, message: messageText })
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  const handleCloudBackup = async (passphrase: string) => {
    if (!cloudUser) {
      showToast('error', 'Sign in to back up to Cloud.')
      return
    }
    if (!isPassphraseValid(passphrase.trim())) {
      showToast('error', 'Use a stronger password that meets all requirements.')
      return
    }
    setCloudBusy(true)
    try {
      const ctx = await loadDb()
      const bytes = serialize(ctx.db)
      const result = await uploadEncryptedBackup(bytes, cloudUser.uid, passphrase)
      setLastCloudBackup(result.createdAt)
      window.localStorage.setItem(lastCloudBackupKey, result.createdAt)
      showToast('success', 'Encrypted backup saved to Cloud.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cloud backup failed.')
    } finally {
      setCloudBusy(false)
    }
  }

  const handleCloudRestore = async (passphrase: string) => {
    if (!cloudUser) {
      showToast('error', 'Sign in to restore from Cloud.')
      return
    }
    if (!isPassphraseValid(passphrase.trim())) {
      showToast('error', 'Use a stronger password that meets all requirements.')
      return
    }
    if (!window.confirm('Replace the local database with the latest Cloud backup?')) return
    setCloudBusy(true)
    try {
      const result = await downloadLatestEncryptedBackup(cloudUser.uid, passphrase)
      if (!result) {
        showToast('error', 'No Cloud backups found.')
        return
      }
      if (mode === 'fs-access') {
        if (!dirHandle) {
          showToast('error', 'Choose a storage folder before restoring the backup.')
          return
        }
        const db = await openDatabase(result.bytes)
        await writeDatabase(dirHandle, db)
        const last = await getLastSaved(dirHandle)
        setStatus((prev) => ({ ...prev, lastSaved: last }))
      } else {
        await saveToIdb(result.bytes)
        setStatus({ path: 'IndexedDB/worktracker.db', lastSaved: new Date().toISOString() })
      }
      setLastCloudBackup(result.createdAt)
      window.localStorage.setItem(lastCloudBackupKey, result.createdAt)
      showToast('success', 'Cloud backup restored.')
      window.dispatchEvent(new Event('inbox-stories-updated'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cloud restore failed.')
    } finally {
      setCloudBusy(false)
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
      <Dialog
        open={showCloudBackupModal}
        onClose={() => {
          setShowCloudBackupModal(false)
          setCloudPassphrase('')
          setShowCloudBackupPass(false)
        }}
        title="Backup to Cloud"
      >
        <div className="space-y-4 text-sm text-text-secondary">
          <p>
            Set a backup password to encrypt this backup. You will need the same password to restore it.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">Password requirements:</p>
            <div className="grid gap-1 text-xs text-text-secondary">
              {(() => {
                const status = getPassphraseStatus(cloudPassphrase)
                const itemClass = (ok: boolean) =>
                  ok ? 'text-emerald-400' : 'text-text-secondary'
                return (
                  <>
                    <span className={itemClass(status.minLength)}>
                      {status.minLength ? '✓' : '•'} At least {minPassphraseLength} characters
                    </span>
                    <span className={itemClass(status.hasUpper)}>
                      {status.hasUpper ? '✓' : '•'} One uppercase letter
                    </span>
                    <span className={itemClass(status.hasLower)}>
                      {status.hasLower ? '✓' : '•'} One lowercase letter
                    </span>
                    <span className={itemClass(status.hasNumber)}>
                      {status.hasNumber ? '✓' : '•'} One number
                    </span>
                    <span className={itemClass(status.hasSymbol)}>
                      {status.hasSymbol ? '✓' : '•'} One symbol
                    </span>
                  </>
                )
              })()}
            </div>
            {(() => {
              const strength = getPassphraseStrength(cloudPassphrase)
              return (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Strength</span>
                      <span>{strength.label}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border">
                      <div
                        className={`h-2 rounded-full transition-all ${strength.color}`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showCloudBackupPass ? 'text' : 'password'}
                      value={cloudPassphrase}
                      onChange={(e) => setCloudPassphrase(e.target.value)}
                      placeholder="Backup password"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCloudBackupPass((prev) => !prev)}
                    >
                      {showCloudBackupPass ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCloudBackupModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!isPassphraseValid(cloudPassphrase.trim())) {
                  showToast('error', 'Use a stronger password that meets all requirements.')
                  return
                }
                handleCloudBackup(cloudPassphrase)
                setShowCloudBackupModal(false)
                setCloudPassphrase('')
              }}
              disabled={cloudBusy || !isPassphraseValid(cloudPassphrase.trim())}
            >
              Backup
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={showCloudRestoreModal}
        onClose={() => {
          setShowCloudRestoreModal(false)
          setCloudRestorePassphrase('')
          setShowCloudRestorePass(false)
        }}
        title="Restore from Cloud"
      >
        <div className="space-y-4 text-sm text-text-secondary">
          <p>
            Enter the backup password used when the Cloud backup was created.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">Password requirements:</p>
            <div className="grid gap-1 text-xs text-text-secondary">
              {(() => {
                const status = getPassphraseStatus(cloudRestorePassphrase)
                const itemClass = (ok: boolean) =>
                  ok ? 'text-emerald-400' : 'text-text-secondary'
                return (
                  <>
                    <span className={itemClass(status.minLength)}>
                      {status.minLength ? '✓' : '•'} At least {minPassphraseLength} characters
                    </span>
                    <span className={itemClass(status.hasUpper)}>
                      {status.hasUpper ? '✓' : '•'} One uppercase letter
                    </span>
                    <span className={itemClass(status.hasLower)}>
                      {status.hasLower ? '✓' : '•'} One lowercase letter
                    </span>
                    <span className={itemClass(status.hasNumber)}>
                      {status.hasNumber ? '✓' : '•'} One number
                    </span>
                    <span className={itemClass(status.hasSymbol)}>
                      {status.hasSymbol ? '✓' : '•'} One symbol
                    </span>
                  </>
                )
              })()}
            </div>
            {(() => {
              const strength = getPassphraseStrength(cloudRestorePassphrase)
              return (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Strength</span>
                      <span>{strength.label}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border">
                      <div
                        className={`h-2 rounded-full transition-all ${strength.color}`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showCloudRestorePass ? 'text' : 'password'}
                      value={cloudRestorePassphrase}
                      onChange={(e) => setCloudRestorePassphrase(e.target.value)}
                      placeholder="Backup password"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCloudRestorePass((prev) => !prev)}
                    >
                      {showCloudRestorePass ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCloudRestoreModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!isPassphraseValid(cloudRestorePassphrase.trim())) {
                  showToast('error', 'Use a stronger password that meets all requirements.')
                  return
                }
                handleCloudRestore(cloudRestorePassphrase)
                setShowCloudRestoreModal(false)
                setCloudRestorePassphrase('')
              }}
              disabled={cloudBusy || !isPassphraseValid(cloudRestorePassphrase.trim())}
            >
              Restore
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
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Story status</p>
                  <p className="text-[11px] text-text-secondary">Drag to reorder, rename, or remove.</p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {columns.length}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto">
                {statusList.map((col, idx) => {
                  const savedIndex = statusList.indexOf(savedStatusLabel)
                  const isSaved = col === savedStatusLabel
                  const columnIndex = idx - (isSaved ? 0 : savedIndex < idx ? 1 : 0)
                  return (
                  <div
                    key={`status-${idx}-${col}`}
                    draggable
                    onDragStart={() => handleDragStart('statuses', idx)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      handleDrop('statuses', idx, setColumns)
                    }}
                    onDragEnd={handleDragEnd}
                    className={`group flex items-center gap-2 rounded-md border border-transparent bg-background px-2 py-1 text-sm shadow-sm transition hover:border-border ${
                      isSaved ? 'border-dashed border-border/70 bg-background/60' : ''
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-text-primary">
                      {col}
                      {isSaved ? (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          Documentation only
                        </span>
                      ) : null}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {statusUsageCounts[col] ?? 0}
                    </span>
                    <div className={`flex gap-1 ${isSaved ? 'opacity-40' : ''}`}>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => renameColumnLabel(columnIndex)}
                        aria-label="Rename status"
                        disabled={isSaved}
                        aria-hidden={isSaved}
                        tabIndex={isSaved ? -1 : 0}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteColumnLabel(columnIndex)}
                        aria-label="Delete status"
                        disabled={isSaved}
                        aria-hidden={isSaved}
                        tabIndex={isSaved ? -1 : 0}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )})}
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
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {typeUsageCounts[value] ?? 0}
                    </span>
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
          {toast ? (
            <div
              className={`fixed right-6 top-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${
                toast.type === 'success'
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-red-500/50 bg-red-500/15 text-red-200'
              }`}
            >
              {toast.message}
            </div>
          ) : null}
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
              <div className="text-xs text-text-secondary">
                Last backup: {formatBackupLabel(lastBackup)}
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
                <p className="text-sm font-semibold text-text-primary">Cloud backup (encrypted)</p>
                <p className="text-xs text-text-secondary">
                  Optional manual backup stored in the Cloud. Encrypted in the browser, confidential,
                  and only restorable from this app.
                </p>
              </div>
              <div className="text-xs text-text-secondary">
                {cloudUser?.email ? `Signed in as ${cloudUser.email}` : 'Not signed in'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowCloudBackupModal(true)}
                disabled={cloudBusy || !cloudUser}
              >
                Backup to Cloud
              </Button>
              <Button
                onClick={() => setShowCloudRestoreModal(true)}
                disabled={cloudBusy || !cloudUser}
              >
                Restore from Cloud
              </Button>
              <span className="text-xs text-text-secondary">
                Last cloud backup: {formatBackupLabel(lastCloudBackup)}
              </span>
            </div>
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
