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
    const session=event.data?.object, id=session?.metadata?.booking_id, now=new Date().toISOString();
    if(id){
      if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
        if(session.payment_status==='paid'){
          const result=await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='paid',stripe_session_id=?,updated_at=? WHERE id=? AND total_cents=? AND currency='eur' AND payment_method='stripe'")
            .bind(session.id,now,id,session.amount_total).run();
          if(result.meta?.changes!==1){console.error('Paid Stripe session did not match a pending booking',{eventId:event.id,sessionId:session.id,bookingId:id});return new Response('Booking or amount mismatch',{status:500});}
        }
      } else if(event.type==='checkout.session.async_payment_failed'){
        await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='payment_failed',updated_at=? WHERE id=? AND payment_method='stripe' AND payment_status='pending_payment'").bind(now,id).run();
      } else if(event.type==='checkout.session.expired'){
        await env.BOOKINGS_DB.prepare("UPDATE bookings SET payment_status='expired',updated_at=? WHERE id=? AND payment_method='stripe' AND payment_status='pending_payment'").bind(now,id).run();
      }
    }
    await env.BOOKINGS_DB.prepare('INSERT INTO stripe_events(id,event_type,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,event.type,now).run();
    return Response.json({received:true});
  }catch(error){console.error('Stripe webhook processing failed',error);return new Response('Webhook processing failed',{status:500});}
}