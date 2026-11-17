const encoder = new TextEncoder();

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(item => item.split('=')));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  return hex(signed) === signature;
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });
  const event = JSON.parse(payload);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Stripe booking payment completed', {
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata
    });
  }
  return Response.json({ received: true });
}
