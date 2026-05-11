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
CREATE INDEX IF NOT EXISTS idx_reminder_log_user ON reminder_log (tg_user_id);
