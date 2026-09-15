CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY,
  login VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  city_slug VARCHAR(80) NOT NULL,
  address VARCHAR(240) NOT NULL,
  address_key VARCHAR(240) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  cabinet_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_slug, address_key, phone)
);

CREATE INDEX IF NOT EXISTS agents_public_city_idx
  ON agents (city_slug)
  WHERE cabinet_enabled = TRUE;

CREATE TABLE IF NOT EXISTS callback_requests (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  customer_name VARCHAR(80) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  consent_version VARCHAR(32) NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_path VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'processed', 'rejected')),
  status_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS callback_requests_agent_created_idx
  ON callback_requests (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS callback_requests_agent_status_idx
  ON callback_requests (agent_id, status);
