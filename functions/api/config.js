export async function onRequestGet({ env }) {
  if (!env.STRIPE_PUBLISHABLE_KEY) {
    return Response.json({ error: 'Stripe publishable key is not configured in Cloudflare Pages.' }, { status: 503 });
  }
  return Response.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
