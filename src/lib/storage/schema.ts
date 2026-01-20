import type { Database } from 'sql.js'

const getColumnNames = (db: Database, table: string) =>
  new Set(
    db.exec(`PRAGMA table_info(${table});`)?.[0]?.values?.map((row) => row[1] as string) || [],
  )

const ensureColumns = (
  db: Database,
  table: string,
  columns: { name: string; definition: string }[],
) => {
  const existing = getColumnNames(db, table)
  columns.forEach((col) => {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.definition}`)
    }
  })
}

export const bootstrapSchema = (db: Database) => {
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '2');

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      config_notes TEXT,
      project TEXT,
      enablement_id TEXT,
      complexity TEXT,
      time_value INTEGER,
      time_unit TEXT,
      sprint TEXT,
      start_date INTEGER,
      due_date INTEGER,
      impact_percent INTEGER,
      okr_link TEXT,
      lane TEXT,
      swimlane TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS okrs (
      id TEXT PRIMARY KEY,
      objective TEXT NOT NULL,
      impact_weight REAL DEFAULT 0,
      description TEXT,
      owner TEXT,
      timeframe TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS okr_key_results (
      id TEXT PRIMARY KEY,
      okr_id TEXT NOT NULL,
      title TEXT NOT NULL,
      metric TEXT,
      target REAL,
      current REAL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS meeting_notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      color TEXT,
      meeting_date INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  ensureColumns(db, 'tasks', [
    { name: 'config_notes', definition: 'config_notes TEXT' },
    { name: 'project', definition: 'project TEXT' },
    { name: 'enablement_id', definition: 'enablement_id TEXT' },
    { name: 'time_value', definition: 'time_value INTEGER' },
    { name: 'time_unit', definition: 'time_unit TEXT' },
    { name: 'start_date', definition: 'start_date INTEGER' },
    { name: 'due_date', definition: 'due_date INTEGER' },
    { name: 'impact_percent', definition: 'impact_percent INTEGER' },
    { name: 'okr_link', definition: 'okr_link TEXT' },
    { name: 'lane', definition: 'lane TEXT' },
    { name: 'swimlane', definition: 'swimlane TEXT' },
    { name: 'latest_update', definition: 'latest_update TEXT' },
    { name: 'discussed', definition: 'discussed INTEGER DEFAULT 0' },
  ])

  ensureColumns(db, 'meeting_notes', [
    { name: 'color', definition: 'color TEXT' },
    { name: 'attendees', definition: 'attendees TEXT' },
    { name: 'project', definition: 'project TEXT' },
  ])

  const okrColumns = getColumnNames(db, 'okrs')
  ensureColumns(db, 'okrs', [
    { name: 'objective', definition: 'objective TEXT' },
    { name: 'impact_weight', definition: 'impact_weight REAL' },
  ])
  if (okrColumns.has('name')) {
    db.exec(
      "UPDATE okrs SET objective = COALESCE(objective, name) WHERE objective IS NULL OR objective = ''",
    )
  }
  db.exec(
    'UPDATE okrs SET impact_weight = COALESCE(impact_weight, 0) WHERE impact_weight IS NULL',
  )

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_okr_link ON tasks(okr_link);
    CREATE INDEX IF NOT EXISTS idx_tasks_lane_swimlane ON tasks(lane, swimlane);
    CREATE INDEX IF NOT EXISTS idx_okrs_id ON okrs(id);
    CREATE INDEX IF NOT EXISTS idx_okr_key_results_okr ON okr_key_results(okr_id);
  `)
}
