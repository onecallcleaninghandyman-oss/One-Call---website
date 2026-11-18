import { validateBooking, json, bookingIdIsValid } from '../_lib/booking.js';

export async function onRequestPost({request,env}) {
  let bookingId='';
  try {
    if(!env.STRIPE_SECRET_KEY) return json({error:'Stripe is not configured: STRIPE_SECRET_KEY is missing.'},500);
    if(!env.BOOKINGS_DB) return json({error:'Booking database is not configured. Add the Cloudflare D1 binding BOOKINGS_DB before accepting online bookings.'},503);
    const body=await request.json(), booking=body.booking||{};
    const {customer,quote}=validateBooking(booking);
    bookingId=String(body.bookingId||'');
    if(!bookingIdIsValid(bookingId)) return json({error:'Booking request expired. Please click Pay Online again.'},400);

    const origin=new URL(request.url).origin, params=new URLSearchParams();
    params.set('mode','payment');
    params.set('ui_mode','elements');
    params.set('locale','en');
    params.set('integration_identifier','custom_embedded_web_0002');
    params.set('return_url',`${origin}/?payment=complete&session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`);
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
    params.set('metadata[customer_email]',customer.email.slice(0,200));
    params.set('metadata[customer_phone]',customer.phone.slice(0,200));
    params.set('metadata[customer_address]',customer.address.slice(0,200));
    params.set('metadata[customer_notes]',(customer.notes||'').slice(0,450));
    params.set('metadata[customer_town]',customer.town.slice(0,200));
    params.set('payment_intent_data[metadata][booking_id]',bookingId);
    // Request Stripe's automatic receipt at the booking email address.
    params.set('payment_intent_data[receipt_email]',customer.email);

    // Create the Stripe Customer as part of the completed Checkout only.
    // No customer lookup or customer record is created before payment.
    params.set('customer_creation','always');
    params.set('customer_email',customer.email);

    const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Stripe-Version':'2026-10-28.endive','Idempotency-Key':`booking-${bookingId}`},
      body:params
    });
    const session=await stripeResponse.json();
    if(!stripeResponse.ok) {
      console.error('Stripe API error',session);
      return json({error:session.error?.message||'Stripe could not create the payment session.'},502);
    }
    if(!session.client_secret) return json({error:'Stripe did not return a Checkout client secret. Check the Stripe account and API configuration.'},502);
    // Do not write booking or customer data to D1 before payment.
    // stripe-webhook.js creates the booking and customer only after Stripe confirms payment.
    return json({client_secret:session.client_secret,bookingId});
  } catch(error) {
    console.error('Checkout session error',error);
    return json({error:error.message||'Unable to start payment. Please try again.'},400);
  }
}