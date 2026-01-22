# MW Worktracker

MW Worktracker is a personal productivity PWA for managing meetings, stories, epics, OKRs, notes, and attachments. It runs at https://mw-morera-studio.web.app/ and is built with React, Vite, Tailwind, and local-first storage (SQLite/IndexedDB) with optional filesystem persistence.

- Track epics and stories with rich text descriptions, comments, attachments, due dates, and custom statuses.
- One-on-one meeting workspace with note-taking, story linking, participant tracking (including the General role with attendees), and trash management for completed items.
- Offline-friendly: data lives locally; when a filesystem directory is granted, the app can persist the DB and attachments to disk and reopen them later.
- Firebase Hosting CI workflows are included for deploys.

## Developer

Built and maintained by Manfred Morera.

## Getting started

```bash
npm install
npm run dev
```

To build: `npm run build`

If you use filesystem storage or attachments, run the app in Chrome/Edge and grant a directory when prompted. Never commit `.env.local` or other secrets.
