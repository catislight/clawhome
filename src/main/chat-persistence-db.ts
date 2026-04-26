import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'
import Database from 'better-sqlite3'

type MigrationStep = {
  version: number
  name: string
  sql: string
}

const MIGRATIONS: MigrationStep[] = [
  {
    version: 1,
    name: 'create-chat-persistence-schema-v1',
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_preferences (
  pref_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  value_json TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'json'
    CHECK (value_type IN ('json', 'string', 'number', 'boolean')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id INTEGER PRIMARY KEY,
  conversation_uid TEXT NOT NULL UNIQUE,
  instance_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  title TEXT,
  model_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  is_pinned INTEGER NOT NULL DEFAULT 0
    CHECK (is_pinned IN (0, 1)),
  last_message_preview TEXT,
  last_message_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT,
  ext_json TEXT
);

CREATE TABLE IF NOT EXISTS chat_runs (
  id INTEGER PRIMARY KEY,
  run_uid TEXT NOT NULL UNIQUE,
  conversation_id INTEGER NOT NULL,
  session_key TEXT NOT NULL,
  model_id TEXT,
  state TEXT NOT NULL
    CHECK (state IN ('queued', 'streaming', 'completed', 'aborted', 'error')),
  source_run_id TEXT,
  abort_reason TEXT,
  error_message TEXT,
  input_token_count INTEGER,
  output_token_count INTEGER,
  total_token_count INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT,
  ext_json TEXT,
  UNIQUE (conversation_id, source_run_id),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY,
  message_uid TEXT NOT NULL UNIQUE,
  conversation_id INTEGER NOT NULL,
  run_id INTEGER,
  source_message_id TEXT,
  client_message_id TEXT,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('assistant', 'user', 'system', 'tool')),
  status TEXT
    CHECK (status IN ('sending', 'sent', 'streaming', 'error', 'aborted')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  metadata_json TEXT,
  ext_json TEXT,
  UNIQUE (conversation_id, seq),
  UNIQUE (conversation_id, source_message_id),
  UNIQUE (conversation_id, client_message_id),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES chat_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_message_tags (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  tag_type TEXT NOT NULL
    CHECK (tag_type IN ('image', 'attachment', 'text')),
  label TEXT NOT NULL,
  preview_src TEXT,
  relative_path TEXT,
  absolute_path TEXT,
  metadata_json TEXT,
  UNIQUE (message_id, seq),
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_tool_calls (
  id INTEGER PRIMARY KEY,
  tool_call_uid TEXT NOT NULL UNIQUE,
  run_id INTEGER NOT NULL,
  conversation_id INTEGER NOT NULL,
  source_tool_call_id TEXT,
  seq INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  skill_name TEXT,
  state TEXT NOT NULL
    CHECK (state IN ('started', 'running', 'completed', 'error', 'aborted')),
  args_text TEXT,
  result_text TEXT,
  args_json TEXT,
  result_json TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT,
  ext_json TEXT,
  UNIQUE (run_id, seq),
  UNIQUE (run_id, source_tool_call_id),
  FOREIGN KEY (run_id) REFERENCES chat_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_tool_logs (
  id INTEGER PRIMARY KEY,
  log_uid TEXT NOT NULL UNIQUE,
  run_id INTEGER NOT NULL,
  conversation_id INTEGER NOT NULL,
  tool_call_id INTEGER,
  source_event_id TEXT,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL
    CHECK (phase IN ('start', 'update', 'result', 'error', 'info')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'text'
    CHECK (content_format IN ('text', 'json', 'markdown')),
  created_at INTEGER NOT NULL,
  metadata_json TEXT,
  UNIQUE (run_id, seq),
  UNIQUE (run_id, source_event_id),
  FOREIGN KEY (run_id) REFERENCES chat_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_call_id) REFERENCES chat_tool_calls(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pref_scope_key
  ON app_preferences(scope, pref_key);

CREATE INDEX IF NOT EXISTS idx_conv_updated
  ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_status_updated
  ON chat_conversations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_instance_session
  ON chat_conversations(instance_id, session_key);

CREATE INDEX IF NOT EXISTS idx_runs_conversation_started
  ON chat_runs(conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_session_started
  ON chat_runs(session_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_state_started
  ON chat_runs(state, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq
  ON chat_messages(conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_run
  ON chat_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_messages_visible
  ON chat_messages(conversation_id, seq)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_tags_message_seq
  ON chat_message_tags(message_id, seq);

CREATE INDEX IF NOT EXISTS idx_tool_calls_run_seq
  ON chat_tool_calls(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_started
  ON chat_tool_calls(conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name_started
  ON chat_tool_calls(tool_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_state_started
  ON chat_tool_calls(state, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_logs_run_seq
  ON chat_tool_logs(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_call_seq
  ON chat_tool_logs(tool_call_id, seq);
CREATE INDEX IF NOT EXISTS idx_tool_logs_conversation_created
  ON chat_tool_logs(conversation_id, created_at DESC);
`
  }
]

let chatPersistenceDatabase: Database.Database | null = null

function resolveDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, {
    recursive: true
  })
  return path.resolve(userDataPath, 'clawhome-chat.db')
}

function applyPragmas(database: Database.Database): void {
  database.pragma('journal_mode = WAL')
  database.pragma('synchronous = NORMAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  database.pragma('temp_store = MEMORY')
  database.pragma('wal_autocheckpoint = 1000')
  database.pragma('cache_size = -20000')
  database.pragma('mmap_size = 268435456')
}

function applyMigrations(database: Database.Database): void {
  database.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
)
`)

  const appliedVersionRows = database
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: number }>
  const appliedVersions = new Set(appliedVersionRows.map((row) => row.version))
  const insertMigration = database.prepare(
    'INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
  )

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    database.exec('BEGIN IMMEDIATE')
    try {
      database.exec(migration.sql)
      insertMigration.run(
        migration.version,
        migration.name,
        `${migration.version}:${migration.name}`,
        Date.now()
      )
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}

function createDatabase(): Database.Database {
  const database = new Database(resolveDatabasePath())
  applyPragmas(database)
  applyMigrations(database)
  return database
}

export function getChatPersistenceDatabase(): Database.Database {
  if (chatPersistenceDatabase) {
    return chatPersistenceDatabase
  }

  chatPersistenceDatabase = createDatabase()
  return chatPersistenceDatabase
}

export function closeChatPersistenceDatabase(): void {
  if (!chatPersistenceDatabase) {
    return
  }

  chatPersistenceDatabase.close()
  chatPersistenceDatabase = null
}

