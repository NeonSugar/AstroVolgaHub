ALTER TABLE callback_requests
  DROP CONSTRAINT IF EXISTS callback_requests_status_check;

ALTER TABLE callback_requests
  ALTER COLUMN status TYPE VARCHAR(20);

UPDATE callback_requests
SET status = CASE
  WHEN status = 'contacted' THEN 'in_progress'
  WHEN status = 'closed' THEN 'processed'
  ELSE status
END;

ALTER TABLE callback_requests
  ADD COLUMN IF NOT EXISTS status_details JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE callback_requests
  ADD CONSTRAINT callback_requests_status_check
  CHECK (status IN ('new', 'in_progress', 'processed', 'rejected'));
