import { json, bookingIdIsValid } from '../_lib/booking.js';
export async function onRequestGet({request,env}) {
  try {
    if(!env.BOOKINGS_DB||!env.STRIPE_SECRET_KEY) return json({error:'Booking status service is not configured.'},503);
    const url=new URL(request.url), sessionId=url.searchParams.get('session_id')||'', bookingId=url.searchParams.get('booking_id')||'';
    if(!sessionId.startsWith('cs_')||!bookingIdIsValid(bookingId)) return json({error:'Invalid booking reference.'},400);
    const row=await env.BOOKINGS_DB.prepare('SELECT id,stripe_session_id,payment_status,total_cents,currency FROM bookings WHERE id=?').bind(bookingId).first();
    if(!row||row.stripe_session_id!==sessionId) return json({error:'Booking not found.'},404);
    const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-10-28.endive'}});
    const session=await response.json();
    if(!response.ok) return json({error:'Unable to verify payment with Stripe.'},502);
    const paid=session.payment_status==='paid'&&session.status==='complete'&&session.currency==='eur'&&session.amount_total===row.total_cents;
    if(paid&&row.payment_status!=='paid') await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='paid',updated_at=? WHERE id=? AND stripe_session_id=?").bind(new Date().toISOString(),bookingId,sessionId).run();
    const status=paid?'paid':row.payment_status==='expired'||session.status==='expired'?'expired':row.payment_status==='payment_failed'?'payment_failed':session.status==='open'?'open':'processing';
    return json({status,bookingId});
  } catch(error) { console.error('Booking status error',error); return json({error:'Unable to verify booking status.'},500); }
}