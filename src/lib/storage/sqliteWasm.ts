import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let sqlPromise: Promise<SqlJsStatic> | null = null

export const getSql = () => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => wasmUrl,
    })
  }
  return sqlPromise
}

export const openDatabase = async (data?: Uint8Array) => {
  const SQL = await getSql()
  return new SQL.Database(data)
}

export const serialize = (db: Database) => {
  return db.export()
}
