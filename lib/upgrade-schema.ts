export const upgradeSchema = [
  `CREATE TABLE IF NOT EXISTS portal_users (id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('citizen','official')),password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS portal_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES portal_users(id),expires_at INTEGER NOT NULL,official_code_hash TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_portal_sessions_expiry ON portal_sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS portal_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS complaint_registry (report_id TEXT PRIMARY KEY REFERENCES reports(id),owner_id TEXT,ward TEXT NOT NULL DEFAULT 'Unverified locality',provider TEXT NOT NULL DEFAULT '',assignee TEXT NOT NULL DEFAULT '',due_at INTEGER,provider_ticket TEXT NOT NULL DEFAULT '',coordination TEXT NOT NULL DEFAULT 'Not required',clarification TEXT NOT NULL DEFAULT '',escalated INTEGER NOT NULL DEFAULT 0,photo_approved INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_registry_owner ON complaint_registry(owner_id)`,
  `CREATE TABLE IF NOT EXISTS complaint_supports (report_id TEXT NOT NULL REFERENCES reports(id),user_id TEXT NOT NULL REFERENCES portal_users(id),created_at INTEGER NOT NULL,PRIMARY KEY(report_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS complaint_photos (id TEXT PRIMARY KEY,report_id TEXT NOT NULL REFERENCES reports(id),user_id TEXT NOT NULL REFERENCES portal_users(id),photo_key TEXT NOT NULL UNIQUE REFERENCES uploads(key),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at INTEGER NOT NULL,reviewed_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_photo ON complaint_photos(report_id) WHERE status='pending'`,
];
