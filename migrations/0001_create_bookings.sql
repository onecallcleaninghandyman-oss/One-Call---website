CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY,
 stripe_session_id TEXT UNIQUE,
 service TEXT NOT NULL,
 description TEXT NOT NULL,
 booking_date TEXT NOT NULL,
 booking_time TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL,
 customer_phone TEXT NOT NULL,
 customer_address TEXT NOT NULL,
 customer_town TEXT NOT NULL,
 customer_notes TEXT,
 total_cents INTEGER NOT NULL CHECK(total_cents > 0),
 currency TEXT NOT NULL DEFAULT 'eur',
 payment_method TEXT NOT NULL CHECK(payment_method IN ('stripe','cash')),
 payment_status TEXT NOT NULL,
 booking_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(payment_status);
CREATE TABLE IF NOT EXISTS stripe_events (
 id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 created_at TEXT NOT NULL
);