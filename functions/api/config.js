export async function onRequestGet({ env }) {
  const key = env.STRIPE_PUBLISHABLE_KEY;
  if (!key) return Response.json({ error: 'STRIPE_PUBLISHABLE_KEY is not configured.' }, { status: 500 });
  return Response.json({ publishableKey: key }, { headers: { 'Cache-Control': 'no-store' } });
}
