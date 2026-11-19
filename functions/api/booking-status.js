import { json, bookingIdIsValid } from '../_lib/booking.js';

export async function onRequestGet({request,env}) {
  try {
    if(!env.BOOKINGS_DB||!env.STRIPE_SECRET_KEY) return json({error:'Booking status service is not configured.'},503);
    const url=new URL(request.url), sessionId=url.searchParams.get('session_id')||'', bookingId=url.searchParams.get('booking_id')||'';
    if(!sessionId.startsWith('cs_')||!bookingIdIsValid(bookingId)) return json({error:'Invalid booking reference.'},400);

    // Always verify the Checkout Session directly with Stripe before changing booking data.
    const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-10-28.endive'}});
    const session=await response.json();
    if(!response.ok) return json({error:'Unable to verify payment with Stripe.'},502);
    if(session.metadata?.booking_id!==bookingId) return json({error:'Booking reference does not match this payment.'},404);

    const paid=session.payment_status==='paid'&&session.status==='complete'&&session.currency==='eur'&&Number.isInteger(session.amount_total);
    let row=await env.BOOKINGS_DB.prepare('SELECT id,stripe_session_id,payment_status,total_cents,currency FROM bookings WHERE id=?').bind(bookingId).first();

    // Recovery path: an older deployment or a webhook environment mismatch may leave
    // a genuinely paid Stripe session without its pending D1 booking row. Rebuild it
    // only from Stripe-verified session metadata, never from browser-supplied details.
    if(!row&&paid) {
      const m=session.metadata||{};
      const customer={
        name:m.customer_name||session.customer_details?.name||'',
        email:m.customer_email||session.customer_details?.email||session.customer_email||'',
        phone:m.customer_phone||session.customer_details?.phone||'',
        address:m.customer_address||'',
        town:m.customer_town||'',
        notes:m.customer_notes||''
      };
      if(!customer.email) return json({error:'Paid payment is missing customer email.'},422);
      const now=new Date().toISOString();
      const subtotalCents=Number(m.subtotal_cents||session.amount_subtotal||session.amount_total||0);
      const discountPercent=Number(m.discount_percent||0);
      const discountCents=Number(m.discount_cents||0);
      const tipCents=Number(m.tip_cents||0);
      let serviceItems=[];
      try { const parsed=JSON.parse(m.service_items_json||'[]'); if(Array.isArray(parsed)) serviceItems=parsed; } catch {}
      const pricing={subtotalCents,discountPercent,discountCents,tipCents,totalCents:session.amount_total,serviceItems};
      const bookingData={date:m.booking_date||'',timeSlot:m.booking_time||'',service:m.service||'',description:m.description||'',client:customer,pricing};
      await env.BOOKINGS_DB.prepare(`INSERT INTO bookings
        (id,service,description,booking_date,booking_time,customer_name,customer_email,customer_phone,customer_address,customer_town,customer_notes,total_cents,subtotal_cents,discount_percent,discount_cents,tip_cents,service_items_json,currency,payment_method,payment_status,stripe_session_id,booking_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'eur','stripe','paid',?,?,?,?)
        ON CONFLICT(id) DO NOTHING`)
        .bind(bookingId,m.service||'Online booking',m.description||'',m.booking_date||'',m.booking_time||'',customer.name,customer.email,customer.phone,customer.address,customer.town,customer.notes,session.amount_total,subtotalCents,discountPercent,discountCents,tipCents,JSON.stringify(serviceItems),session.id,JSON.stringify(bookingData),now,now).run();
      row=await env.BOOKINGS_DB.prepare('SELECT id,stripe_session_id,payment_status,total_cents,currency FROM bookings WHERE id=?').bind(bookingId).first();
    }

    if(!row||row.stripe_session_id!==sessionId) return json({error:'Booking not found for this payment.'},404);
    if(row.total_cents!==session.amount_total||row.currency!=='eur') return json({error:'Payment amount does not match the booking.'},409);
    if(paid&&row.payment_status!=='paid') await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='paid',updated_at=? WHERE id=? AND stripe_session_id=?").bind(new Date().toISOString(),bookingId,sessionId).run();
    const status=paid?'paid':row.payment_status==='expired'||session.status==='expired'?'expired':row.payment_status==='payment_failed'?'payment_failed':session.status==='open'?'open':'processing';
    return json({status,bookingId});
  } catch(error) { console.error('Booking status error',error); return json({error:'Unable to verify booking status.'},500); }
}
