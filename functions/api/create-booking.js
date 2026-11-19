import { validateBooking, json, bookingIdIsValid, calculateRepeatCustomerPricing } from '../_lib/booking.js';
import { ensureCustomer, upsertCustomer } from '../_lib/customers.js';

export async function onRequestPost({request,env}) {
  try {
    if(!env.BOOKINGS_DB) return json({error:'Booking database is not configured. Add the Cloudflare D1 binding BOOKINGS_DB.'},503);
    const body=await request.json(), booking=body.booking||{};
    const {customer,quote}=validateBooking(booking), id=String(body.bookingId||'');
    if(!bookingIdIsValid(id)) return json({error:'Booking request expired. Please try again.'},400);
    const now=new Date().toISOString();
    await ensureCustomer(env.BOOKINGS_DB,customer,now);
    const pricing=await calculateRepeatCustomerPricing(env.BOOKINGS_DB,customer,quote,now,0);
    const bookingData={
      ...booking,
      client:customer,
      jobStatus:'scheduled',
      completedAt:null,
      pricing:{
        subtotalCents:pricing.subtotalCents,
        discountPercent:pricing.discountPercent,
        discountCents:pricing.discountCents,
        tipCents:0,
        totalCents:pricing.totalCents,
        serviceItems:pricing.serviceItems
      }
    };
    const saved=await env.BOOKINGS_DB.prepare(`INSERT INTO bookings
      (id,service,description,booking_date,booking_time,customer_name,customer_email,customer_phone,customer_address,customer_town,customer_notes,total_cents,currency,payment_method,payment_status,booking_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'eur','cash','cash_due',?,?,?)`)
      .bind(
        id,quote.title,quote.description,booking.date,booking.timeSlot,
        customer.name,customer.email,customer.phone,customer.address,customer.town,customer.notes,
        pricing.totalCents,JSON.stringify(bookingData),now,now
      ).run();
    if(saved.meta?.changes===1) {
      await upsertCustomer(env.BOOKINGS_DB,customer,now);
      await env.BOOKINGS_DB.prepare('UPDATE bookings SET customer_id=? WHERE id=?').bind(customer.email.trim().toLowerCase(),id).run();
    }
    return json({
      success:true,
      bookingId:id,
      total:pricing.totalCents/100,
      subtotal:pricing.subtotalCents/100,
      discountPercent:pricing.discountPercent,
      discount:pricing.discountCents/100,
      service:quote.title
    });
  } catch(error) { return json({error:error.message||'Unable to save the booking.'},400); }
}
