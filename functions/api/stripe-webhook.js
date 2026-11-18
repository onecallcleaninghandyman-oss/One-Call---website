import { upsertCustomer } from '../_lib/customers.js';

const encoder=new TextEncoder();
const toHex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
function constantTimeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function verifyStripeSignature(payload,header,secret){
  if(!header||!secret)return false;
  const parts=header.split(',').map(x=>x.trim().split('='));
  const timestamp=Number(parts.find(x=>x[0]==='t')?.[1]), signatures=parts.filter(x=>x[0]==='v1').map(x=>x[1]);
  if(!timestamp||!signatures.length||Math.abs(Date.now()/1000-timestamp)>300)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=toHex(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${payload}`)));
  return signatures.some(sig=>constantTimeEqual(digest,sig));
}
export async function onRequestPost({request,env}){
  if(!env.STRIPE_WEBHOOK_SECRET)return new Response('Webhook is not configured',{status:503});
  if(!env.BOOKINGS_DB)return new Response('Booking database is not configured',{status:503});
  const payload=await request.text();
  if(!(await verifyStripeSignature(payload,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET)))return new Response('Invalid signature',{status:400});
  let event;try{event=JSON.parse(payload);}catch{return new Response('Invalid payload',{status:400});}
  try{
    const already=await env.BOOKINGS_DB.prepare('SELECT id FROM stripe_events WHERE id=?').bind(event.id).first();
    if(already)return Response.json({received:true,duplicate:true});
    const session=event.data?.object, meta=session?.metadata||{}, id=meta.booking_id, now=new Date().toISOString();
    if(id&&(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')&&session.payment_status==='paid'){
      const customer={
        name:meta.customer_name||'',
        email:meta.customer_email||session.customer_details?.email||session.customer_email||'',
        phone:meta.customer_phone||session.customer_details?.phone||'',
        address:meta.customer_address||'',
        town:meta.customer_town||'',
        notes:meta.customer_notes||''
      };
      if(!customer.email) return new Response('Paid session is missing customer email',{status:500});
      const saved=await env.BOOKINGS_DB.prepare(`INSERT INTO bookings
        (id,service,description,booking_date,booking_time,customer_name,customer_email,customer_phone,customer_address,customer_town,customer_notes,total_cents,currency,payment_method,payment_status,stripe_session_id,booking_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'eur','stripe','paid',?,?,?,?)
        ON CONFLICT(id) DO NOTHING`)
        .bind(id,meta.service||'Online booking',meta.description||'',meta.booking_date||'',meta.booking_time||'',customer.name,customer.email,customer.phone,customer.address,customer.town,customer.notes,session.amount_total,session.id,JSON.stringify({date:meta.booking_date||'',timeSlot:meta.booking_time||'',service:meta.service||'',description:meta.description||'',client:customer}),now,now).run();
      if(saved.meta?.changes===1){
        await upsertCustomer(env.BOOKINGS_DB,customer,now);
        await env.BOOKINGS_DB.prepare('UPDATE bookings SET customer_id=? WHERE id=?').bind(customer.email.trim().toLowerCase(),id).run();
      }
    }
    // Failed or expired checkout sessions never create customer or booking rows.
    await env.BOOKINGS_DB.prepare('INSERT INTO stripe_events(id,event_type,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,event.type,now).run();
    return Response.json({received:true});
  }catch(error){console.error('Stripe webhook processing failed',error);return new Response('Webhook processing failed',{status:500});}
}