async function verifyStripeSignature(payload, header, secret) {
  const parts=header.split(',').map(x=>x.split('='));
  const timestamp=parts.find(x=>x[0]==='t')?.[1];
  const signatures=parts.filter(x=>x[0]==='v1').map(x=>x[1]);
  if(!timestamp || !signatures.length) return false;
  if(Math.abs(Date.now()/1000-Number(timestamp))>300) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected=[...new Uint8Array(signed)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return signatures.some(sig=>sig.length===expected.length && [...sig].every((c,i)=>c===expected[i]));
}
export async function onRequestPost({request,env}) {
  if(!env.STRIPE_WEBHOOK_SECRET) return new Response('Webhook secret is not configured.',{status:503});
  const raw=await request.text(); const sig=request.headers.get('Stripe-Signature')||'';
  if(!await verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET)) return new Response('Invalid signature.',{status:400});
  const event=JSON.parse(raw);
  if(event.type==='checkout.session.completed') {
    // Verified payment event. Persist/email notifications can be added after selecting a booking store.
    console.log('Verified paid booking', JSON.stringify({session:event.data.object.id,amount_total:event.data.object.amount_total,currency:event.data.object.currency,metadata:event.data.object.metadata}));
  }
  return new Response('ok',{status:200});
}
