import { getStorage, listAll, ref, uploadBytes, getBytes } from 'firebase/storage'
import { app } from '../../firebase'

const encoder = new TextEncoder()

type BackupEnvelope = {
  v: 1
  iv: string
  salt: string
  data: string
  createdAt: string
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const projectId = app.options.projectId ?? 'worktracker'
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${passphrase}:${projectId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encryptBytes = async (bytes: Uint8Array, passphrase: string): Promise<BackupEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return {
    v: 1,
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    data: bytesToBase64(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString(),
  }
}

const decryptBytes = async (envelope: BackupEnvelope, passphrase: string) => {
  const iv = base64ToBytes(envelope.iv)
  const salt = base64ToBytes(envelope.salt)
  const key = await deriveKey(passphrase, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(envelope.data),
  )
  return new Uint8Array(decrypted)
}

const buildBackupName = (timestamp: string) =>
  `worktracker-backup-${timestamp.replace(/[:.]/g, '-')}.json`

const getBackupPath = (uid: string, name: string) => `backups/${uid}/${name}`

export const uploadEncryptedBackup = async (bytes: Uint8Array, uid: string, passphrase: string) => {
  const envelope = await encryptBytes(bytes, passphrase)
  const name = buildBackupName(envelope.createdAt)
  const storage = getStorage(app)
  const storageRef = ref(storage, getBackupPath(uid, name))
  const payload = new Blob([JSON.stringify(envelope)], { type: 'application/json' })
  await uploadBytes(storageRef, payload)
  return { createdAt: envelope.createdAt, path: storageRef.fullPath }
}

export const downloadLatestEncryptedBackup = async (uid: string, passphrase: string) => {
  const storage = getStorage(app)
  const folderRef = ref(storage, `backups/${uid}`)
  const list = await listAll(folderRef)
  if (list.items.length === 0) return null
  const items = list.items
    .filter((item) => item.name.startsWith('worktracker-backup-'))
    .sort((a, b) => (a.name > b.name ? 1 : -1))
  const latest = items[items.length - 1]
  const raw = await getBytes(latest)
  const text = new TextDecoder().decode(raw)
  const envelope = JSON.parse(text) as BackupEnvelope
  const bytes = await decryptBytes(envelope, passphrase)
  return { bytes, createdAt: envelope.createdAt, path: latest.fullPath }
}
