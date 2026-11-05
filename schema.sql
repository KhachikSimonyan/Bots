CREATE TABLE IF NOT EXISTS users (
  tg_user_id TEXT PRIMARY KEY,
  chat_id TEXT,
  first_name TEXT,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_log (
  reminder_key TEXT PRIMARY KEY,
  tg_user_id TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_chat_id ON users (chat_id);
-- A legacy group address must never receive personal reminders. A private /start links it again.
UPDATE users SET chat_id=NULL WHERE chat_id IS NOT NULL AND chat_id<>tg_user_id;
CREATE TABLE IF NOT EXISTS user_state_parts (
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  part TEXT NOT NULL,
  PRIMARY KEY(user_id, position)
);
CREATE TABLE IF NOT EXISTS applied_changes (
  user_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  PRIMARY KEY(user_id, mutation_id)
);
CREATE TABLE IF NOT EXISTS api_sessions (
  token_hash TEXT PRIMARY KEY,
  user_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_sessions_expiry ON api_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_reminder_log_user ON reminder_log (tg_user_id);

CREATE TABLE IF NOT EXISTS reminder_indexed (
  user_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_schedule (
  user_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  revision TEXT NOT NULL,
  spec TEXT NOT NULL,
  next_at INTEGER,
  occurrence TEXT,
  available_at INTEGER,
  lease TEXT,
  PRIMARY KEY (user_id, task_key)
);
CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminder_schedule(available_at);
CREATE TABLE IF NOT EXISTS reminder_sent (
  user_id TEXT NOT NULL,
  occurrence TEXT NOT NULL,
  PRIMARY KEY (user_id, occurrence)
);
