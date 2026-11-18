const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10000, n)) : fallback;
};

// Recalculate all prices on the server. Never trust a total sent by the browser.
function calculateBooking(booking) {
  const s = booking || {};
  const addons = s.addons || {};
  let base = 0, title = '', description = '';
  const baths = Math.max(1, Math.min(20, Math.floor(num(s.bathrooms, 1))));
  const extraBath = (baths - 1) * 39;
  const regular = { 1: 78, 2: 104, 3: 130, 4: 156, 5: 182, 6: 208 };
  const deep = { 1: 156, 2: 195, 3: 234, 4: 273, 5: 312, 6: 351 };
  const rooms = Math.max(1, Math.min(6, Math.floor(num(s.regularRooms, 3))));
  const deepRooms = Math.max(1, Math.min(6, Math.floor(num(s.deepRooms, 3))));
  if (s.service === 'regular') { title = 'Regular Cleaning'; base = regular[rooms] + extraBath; description = `${rooms} Rooms, ${baths} Bathrooms`; }
  else if (s.service === 'deep') { title = 'Deep Cleaning'; base = deep[deepRooms] + extraBath; description = `${deepRooms} Rooms, ${baths} Bathrooms`; }
  else if (s.service === 'kitchen') { title = 'Kitchen Deep Clean'; base = 91; description = 'Full General Deep Clean of Kitchen Only'; }
  else if (s.service === 'move') {
    title = 'Move-In / Move-Out';
    const packages = { '1bed': 169, '2bed': 221, '3bed': 273, '4bed': 325 };
    const tier = packages[s.moveTier] ? s.moveTier : '2bed';
    base = packages[tier] + extraBath; description = `${tier} property, ${baths} Bathrooms`;
  } else if (s.service === 'office') {
    title = 'Office & Commercial Cleaning';
    if (s.officeBillingMode === 'hourly') { const hours = Math.max(1, num(s.officeHours, 3)); base = Math.max(60, hours * 21); description = `${hours} hrs Commercial Clean`; }
    else { const sqm = Math.max(1, num(s.officeSqm, 60)); base = Math.max(60, sqm * 1.5); description = `${sqm}m² Commercial Space`; }
  } else if (s.service === 'carpet') {
    title = 'Carpet & Upholstery';
    const carpet = num(s.carpetSqm), rug = num(s.rugSqm), sofa2 = num(s.sofa2Qty), sofa3 = num(s.sofa3Qty), corner = num(s.sofaCornerQty), mattress = num(s.mattressQty);
    base = Math.max(54.6, carpet * 4.10 + rug * 4.55 + sofa2 * 77.35 + sofa3 * 91 + corner * 118.30 + mattress * 54.60);
    const parts = [];
    if (carpet) parts.push(`${carpet}m² carpet`); if (rug) parts.push(`${rug}m² rug`); if (sofa2) parts.push(`${sofa2}x 2-seater`); if (sofa3) parts.push(`${sofa3}x 3-seater`); if (corner) parts.push(`${corner}x corner sofa`); if (mattress) parts.push(`${mattress}x mattress`);
    description = parts.length ? parts.join(', ') : 'Minimum steam extraction call-out';
  } else if (s.service === 'handyman') {
    title = 'Handyman Services';
    const furniture = num(s.handymanFurniture, 1), tv = num(s.handymanTv), shelf = num(s.handymanShelf), silicone = num(s.handymanSiliconeSqm), paint = num(s.handymanPaintSqm), hours = num(s.handymanHours);
    base = Math.max(60, furniture * 60 + tv * 60 + shelf * 35 + silicone * 5 + paint * 12 + hours * 35);
    const parts = []; if (furniture) parts.push(`${furniture}x assembly`); if (tv) parts.push(`${tv}x TV mount`); if (shelf) parts.push(`${shelf}x shelf`); if (silicone) parts.push(`${silicone}m² silicone`); if (paint) parts.push(`${paint}m² paint`); if (hours) parts.push(`${hours}h labour`);
    description = parts.length ? parts.join(', ') : 'Minimum €60 call-out';
  } else throw new Error('Please select a valid service.');

  const extras = [
    [addons.oven, 35], [addons.fridge, 18], [addons.cupboards, 25], [addons.hood, 15], [addons.microwave, 5], [addons.stairs, 20]
  ];
  let total = base + extras.reduce((sum, [enabled, price]) => sum + (enabled ? price : 0), 0);
  total += num(addons.windowsCount) * 12 + num(addons.ironingHours) * 22 + num(addons.extraHours) * 22;
  return { title, description, amount: Math.round(total * 100) };
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY) return json({ error: 'STRIPE_SECRET_KEY is missing in Cloudflare Pages environment variables.' }, 500);
    const body = await request.json();
    const booking = body.booking || {};
    const customer = booking.client || {};
    if (!String(customer.name || '').trim() || !String(customer.phone || '').trim() || !String(customer.address || '').trim()) {
      return json({ error: 'Please enter your name, phone number and address.' }, 400);
    }
    const quote = calculateBooking(booking);
    if (!Number.isInteger(quote.amount) || quote.amount < 100 || quote.amount > 10000000) return json({ error: 'Invalid booking amount.' }, 400);

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.append('payment_method_types[]', 'card');
    params.set('ui_mode', 'form');
    params.set('billing_address_collection', 'auto');
params.set('automatic_tax[enabled]', 'false');
params.set('submit_type', 'auto');
params.set('integration_identifier', 'custom_embedded_web_0002');
    params.set('return_url', `${origin}/?payment=complete&session_id={CHECKOUT_SESSION_ID}`);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'eur');
    params.set('line_items[0][price_data][unit_amount]', String(quote.amount));
    params.set('line_items[0][price_data][product_data][name]', quote.title);
    params.set('line_items[0][price_data][product_data][description]', quote.description.slice(0, 300));
    params.set('phone_number_collection[enabled]', 'false');
    params.set('metadata[customer_name]', String(customer.name).slice(0, 500));
    params.set('metadata[customer_phone]', String(customer.phone).slice(0, 500));
    params.set('metadata[customer_address]', String(customer.address).slice(0, 500));
    params.set('metadata[customer_town]', String(customer.town || '').slice(0, 200));
    params.set('metadata[booking_date]', String(booking.date || '').slice(0, 100));
    params.set('metadata[booking_time]', String(booking.timeSlot || '').slice(0, 200));
    params.set('metadata[service]', quote.title);
    params.set('metadata[description]', quote.description.slice(0, 500));

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
  'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
  'Content-Type': 'application/x-www-form-urlencoded',
  'Stripe-Version': '2026-03-25.dahlia'
},
      body: params
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error('Stripe API error:', session);
      return json({ error: session.error?.message || 'Stripe could not create the payment session.' }, stripeResponse.status);
    }
    if (!session.client_secret) return json({ error: 'Stripe did not return a client secret. Check the Stripe Checkout Elements configuration.' }, 502);
    return json({ client_secret: session.client_secret });
  } catch (error) {
    console.error('Checkout session error:', error);
    return json({ error: error.message || 'Unable to start payment. Please try again.' }, 400);
  }
}
