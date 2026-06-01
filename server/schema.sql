-- Run once against your NeonDB database to create all tables.
-- psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🎨',
  color      TEXT NOT NULL DEFAULT '#EEF2FF',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS workspaces_user_idx ON workspaces(user_id);

CREATE TABLE IF NOT EXISTS files (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL,
  share_token  TEXT,            -- unguessable token for the public share link (NULL = not shared)
  share_mode   TEXT             -- 'view' | 'edit' | NULL
);
CREATE INDEX IF NOT EXISTS files_workspace_idx ON files(workspace_id);
CREATE INDEX IF NOT EXISTS files_user_idx      ON files(user_id);

-- Add share columns to tables that pre-date them
ALTER TABLE files ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS share_mode  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS files_share_token_idx ON files(share_token) WHERE share_token IS NOT NULL;

-- Stores the full canvas state as a JSONB snapshot per file.
-- Overwritten on each autosave; no history kept server-side.
CREATE TABLE IF NOT EXISTS canvas_snapshots (
  file_id    TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  objects    JSONB   NOT NULL DEFAULT '{}',
  bg_color   TEXT    NOT NULL DEFAULT '#F7F7F8',
  grid_style TEXT    NOT NULL DEFAULT 'dots',
  updated_at BIGINT  NOT NULL
);
-- Add grid_style to existing tables that pre-date this column
ALTER TABLE canvas_snapshots ADD COLUMN IF NOT EXISTS grid_style TEXT NOT NULL DEFAULT 'dots';
