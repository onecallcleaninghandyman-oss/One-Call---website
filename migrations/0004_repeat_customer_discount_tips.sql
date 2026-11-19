-- Repeat-customer loyalty discount, itemised tips, and completion tracking.
-- Apply to the existing BOOKINGS_DB D1 database before deploying the updated website code.
ALTER TABLE bookings ADD COLUMN job_status TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (job_status IN ('scheduled','completed','cancelled'));
ALTER TABLE bookings ADD COLUMN completed_at TEXT;
ALTER TABLE bookings ADD COLUMN subtotal_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0
  CHECK (discount_percent BETWEEN 0 AND 15);
ALTER TABLE bookings ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN tip_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN service_items_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_bookings_repeat_customer
  ON bookings(customer_id, job_status, completed_at);
CREATE INDEX IF NOT EXISTS idx_bookings_repeat_email
  ON bookings(customer_email, job_status, completed_at);
