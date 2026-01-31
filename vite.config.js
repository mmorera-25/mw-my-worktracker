import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
const inboxPath = path.resolve(new URL('./src/inbox-dreams', import.meta.url).pathname)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@inbox': inboxPath,
    },
  },
})
