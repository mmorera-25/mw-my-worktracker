const DB_NAME = 'worktracker-handles'
const STORE = 'handles'

const openHandleDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
  try {
    const db = await openHandleDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(handle, 'dir')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.error('Failed to store directory handle', error)
  }
}

export const loadDirectoryHandle = async () => {
  try {
    const db = await openHandleDb()
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get('dir')
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch (error) {
    console.error('Failed to load directory handle', error)
    return null
  }
}
