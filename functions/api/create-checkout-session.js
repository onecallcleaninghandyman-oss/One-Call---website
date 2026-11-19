import { validateBooking, json, bookingIdIsValid, calculateRepeatCustomerPricing } from '../_lib/booking.js';
import { ensureCustomer } from '../_lib/customers.js';

const euro = cents => `€${(cents / 100).toFixed(2)}`;

export async function onRequestPost({request,env}) {
  let bookingId='';
  try {
    if(!env.STRIPE_SECRET_KEY) return json({error:'Stripe is not configured: STRIPE_SECRET_KEY is missing.'},500);
    if(!env.BOOKINGS_DB) return json({error:'Booking database is not configured. Add the Cloudflare D1 binding BOOKINGS_DB before accepting online bookings.'},503);
    const body=await request.json(), booking=body.booking||{};
    const {customer,quote}=validateBooking(booking);
    bookingId=String(body.bookingId||'');
    if(!bookingIdIsValid(bookingId)) return json({error:'Booking request expired. Please click Pay Online again.'},400);

    const tipCents=body.tipCents===undefined?0:Number(body.tipCents);
    if(!Number.isInteger(tipCents)||tipCents<0||tipCents>100000) return json({error:'Tip must be between €0.00 and €1,000.00.'},400);

    const now=new Date().toISOString();
    // Save the customer before payment so repeat-customer identity is available.
    // This does not increment bookings_count; abandoned checkouts are not bookings.
    await ensureCustomer(env.BOOKINGS_DB,customer,now);
    const pricing=await calculateRepeatCustomerPricing(env.BOOKINGS_DB,customer,quote,now,tipCents);

    const origin=new URL(request.url).origin, params=new URLSearchParams();
    params.set('mode','payment');
    params.set('ui_mode','elements');
    params.set('locale','en');
    params.set('integration_identifier','custom_embedded_web_0002');
    params.set('return_url',`${origin}/?payment=complete&session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`);

    // Show each selected service/add-on as its own Stripe line item. The
    // server-calculated loyalty reduction is reflected in the line amount and
    // item description; the original amount and discount are also in metadata.
    let lineIndex=0;
    for(const item of pricing.serviceItems){
      const discountText=item.discountCents>0
        ? `Original ${euro(item.amountCents)}; 10% repeat-customer discount -${euro(item.discountCents)}.`
        : `Price ${euro(item.amountCents)}.`;
      const description=`${item.description||item.name}. ${discountText}`.slice(0,500);
      params.set(`line_items[${lineIndex}][quantity]`,'1');
      params.set(`line_items[${lineIndex}][price_data][currency]`,'eur');
      params.set(`line_items[${lineIndex}][price_data][unit_amount]`,String(item.finalAmountCents));
      params.set(`line_items[${lineIndex}][price_data][product_data][name]`,item.name.slice(0,200));
      params.set(`line_items[${lineIndex}][price_data][product_data][description]`,description);
      lineIndex++;
    }
    if(pricing.tipCents>0){
      params.set(`line_items[${lineIndex}][quantity]`,'1');
      params.set(`line_items[${lineIndex}][price_data][currency]`,'eur');
      params.set(`line_items[${lineIndex}][price_data][unit_amount]`,String(pricing.tipCents));
      params.set(`line_items[${lineIndex}][price_data][product_data][name]`,'Customer Tip');
      params.set(`line_items[${lineIndex}][price_data][product_data][description]`,'Optional tip added by the customer.');
    }

    const compactItems=JSON.stringify(pricing.serviceItems.map(item=>[
      item.name,item.amountCents,item.discountCents,item.finalAmountCents
    ]));
    if(compactItems.length>500) return json({error:'This booking has too many selected items to prepare a payment summary. Please contact us.'},400);

    const metadata={
      booking_id:bookingId,
      booking_date:booking.date,
      booking_time:booking.timeSlot,
      service:quote.title,
      description:quote.description,
      customer_name:customer.name,
      customer_email:customer.email,
      customer_phone:customer.phone,
      customer_address:customer.address,
      customer_notes:customer.notes||'',
      customer_town:customer.town,
      subtotal_cents:String(pricing.subtotalCents),
      discount_percent:String(pricing.discountPercent),
      discount_cents:String(pricing.discountCents),
      tip_cents:String(pricing.tipCents),
      final_total_cents:String(pricing.totalCents),
      service_items_json:compactItems
    };
    for(const [key,value] of Object.entries(metadata)) params.set(`metadata[${key}]`,String(value).slice(0,500));
    params.set('payment_intent_data[description]',`One Call booking: ${quote.title}; loyalty discount ${pricing.discountPercent}%; tip ${euro(pricing.tipCents)}`.slice(0,500));
    for(const [key,value] of Object.entries(metadata)) params.set(`payment_intent_data[metadata][${key}]`,String(value).slice(0,500));
    params.set('payment_intent_data[receipt_email]',customer.email);
    params.set('customer_creation','always');
    params.set('customer_email',customer.email);

    const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type':'application/x-www-form-urlencoded',
        'Stripe-Version':'2026-10-28.endive',
        'Idempotency-Key':`booking-${bookingId}-tip-${tipCents}-discount-${pricing.discountCents}`
      },
      body:params
    });
    const session=await stripeResponse.json();
    if(!stripeResponse.ok) {
      console.error('Stripe API error',session);
      return json({error:session.error?.message||'Stripe could not create the payment session.'},502);
    }
    if(!session.client_secret) return json({error:'Stripe did not return a Checkout client secret. Check the Stripe account and API configuration.'},502);
    return json({
      client_secret:session.client_secret,
      bookingId,
      pricing:{
        subtotalCents:pricing.subtotalCents,
        discountPercent:pricing.discountPercent,
        discountCents:pricing.discountCents,
        tipCents:pricing.tipCents,
        totalCents:pricing.totalCents,
        hasRepeatCustomerDiscount:pricing.discountPercent===10
      }
    });
  } catch(error) {
    console.error('Checkout session error',error);
    return json({error:error.message||'Unable to start payment. Please try again.'},400);
  }
}
