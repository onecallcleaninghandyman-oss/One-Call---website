import { validateBooking, json, bookingIdIsValid } from '../_lib/booking.js';
import { upsertCustomer } from '../_lib/customers.js';

export async function onRequestPost({request,env}) {
  let bookingId='';
  try {
    if(!env.STRIPE_SECRET_KEY) return json({error:'Stripe is not configured: STRIPE_SECRET_KEY is missing.'},500);
    if(!env.BOOKINGS_DB) return json({error:'Booking database is not configured. Add the Cloudflare D1 binding BOOKINGS_DB before accepting online bookings.'},503);
    const body=await request.json(), booking=body.booking||{};
    const {customer,quote}=validateBooking(booking);
    bookingId=String(body.bookingId||'');
    if(!bookingIdIsValid(bookingId)) return json({error:'Booking request expired. Please click Pay Online again.'},400);
    const now=new Date().toISOString();
    const bookingJson=JSON.stringify({...booking,client:customer});
    const saved=await env.BOOKINGS_DB.prepare(`INSERT INTO bookings
      (id,service,description,booking_date,booking_time,customer_name,customer_email,customer_phone,customer_address,customer_town,customer_notes,total_cents,currency,payment_method,payment_status,booking_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'eur','stripe','pending_payment',?,?,?)
      ON CONFLICT(id) DO NOTHING`)
      .bind(bookingId,quote.title,quote.description,booking.date,booking.timeSlot,customer.name,customer.email,customer.phone,customer.address,customer.town,customer.notes,quote.amount,bookingJson,now,now).run();
    if(saved.meta?.changes===1) {
      await upsertCustomer(env.BOOKINGS_DB,customer,now);
      await env.BOOKINGS_DB.prepare('UPDATE bookings SET customer_id=? WHERE id=?').bind(customer.email.trim().toLowerCase(),bookingId).run();
    }

    const origin=new URL(request.url).origin, params=new URLSearchParams();
    params.set('mode','payment');
    params.set('ui_mode','elements');
    params.set('locale','en');
    params.set('integration_identifier','custom_embedded_web_0002');
    params.set('return_url',`${origin}/?payment=complete&session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`);
    params.set('customer_email',customer.email);
    params.set('line_items[0][quantity]','1');
    params.set('line_items[0][price_data][currency]','eur');
    params.set('line_items[0][price_data][unit_amount]',String(quote.amount));
    params.set('line_items[0][price_data][product_data][name]',quote.title);
    params.set('line_items[0][price_data][product_data][description]',quote.description.slice(0,300));
    params.set('metadata[booking_id]',bookingId);
    params.set('metadata[booking_date]',booking.date);
    params.set('metadata[booking_time]',booking.timeSlot.slice(0,200));
    params.set('metadata[service]',quote.title);
    params.set('metadata[description]',quote.description.slice(0,500));
    params.set('metadata[customer_name]',customer.name.slice(0,200));
    params.set('metadata[customer_phone]',customer.phone.slice(0,200));
    params.set('metadata[customer_town]',customer.town.slice(0,200));
    params.set('payment_intent_data[metadata][booking_id]',bookingId);

    const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Stripe-Version':'2026-10-28.endive','Idempotency-Key':`booking-${bookingId}`},
      body:params
    });
    const session=await stripeResponse.json();
    if(!stripeResponse.ok) {
      console.error('Stripe API error',session);
      await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='payment_setup_failed',updated_at=? WHERE id=? AND payment_status='pending_payment'").bind(new Date().toISOString(),bookingId).run();
      return json({error:session.error?.message||'Stripe could not create the payment session.'},502);
    }
    await env.BOOKINGS_DB.prepare('UPDATE bookings SET stripe_session_id=?,updated_at=? WHERE id=?').bind(session.id,new Date().toISOString(),bookingId).run();
    if(!session.client_secret) return json({error:'Stripe did not return a Checkout client secret. Check the Stripe account and API configuration.'},502);
    return json({client_secret:session.client_secret,bookingId});
  } catch(error) {
    console.error('Checkout session error',error);
    return json({error:error.message||'Unable to start payment. Please try again.'},400);
  }
}