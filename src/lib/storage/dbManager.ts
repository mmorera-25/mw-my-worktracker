import { Database } from 'sql.js'
import { loadDirectoryHandle } from './handleStore'
import {
  backupDatabase,
  compactDatabase,
  ensureDatabase,
  getLastSaved,
  validateDatabase,
  writeDatabase,
} from './fsStorage'
import { loadFromIdb, saveToIdb } from './idbFallback'
import { openDatabase, serialize } from './sqliteWasm'
import { bootstrapSchema } from './schema'

export type DbMode = 'fs' | 'idb'

export type DbContext = {
  mode: DbMode
  db: Database
  dirHandle?: FileSystemDirectoryHandle
}

export const loadDb = async (): Promise<DbContext> => {
  const dir = await loadDirectoryHandle()
  if (dir) {
    const permission = await dir.queryPermission({ mode: 'readwrite' })
    if (permission === 'granted') {
      const info = await ensureDatabase(dir)
      // info is unused here; ensureDatabase writes db to disk
      const file = await (await dir.getFileHandle('worktracker.db')).getFile()
      const db = await openDatabase(new Uint8Array(await file.arrayBuffer()))
      bootstrapSchema(db)
      return { mode: 'fs', db, dirHandle: dir }
    }
  }

  const bytes = (await loadFromIdb()) ?? undefined
  const db = await openDatabase(bytes)
  bootstrapSchema(db)
  if (!bytes) {
    await saveToIdb(serialize(db))
  }
  return { mode: 'idb', db }
}

export const persistDb = async (ctx: DbContext) => {
  if (ctx.mode === 'fs' && ctx.dirHandle) {
    await writeDatabase(ctx.dirHandle, ctx.db)
    return
  }
  await saveToIdb(serialize(ctx.db))
}

export const validateDb = async (ctx: DbContext) => {
  if (ctx.mode === 'fs' && ctx.dirHandle) {
    return validateDatabase(ctx.dirHandle)
  }
  const result = ctx.db.exec('PRAGMA integrity_check;')
  return result?.[0]?.values?.[0]?.[0] === 'ok'
}

export const compactDb = async (ctx: DbContext) => {
  if (ctx.mode === 'fs' && ctx.dirHandle) {
    await compactDatabase(ctx.dirHandle)
    return
  }
  ctx.db.exec('VACUUM;')
  await persistDb(ctx)
}

export const backupDb = async (ctx: DbContext) => {
  if (ctx.mode === 'fs' && ctx.dirHandle) {
    await backupDatabase(ctx.dirHandle)
  }
}

export const getDbLastSaved = async (ctx: DbContext) => {
  if (ctx.mode === 'fs' && ctx.dirHandle) {
    return getLastSaved(ctx.dirHandle)
  }
  return undefined
}
