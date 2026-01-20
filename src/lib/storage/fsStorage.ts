import { openDatabase, serialize } from './sqliteWasm'
import { bootstrapSchema } from './schema'

const mainDbName = 'worktracker.db'
const tempDbName = 'worktracker-temp.db'

export type StorageStatus = {
  path: string
  lastSaved?: string
}

const getDbHandle = async (dir: FileSystemDirectoryHandle) =>
  dir.getFileHandle(mainDbName, { create: true })

const getFileBytes = async (file: File) => new Uint8Array(await file.arrayBuffer())

export const ensureDatabase = async (dir: FileSystemDirectoryHandle): Promise<StorageStatus> => {
  const fileHandle = await getDbHandle(dir)
  const file = await fileHandle.getFile()
  let dbBytes = file.size > 0 ? await getFileBytes(file) : undefined
  const db = await openDatabase(dbBytes)

  if (!dbBytes) {
    bootstrapSchema(db)
  }

  await writeDatabase(dir, db)

  return {
    path: `/${dir.name}/${mainDbName}`,
    lastSaved: new Date().toISOString(),
  }
}

export const writeDatabase = async (dir: FileSystemDirectoryHandle, db: import('sql.js').Database) => {
  const bytes = serialize(db)
  const tempHandle = await dir.getFileHandle(tempDbName, { create: true })
  let tempWritable = await tempHandle.createWritable()
  await tempWritable.write(bytes)
  await tempWritable.close()

  const mainHandle = await getDbHandle(dir)
  let writable = await mainHandle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

export const validateDatabase = async (dir: FileSystemDirectoryHandle) => {
  const fileHandle = await getDbHandle(dir)
  const file = await fileHandle.getFile()
  const db = await openDatabase(await getFileBytes(file))
  const result = db.exec('PRAGMA integrity_check;')
  const status = result?.[0]?.values?.[0]?.[0] ?? 'error'
  return status === 'ok'
}

export const compactDatabase = async (dir: FileSystemDirectoryHandle) => {
  const fileHandle = await getDbHandle(dir)
  const file = await fileHandle.getFile()
  const db = await openDatabase(await getFileBytes(file))
  db.exec('VACUUM;')
  await writeDatabase(dir, db)
}

const ensureBackupsDir = async (dir: FileSystemDirectoryHandle) =>
  dir.getDirectoryHandle('backups', { create: true })

export const backupDatabase = async (dir: FileSystemDirectoryHandle) => {
  const fileHandle = await getDbHandle(dir)
  const file = await fileHandle.getFile()
  const bytes = await getFileBytes(file)
  const backupsDir = await ensureBackupsDir(dir)
  const timestamp = new Date().toISOString().replace(/[:]/g, '-')
  const backupHandle = await backupsDir.getFileHandle(
    `worktracker_${timestamp}.db`,
    { create: true },
  )
  const writable = await backupHandle.createWritable()
  await writable.write(bytes)
  await writable.close()

  await enforceRetention(backupsDir)
}

const enforceRetention = async (backupsDir: FileSystemDirectoryHandle, max = 10) => {
  const entries: { name: string; handle: FileSystemFileHandle }[] = []
  for await (const [name, handle] of backupsDir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.db')) {
      entries.push({ name, handle })
    }
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : 1))
  const excess = entries.length - max
  if (excess > 0) {
    const toDelete = entries.slice(0, excess)
    await Promise.all(toDelete.map(({ name }) => backupsDir.removeEntry(name).catch(() => {})))
  }
}

export const getLastSaved = async (dir: FileSystemDirectoryHandle) => {
  const handle = await getDbHandle(dir)
  const file = await handle.getFile()
  return file.lastModified ? new Date(file.lastModified).toISOString() : undefined
}
