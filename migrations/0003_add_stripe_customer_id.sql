ALTER TABLE customers ADD COLUMN stripe_customer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON customers(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
