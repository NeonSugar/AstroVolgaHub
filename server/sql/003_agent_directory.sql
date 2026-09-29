ALTER TABLE agents
  ALTER COLUMN login DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS locality_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS district_slug VARCHAR(80),
  ADD COLUMN IF NOT EXISTS district_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS is_primary_city BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS district_order INTEGER,
  ADD COLUMN IF NOT EXISTS locality_order INTEGER,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS note VARCHAR(240),
  ADD COLUMN IF NOT EXISTS map_url VARCHAR(500);

UPDATE agents
SET locality_name = city_slug
WHERE locality_name IS NULL;

UPDATE agents
SET locality_name = CASE city_slug
      WHEN 'melitopol' THEN 'Мелитополь'
      WHEN 'berdyansk' THEN 'Бердянск'
      WHEN 'energodar' THEN 'Энергодар'
      WHEN 'tokmak' THEN 'Токмак'
      WHEN 'vasilevka' THEN 'Васильевка'
      WHEN 'kamenka' THEN 'Каменка-Днепровская'
      WHEN 'primorsk' THEN 'Приморск'
      WHEN 'veseloe' THEN 'Весёлое'
      WHEN 'znamenka' THEN 'Великая Знаменка'
    END,
    is_primary_city = TRUE,
    locality_order = CASE city_slug
      WHEN 'melitopol' THEN 0
      WHEN 'berdyansk' THEN 1
      WHEN 'energodar' THEN 2
      WHEN 'tokmak' THEN 3
      WHEN 'vasilevka' THEN 4
      WHEN 'kamenka' THEN 5
      WHEN 'primorsk' THEN 6
      WHEN 'veseloe' THEN 7
      WHEN 'znamenka' THEN 8
    END
WHERE city_slug IN (
  'melitopol', 'berdyansk', 'energodar', 'tokmak', 'vasilevka',
  'kamenka', 'primorsk', 'veseloe', 'znamenka'
);

UPDATE agents
SET is_primary_city = FALSE
WHERE is_primary_city IS NULL;

DROP INDEX IF EXISTS agents_public_city_idx;

CREATE INDEX IF NOT EXISTS agents_public_locality_idx
  ON agents (city_slug, sort_order, address)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS agents_public_directory_idx
  ON agents (is_primary_city DESC, district_order, locality_order, sort_order)
  WHERE is_active = TRUE;
