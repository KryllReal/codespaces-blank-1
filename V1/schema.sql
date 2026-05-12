CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  admin_name TEXT
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  executions INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  access_key TEXT,
  max_executions INTEGER,
  expires_at TEXT,
  version INTEGER DEFAULT 1,
  anti_skid INTEGER DEFAULT 0,
  allowed_hwids TEXT,
  remote_message TEXT,
  force_kick INTEGER DEFAULT 0,
  owner TEXT,
  use_adgate INTEGER DEFAULT 0,
  simple_protection INTEGER DEFAULT 0,
  key_system_url TEXT
);

CREATE TABLE IF NOT EXISTS active_users (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  username TEXT NOT NULL,
  hwid TEXT,
  ip TEXT NOT NULL,
  game_id TEXT NOT NULL,
  last_ping TEXT NOT NULL,
  action_kick INTEGER DEFAULT 0,
  action_message TEXT,
  action_script TEXT
);

CREATE TABLE IF NOT EXISTS temp_keys (
    id TEXT PRIMARY KEY,
    script_id TEXT,
    key_value TEXT,
    hwid TEXT,
    ip TEXT,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS authorized_clients (
    id TEXT PRIMARY KEY,
    script_id TEXT,
    hwid TEXT,
    ip TEXT,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS checkpoint_tickets (
    id TEXT PRIMARY KEY,
    script_id TEXT,
    hwid TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    discord_id TEXT,
    avatar TEXT,
    disabled INTEGER DEFAULT 0,
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_au_last_ping ON active_users(last_ping);
CREATE INDEX IF NOT EXISTS idx_ct_lookup ON checkpoint_tickets(script_id, is_used);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_scripts_owner ON scripts(owner);
CREATE INDEX IF NOT EXISTS idx_admins_discord ON admins(discord_id);

-- Xutions Analytics Tables
CREATE TABLE IF NOT EXISTS hub_projects (
    project_id TEXT PRIMARY KEY,
    owner_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    api_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hub_project_stats (
    project_id TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    stat_key TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (project_id, stat_type, stat_key)
);

CREATE TABLE IF NOT EXISTS hub_unique_ips (
    project_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    PRIMARY KEY (project_id, ip_hash)
);
