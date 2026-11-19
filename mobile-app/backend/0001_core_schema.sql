-- Initial target schema for Cloudflare D1.
-- Apply only after comparing with the live D1 schema; do not run blindly on production.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer','worker','manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deletion_requested','deactivated')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deactivated_at TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES app_users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  service_code TEXT NOT NULL,
  service_description TEXT,
  scheduled_at TEXT,
  completed_at TEXT,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_checkout_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_completed
ON bookings(customer_id, status, completed_at);

CREATE TABLE IF NOT EXISTS booking_assignments (
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  worker_id TEXT NOT NULL REFERENCES app_users(id),
  assignment_status TEXT NOT NULL DEFAULT 'assigned' CHECK (assignment_status IN ('invited','assigned','accepted','declined','completed')),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_worker_status
ON booking_assignments(worker_id, assignment_status);

-- Append-only accounting journal. Store positive amounts and explicit debit/credit direction.
CREATE TABLE IF NOT EXISTS finance_ledger (
  id TEXT PRIMARY KEY,
  worker_id TEXT REFERENCES app_users(id),
  booking_id TEXT REFERENCES bookings(id),
  entry_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('company_owes_worker','worker_owes_company','payment_to_worker','payment_from_worker','company_fee','adjustment')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('pending','posted','reversed')),
  external_reference TEXT,
  description TEXT,
  created_by TEXT REFERENCES app_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reverses_entry_id TEXT REFERENCES finance_ledger(id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_worker_date
ON finance_ledger(worker_id, created_at);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  worker_id TEXT REFERENCES app_users(id),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  payment_status TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT REFERENCES app_users(id),
  reviewed_at TEXT,
  manager_note TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Discount eligibility query:
-- SELECT EXISTS (
--   SELECT 1 FROM bookings
--   WHERE customer_id = ? AND status = 'completed'
--     AND completed_at >= datetime('now', '-30 days')
--     AND completed_at <= datetime('now')
-- );
-- Execute on the server immediately before creating the checkout session.
-- Never accept a client-supplied discount or final amount as authoritative.
