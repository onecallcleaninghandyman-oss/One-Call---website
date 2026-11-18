CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL,
 town TEXT NOT NULL,
 notes TEXT,
 bookings_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

ALTER TABLE bookings ADD COLUMN customer_id TEXT REFERENCES customers(id);

INSERT OR IGNORE INTO customers
 (id,email,name,phone,address,town,notes,bookings_count,created_at,updated_at)
SELECT
 lower(trim(b.customer_email)),
 lower(trim(b.customer_email)),
 (SELECT x.customer_name FROM bookings x WHERE lower(trim(x.customer_email))=lower(trim(b.customer_email)) ORDER BY x.created_at DESC LIMIT 1),
 (SELECT x.customer_phone FROM bookings x WHERE lower(trim(x.customer_email))=lower(trim(b.customer_email)) ORDER BY x.created_at DESC LIMIT 1),
 (SELECT x.customer_address FROM bookings x WHERE lower(trim(x.customer_email))=lower(trim(b.customer_email)) ORDER BY x.created_at DESC LIMIT 1),
 (SELECT x.customer_town FROM bookings x WHERE lower(trim(x.customer_email))=lower(trim(b.customer_email)) ORDER BY x.created_at DESC LIMIT 1),
 (SELECT x.customer_notes FROM bookings x WHERE lower(trim(x.customer_email))=lower(trim(b.customer_email)) ORDER BY x.created_at DESC LIMIT 1),
 count(*), min(b.created_at), max(b.updated_at)
FROM bookings b
WHERE trim(coalesce(b.customer_email,''))<>''
GROUP BY lower(trim(b.customer_email));

UPDATE bookings
SET customer_id=lower(trim(customer_email))
WHERE trim(coalesce(customer_email,''))<>'';
