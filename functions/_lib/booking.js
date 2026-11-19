const clampNumber = (value, fallback = 0, max = 10000) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
};
const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
const euroCents = n => Math.round(roundMoney(n) * 100);

export function calculateBooking(s = {}) {
  const a = s.addons || {};
  const baths = Math.max(1, Math.min(20, Math.floor(clampNumber(s.bathrooms, 1, 20))));
  const extraBath = (baths - 1) * 39;
  const regular = {1:78,2:104,3:130,4:156,5:182,6:208};
  const deep = {1:156,2:195,3:234,4:273,5:312,6:351};
  let base = 0, title = '', description = '';
  const rooms = Math.max(1, Math.min(6, Math.floor(clampNumber(s.regularRooms, 3, 6))));
  const deepRooms = Math.max(1, Math.min(6, Math.floor(clampNumber(s.deepRooms, 3, 6))));
  if (s.service === 'regular') {
    title='Regular Cleaning'; base=regular[rooms]+extraBath;
    description=`${rooms} ${rooms===1?'Room':'Rooms'}, ${baths} ${baths===1?'Bathroom':'Bathrooms'}`;
    if(extraBath) description += ` (+€${extraBath} extra bath)`;
  } else if (s.service === 'deep') {
    title='Deep Cleaning'; base=deep[deepRooms]+extraBath;
    description=`${deepRooms} ${deepRooms===1?'Room':'Rooms'}, ${baths} ${baths===1?'Bathroom':'Bathrooms'}`;
    if(extraBath) description += ` (+€${extraBath} extra bath)`;
  } else if (s.service === 'kitchen') {
    title='Kitchen Deep Clean'; base=91; description='Full General Deep Clean of Kitchen Only';
  } else if (s.service === 'move') {
    title='Move-In / Move-Out';
    const packages={'1bed':169,'2bed':221,'3bed':273,'4bed':325,'postreno':195};
    const labels={'1bed':'Studio / 1-Bed Property','2bed':'2-Bedroom House / Apt','3bed':'3-Bedroom Family Home','4bed':'4-Bedroom+ Large Home','postreno':'Post-Renovation (up to 50m²)'};
    const tier=Object.hasOwn(packages,s.moveTier)?s.moveTier:'2bed';
    base=packages[tier]+extraBath; description=`${labels[tier]}, ${baths} ${baths===1?'Bathroom':'Bathrooms'}`;
    if(extraBath) description += ` (+€${extraBath} extra bath)`;
  } else if (s.service === 'office') {
    title='Office & Commercial Cleaning';
    if(s.officeBillingMode==='sqm'){
      const sqm=clampNumber(s.officeSqm,60,10000); base=Math.max(60,sqm*1.5); description=`${sqm}m² Commercial Space (€1.50/m²)`;
    } else {
      const hours=clampNumber(s.officeHours,3,1000); base=Math.max(60,hours*21); description=`${hours} hrs Commercial Clean (€21/hr)`;
    }
  } else if (s.service === 'carpet') {
    title='Carpet & Upholstery';
    const carpet=clampNumber(s.carpetSqm),rug=clampNumber(s.rugSqm),sofa2=clampNumber(s.sofa2Qty),sofa3=clampNumber(s.sofa3Qty),corner=clampNumber(s.sofaCornerQty),mattress=clampNumber(s.mattressQty);
    base=Math.max(54.6,carpet*4.10+rug*4.55+sofa2*77.35+sofa3*91+corner*118.30+mattress*54.60);
    const p=[]; if(carpet)p.push(`${carpet}m² carpet`); if(rug)p.push(`${rug}m² rug`); if(sofa2)p.push(`${sofa2}x 2-seater`); if(sofa3)p.push(`${sofa3}x 3-seater`); if(corner)p.push(`${corner}x corner sofa`); if(mattress)p.push(`${mattress}x mattress`);
    description=p.length?p.join(', '):'Minimum steam extraction call-out';
  } else if (s.service === 'handyman') {
    title='Handyman Services';
    const furniture=clampNumber(s.handymanFurniture,1),tv=clampNumber(s.handymanTv),shelf=clampNumber(s.handymanShelf),silicone=clampNumber(s.handymanSiliconeSqm),paint=clampNumber(s.handymanPaintSqm),hours=clampNumber(s.handymanHours);
    base=Math.max(60,furniture*60+tv*60+shelf*35+silicone*5+paint*12+hours*35);
    const p=[]; if(furniture)p.push(`${furniture}x assembly`); if(tv)p.push(`${tv}x TV mount`); if(shelf)p.push(`${shelf}x shelf`); if(silicone)p.push(`${silicone}m² silicone (incl. materials)`); if(paint)p.push(`${paint}m² paint`); if(hours)p.push(`${hours}h labour`);
    description=p.length?p.join(', '):'Minimum €60 call-out';
  } else throw new Error('Please select a valid service.');

  const addonItems=[];
  const add=(enabled,name,price)=>{if(enabled){addonItems.push({name,price});}};
  add(a.oven,'Oven Cleaning',35); add(a.fridge,'Fridge Cleaning',18); add(a.cupboards,'Inside Kitchen Cupboards',25); add(a.hood,'Extractor Hood Cleaning',15); add(a.microwave,'Microwave Cleaning (Inside)',5); add(a.stairs,'Stair Cleaning',20);
  const windows=Math.floor(clampNumber(a.windowsCount,0,100));
  const ironing=Math.floor(clampNumber(a.ironingHours,0,100));
  const extraHours=Math.floor(clampNumber(a.extraHours,0,100));
  if(windows)add(true,`Window Cleaning (${windows}x)`,windows*12);
  if(ironing)add(true,`Ironing (${ironing}h)`,ironing*22);
  if(extraHours)add(true,`Extra Cleaning Hour (${extraHours}h)`,extraHours*22);
  const addonsTotal=addonItems.reduce((sum,x)=>sum+x.price,0);
  const total=roundMoney(base+addonsTotal);
  return {title,description,basePrice:roundMoney(base),addonItems,addonsTotal,total,amount:euroCents(total)};
}

export function validateBooking(booking) {
  const b=booking||{}, c=b.client||{};
  const required=[['name',c.name],['phone',c.phone],['email',c.email],['address',c.address]];
  for(const [label,value] of required) if(!String(value||'').trim()) throw new Error(`Please enter your ${label}.`);
  const email=String(c.email).trim();
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if(String(c.name).trim().length>120 || String(c.phone).trim().length>40 || String(c.address).trim().length>250 || String(c.notes||'').length>1000) throw new Error('One or more booking fields are too long.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date||''))) throw new Error('Please select a valid booking date.');
  const d=new Date(`${b.date}T12:00:00Z`);
  if(Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==b.date) throw new Error('Please select a valid booking date.');
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'});
  if(b.date<today) throw new Error('Please select a future booking date.');
  const allowedSlots=['Morning (08:30 – 12:00)','Afternoon (12:30 – 16:00)','Evening (16:30 – 20:00)'];
  if(!allowedSlots.includes(String(b.timeSlot||''))) throw new Error('Please select a valid arrival time.');
  if(!String(c.town||'').trim() || String(c.town).length>80) throw new Error('Please select your town or area.');
  const quote=calculateBooking(b);
  if(!Number.isInteger(quote.amount)||quote.amount<100||quote.amount>10000000) throw new Error('Invalid booking amount.');
  return {customer:{name:String(c.name).trim(),phone:String(c.phone).trim(),email,address:String(c.address).trim(),town:String(c.town).trim(),notes:String(c.notes||'').trim()},quote};
}
export const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const bookingIdIsValid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||''));


export async function calculateRepeatCustomerPricing(db, customer, quote, now, tipCents = 0) {
  const email = String(customer.email || '').trim().toLowerCase();
  if (!email) throw new Error('Customer email is required to calculate repeat-customer pricing.');
  if (!Number.isInteger(tipCents) || tipCents < 0 || tipCents > 100000) {
    throw new Error('Tip must be between €0.00 and €1,000.00.');
  }

  const cutoff = new Date(Date.parse(now) - 30 * 24 * 60 * 60 * 1000).toISOString();
  const previousCompleted = await db.prepare(`
    SELECT id FROM bookings
    WHERE (customer_id = ? OR lower(trim(customer_email)) = ?)
      AND job_status = 'completed'
      AND completed_at IS NOT NULL
      AND completed_at >= ?
      AND completed_at <= ?
    ORDER BY completed_at DESC
    LIMIT 1
  `).bind(email, email, cutoff, now).first();

  const subtotalCents = quote.amount;
  const discountPercent = previousCompleted ? 10 : 0;
  const discountCents = Math.round(subtotalCents * discountPercent / 100);
  const rawItems = [
    { name: quote.title, description: quote.description || '', amountCents: Math.round(quote.basePrice * 100) },
    ...(quote.addonItems || []).map(item => ({
      name: item.name,
      description: item.name,
      amountCents: Math.round(item.price * 100)
    }))
  ].filter(item => item.amountCents > 0);

  // Allocate the exact order-level discount across Stripe's itemised service lines.
  const allocations = rawItems.map((item, index) => {
    const exact = subtotalCents ? item.amountCents * discountCents / subtotalCents : 0;
    return { index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let unallocated = discountCents - allocations.reduce((sum, item) => sum + item.cents, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < allocations.length && unallocated > 0; i++, unallocated--) allocations[i].cents++;
  allocations.sort((a, b) => a.index - b.index);

  const serviceItems = rawItems.map((item, index) => ({
    ...item,
    discountCents: allocations[index]?.cents || 0,
    finalAmountCents: item.amountCents - (allocations[index]?.cents || 0)
  }));
  const totalCents = subtotalCents - discountCents + tipCents;
  if (!Number.isInteger(totalCents) || totalCents < 1) throw new Error('Invalid final booking total.');

  return {
    subtotalCents,
    discountPercent,
    discountCents,
    tipCents,
    totalCents,
    serviceItems,
    previousCompletedBookingId: previousCompleted?.id || null
  };
}
