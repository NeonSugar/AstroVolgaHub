CREATE TABLE IF NOT EXISTS administrators (
  id UUID PRIMARY KEY,
  login VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS administrators_active_login_idx
  ON administrators (login)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS callback_requests_admin_status_created_idx
  ON callback_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS callback_requests_admin_agent_created_idx
  ON callback_requests (agent_id, created_at DESC);
