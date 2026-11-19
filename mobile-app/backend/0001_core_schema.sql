-- One Call staff app extension for the EXISTING website D1 database.
-- Customers do NOT have app accounts; customer details remain in existing bookings/customers tables.
-- Apply only after backing up and inspecting the live D1 schema.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mobile_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 role TEXT NOT NULL CHECK (role IN ('cleaner','upholstery_cleaner','handyman','manager','owner')),
 account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended','deletion_requested','deactivated')),
 first_name TEXT, last_name TEXT, phone TEXT, address TEXT, avatar_url TEXT,
 auth_provider TEXT NOT NULL DEFAULT 'pending', auth_subject TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deactivated_at TEXT,
 UNIQUE(auth_provider, auth_subject)
);

CREATE TABLE IF NOT EXISTS worker_booking_assignments (
 booking_id TEXT NOT NULL REFERENCES bookings(id), worker_id TEXT NOT NULL REFERENCES mobile_accounts(id),
 assignment_status TEXT NOT NULL DEFAULT 'assigned' CHECK (assignment_status IN ('invited','assigned','accepted','declined','completed')),
 assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (booking_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker ON worker_booking_assignments(worker_id, assignment_status);

CREATE TABLE IF NOT EXISTS worker_finance_ledger (
 id TEXT PRIMARY KEY, worker_id TEXT NOT NULL REFERENCES mobile_accounts(id), booking_id TEXT REFERENCES bookings(id),
 entry_type TEXT NOT NULL, direction TEXT NOT NULL CHECK (direction IN ('company_owes_worker','worker_owes_company','payment_to_worker','payment_from_worker','company_fee','adjustment')),
 amount_cents INTEGER NOT NULL CHECK (amount_cents > 0), currency TEXT NOT NULL DEFAULT 'eur',
 entry_status TEXT NOT NULL DEFAULT 'posted' CHECK (entry_status IN ('pending','posted','reversed')),
 external_reference TEXT, description TEXT, created_by TEXT REFERENCES mobile_accounts(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reverses_entry_id TEXT REFERENCES worker_finance_ledger(id)
);
CREATE INDEX IF NOT EXISTS idx_worker_ledger_worker_date ON worker_finance_ledger(worker_id, created_at);

CREATE TABLE IF NOT EXISTS mobile_payment_transactions (
 id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id), worker_id TEXT REFERENCES mobile_accounts(id),
 stripe_payment_intent_id TEXT UNIQUE, stripe_checkout_session_id TEXT UNIQUE, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
 currency TEXT NOT NULL DEFAULT 'eur', payment_status TEXT NOT NULL, transaction_type TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES mobile_accounts(id),
 request_status TEXT NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending','approved','rejected')),
 requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT REFERENCES mobile_accounts(id), reviewed_at TEXT, manager_note TEXT
);

CREATE TABLE IF NOT EXISTS mobile_audit_log (
 id TEXT PRIMARY KEY, actor_account_id TEXT REFERENCES mobile_accounts(id), action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Customer accounts/registration are intentionally excluded from this app.
-- Role checks must be enforced server-side using a verified session.
-- Owner is the highest privilege and cannot be assigned through public registration.
-- Worker balances are derived from posted ledger entries; never edit historical entries.