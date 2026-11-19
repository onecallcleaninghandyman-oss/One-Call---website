import { json } from '../../_lib/booking.js';

// Public, non-sensitive readiness probe for the mobile client.
// It deliberately exposes no account, booking, customer or payment data.
export async function onRequestGet({ env }) {
  if (!env.BOOKINGS_DB) {
    return json({ ok: false, service: 'mobile-api', database: 'not_configured' }, 503);
  }
  try {
    await env.BOOKINGS_DB.prepare('SELECT 1 AS ready').first();
    return json({ ok: true, service: 'mobile-api', database: 'ready' });
  } catch (error) {
    console.error('Mobile API readiness check failed', error);
    return json({ ok: false, service: 'mobile-api', database: 'unavailable' }, 503);
  }
}
