ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS merged_into_agent_id UUID REFERENCES agents(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS agent_phones (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, phone),
  CHECK (phone ~ '^[0-9]{10,15}$')
);

CREATE INDEX IF NOT EXISTS agent_phones_phone_idx ON agent_phones (phone);
CREATE INDEX IF NOT EXISTS agents_merged_into_idx
  ON agents (merged_into_agent_id)
  WHERE merged_into_agent_id IS NOT NULL;

-- Preserve every legacy contact before consolidating duplicate agent rows.
INSERT INTO agent_phones (agent_id, phone, sort_order)
SELECT id, phone, 0
FROM agents
WHERE phone ~ '^[0-9]{10,15}$'
ON CONFLICT (agent_id, phone) DO NOTHING;

-- In one locality, one normalized address represents one agent. Records marked
-- "Без офиса" deliberately remain separate because the address is not identity.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY city_slug, address_key
           ORDER BY cabinet_enabled DESC,
                    (login IS NOT NULL) DESC,
                    is_active DESC,
                    created_at,
                    id
         ) AS canonical_id
  FROM agents
  WHERE merged_into_agent_id IS NULL
    AND address_key <> 'безофиса'
), merge_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE id <> canonical_id
)
INSERT INTO agent_phones (agent_id, phone, sort_order)
SELECT merge_map.canonical_id,
       source.phone,
       ROW_NUMBER() OVER (PARTITION BY merge_map.canonical_id ORDER BY source.sort_order, source.phone)::INTEGER
FROM merge_map
JOIN agent_phones source ON source.agent_id = merge_map.duplicate_id
ON CONFLICT (agent_id, phone) DO NOTHING;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY city_slug, address_key
           ORDER BY cabinet_enabled DESC,
                    (login IS NOT NULL) DESC,
                    is_active DESC,
                    created_at,
                    id
         ) AS canonical_id
  FROM agents
  WHERE merged_into_agent_id IS NULL
    AND address_key <> 'безофиса'
), merge_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE id <> canonical_id
)
UPDATE callback_requests requests
SET agent_id = merge_map.canonical_id,
    updated_at = NOW()
FROM merge_map
WHERE requests.agent_id = merge_map.duplicate_id;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY city_slug, address_key
           ORDER BY cabinet_enabled DESC,
                    (login IS NOT NULL) DESC,
                    is_active DESC,
                    created_at,
                    id
         ) AS canonical_id
  FROM agents
  WHERE merged_into_agent_id IS NULL
    AND address_key <> 'безофиса'
), merge_map AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE id <> canonical_id
)
UPDATE agents duplicate
SET merged_into_agent_id = merge_map.canonical_id,
    login = NULL,
    password_hash = NULL,
    cabinet_enabled = FALSE,
    is_active = FALSE,
    updated_at = NOW()
FROM merge_map
WHERE duplicate.id = merge_map.duplicate_id;

UPDATE agents
SET login = NULL,
    password_hash = NULL,
    cabinet_enabled = FALSE,
    is_active = FALSE,
    updated_at = NOW()
WHERE merged_into_agent_id IS NOT NULL
  AND (login IS NOT NULL OR password_hash IS NOT NULL OR cabinet_enabled = TRUE OR is_active = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS agents_unique_office_address_idx
  ON agents (city_slug, address_key)
  WHERE address_key <> 'безофиса' AND merged_into_agent_id IS NULL;

-- The legacy agents.phone column is deliberately retained as a stable fallback.
-- All current reads use agent_phones, so changing it is unnecessary and could
-- collide with an archived duplicate protected by the old unique constraint.
