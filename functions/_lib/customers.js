export async function upsertCustomer(db, customer, now) {
  const email = customer.email.trim().toLowerCase();
  await db.prepare(`INSERT INTO customers
    (id,email,name,phone,address,town,notes,bookings_count,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,1,?,?)
    ON CONFLICT(email) DO UPDATE SET
      name=excluded.name,
      phone=excluded.phone,
      address=excluded.address,
      town=excluded.town,
      notes=excluded.notes,
      bookings_count=customers.bookings_count+1,
      updated_at=excluded.updated_at`)
    .bind(email,email,customer.name,customer.phone,customer.address,customer.town,customer.notes||'',now,now)
    .run();
}
