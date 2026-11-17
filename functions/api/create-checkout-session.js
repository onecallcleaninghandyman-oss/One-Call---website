const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const num = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Invalid booking quantity.');
  return n;
};
function calculate(b) {
  if (!b || typeof b !== 'object') throw new Error('Booking details are missing.');
  const allowed = ['regular','deep','kitchen','move','office','carpet','handyman'];
  if (!allowed.includes(b.service)) throw new Error('Please select a valid service.');
  const bathrooms = num(b.bathrooms ?? 1, 1, 10);
  const extraBath = Math.max(0, bathrooms - 1) * 39;
  let base = 0, title = '', description = '';
  const regular = {1:78,2:104,3:130,4:156,5:182,6:208};
  const deep = {1:156,2:195,3:234,4:273,5:312,6:351};
  const move = {'1bed':169,'2bed':221,'3bed':273,'4bed':325,'postreno':195};
  if (b.service === 'regular' || b.service === 'deep') {
    const rooms = num(b.service === 'regular' ? b.regularRooms : b.deepRooms, 1, 6);
    base = (b.service === 'regular' ? regular : deep)[rooms] + extraBath;
    title = b.service === 'regular' ? 'Regular Cleaning' : 'Deep Cleaning';
    description = `${rooms} ${rooms === 1 ? 'Room' : 'Rooms'}, ${bathrooms} ${bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}`;
    if (extraBath) description += ` (+€${extraBath} extra bath)`;
  } else if (b.service === 'kitchen') {
    base = 91; title = 'Kitchen Deep Clean'; description = 'Full General Deep Clean of Kitchen Only';
  } else if (b.service === 'move') {
    if (!(b.moveTier in move)) throw new Error('Invalid move-in / move-out package.');
    base = move[b.moveTier] + extraBath; title = 'Move-In / Move-Out';
    description = `${({'1bed':'Studio / 1-Bed Property','2bed':'2-Bedroom House / Apt','3bed':'3-Bedroom Family Home','4bed':'4-Bedroom+ Large Home','postreno':'Post-Renovation (up to 50m²)'})[b.moveTier]}, ${bathrooms} ${bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}`;
    if (extraBath) description += ` (+€${extraBath} extra bath)`;
  } else if (b.service === 'office') {
    title = 'Office & Commercial Cleaning';
    if (b.officeBillingMode === 'sqm') { const sqm = num(b.officeSqm, 1, 10000); base = Math.max(60, sqm * 1.5); description = `${sqm}m² Commercial Space (€1.50/m²)`; }
    else if (b.officeBillingMode === 'hours') { const hours = num(b.officeHours, 2, 12); base = Math.max(60, hours * 21); description = `${hours} hrs Commercial Clean (€21/hr)`; }
    else throw new Error('Invalid office billing option.');
  } else if (b.service === 'carpet') {
    title = 'Carpet & Upholstery';
    const carpet = num(b.carpetSqm ?? 0,0,150), rug = num(b.rugSqm ?? 0,0,60);
    const s2=num(b.sofa2Qty??0,0,20), s3=num(b.sofa3Qty??0,0,20), corner=num(b.sofaCornerQty??0,0,20), mattress=num(b.mattressQty??0,0,20);
    base = Math.max(54.60, carpet*4.10 + rug*4.55 + s2*77.35 + s3*91 + corner*118.30 + mattress*54.60);
    const parts=[]; if(carpet)parts.push(`${carpet}m² carpet`); if(rug)parts.push(`${rug}m² rug`); if(s2)parts.push(`${s2}x 2-seater`); if(s3)parts.push(`${s3}x 3-seater`); if(corner)parts.push(`${corner}x corner sofa`); if(mattress)parts.push(`${mattress}x mattress`);
    description=parts.length?parts.join(', '):'Minimum steam extraction call-out';
  } else if (b.service === 'handyman') {
    title='Handyman Services';
    const furniture=num(b.handymanFurniture??0,0,20), tv=num(b.handymanTv??0,0,20), shelf=num(b.handymanShelf??0,0,20), silicone=num(b.handymanSiliconeSqm??0,0,30), paint=num(b.handymanPaintSqm??0,0,100), hours=num(b.handymanHours??0,0,100);
    base=Math.max(60,furniture*60+tv*60+shelf*35+silicone*5+paint*12+hours*35);
    const parts=[]; if(furniture)parts.push(`${furniture}x assembly`); if(tv)parts.push(`${tv}x TV mount`); if(shelf)parts.push(`${shelf}x shelf`); if(silicone)parts.push(`${silicone}m² silicone (incl. materials)`); if(paint)parts.push(`${paint}m² paint`); if(hours)parts.push(`${hours}h labour`);
    description=parts.length?parts.join(', '):'Minimum €60 call-out';
  }
  const a=b.addons||{}; let addons=0; const add=(flag,price)=>{if(flag)addons+=price;};
  add(a.oven,35); add(a.fridge,18); add(a.cupboards,25); add(a.hood,15); add(a.microwave,5); add(a.stairs,20);
  addons += num(a.windowsCount??0,0,30)*12 + num(a.ironingHours??0,0,20)*22 + num(a.extraHours??0,0,20)*22;
  const total=Math.round((base+addons)*100);
  if(total<100) throw new Error('The booking total is invalid.');
  return {title,description,total};
}
export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) return json({error:'Stripe keys are not configured in Cloudflare Pages.'},503);
    const input=await request.json(); const b=input.booking; const client=b?.client||{};
    const name=String(client.name||'').trim(), phone=String(client.phone||'').trim(), address=String(client.address||'').trim(), town=String(client.town||'').trim();
    if(!name || !phone || !address) return json({error:'Please enter your name, phone number and address.'},400);
    if(name.length>120||phone.length>40||address.length>250||town.length>100) return json({error:'Some booking details are too long.'},400);
    const date=String(b.date||''); const slot=String(b.timeSlot||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !slot || slot.length>80) return json({error:'Please choose a valid booking date and time.'},400);
    const quote=calculate(b);
    const origin=new URL(request.url).origin;
    const params=new URLSearchParams();
    params.set('ui_mode','form'); params.set('mode','payment'); params.set('currency','eur');
    params.set('line_items[0][price_data][currency]','eur');
    params.set('line_items[0][price_data][product_data][name]',quote.title);
    params.set('line_items[0][price_data][product_data][description]',quote.description.slice(0,500));
    params.set('line_items[0][price_data][unit_amount]',String(quote.total));
    params.set('line_items[0][quantity]','1');
    params.set('return_url',origin+'/?payment=complete&session_id={CHECKOUT_SESSION_ID}');
    params.set('customer_creation','if_required');
    params.set('metadata[customer_name]',name); params.set('metadata[phone]',phone);
    params.set('metadata[address]',address); params.set('metadata[town]',town);
    params.set('metadata[booking_date]',date); params.set('metadata[time_slot]',slot);
    params.set('metadata[service]',quote.title); params.set('metadata[scope]',quote.description.slice(0,500));
    const resp=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{'Authorization':`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
    const data=await resp.json();
    if(!resp.ok) return json({error:data.error?.message||'Stripe could not create the payment session.'},502);
    return json({client_secret:data.client_secret});
  } catch(e) { return json({error:e.message||'Unable to create checkout session.'},400); }
}
