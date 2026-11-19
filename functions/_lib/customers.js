export async function upsertCustomer(db, customer, now) {
  const email = customer.email.trim().toLowerCase();
  await db.prepare(`INSERT INTO customers
    (id,email,name,phone,address,town,notes,stripe_customer_id,bookings_count,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,1,?,?)
    ON CONFLICT(email) DO UPDATE SET
      name=excluded.name,
      phone=excluded.phone,
      address=excluded.address,
      town=excluded.town,
      notes=excluded.notes,
      stripe_customer_id=COALESCE(excluded.stripe_customer_id,customers.stripe_customer_id),
      bookings_count=customers.bookings_count+1,
      updated_at=excluded.updated_at`)
    .bind(email,email,customer.name,customer.phone,customer.address,customer.town,customer.notes||'',customer.stripeCustomerId||null,now,now)
    .run();
}


/**
 * Register/update customer contact details before payment without counting
 * an abandoned checkout as a completed booking. The paid webhook or cash
 * booking handler increments bookings_count separately.
 */
export async function ensureCustomer(db, customer, now) {
  const email = String(customer.email || '').trim().toLowerCase();
  await db.prepare(`INSERT INTO customers
    (id,email,name,phone,address,town,notes,stripe_customer_id,bookings_count,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,NULL,0,?,?)
    ON CONFLICT(email) DO UPDATE SET
      name=excluded.name,
      phone=excluded.phone,
      address=excluded.address,
      town=excluded.town,
      notes=excluded.notes,
      updated_at=excluded.updated_at`)
    .bind(email,email,customer.name,customer.phone,customer.address,customer.town,customer.notes||'',now,now)
    .run();
  return email;
}
