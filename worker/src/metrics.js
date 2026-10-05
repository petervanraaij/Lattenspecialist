// Aggregate website actions only. Never persist IPs, identifiers, URLs or form values.
const EVENTS = ['packages_viewed', 'form_opened', 'form_started', 'booking_submitted'];
const buckets = new Map();
const dayString = date => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Amsterdam'}).format(date);
const windowStart = days => { const date = new Date(); date.setUTCDate(date.getUTCDate() - days + 1); return dayString(date); };
const reply = (body, status, origin) => new Response(JSON.stringify(body), {status, headers:{
  'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin',
  'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization'
}});
const limited = request => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  // Transient abuse protection per Worker instance; not a visitor identifier.
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 1000) return true;
    bucket = {total:0, expires:now + 60000}; buckets.set(key, bucket);
  }
  return ++bucket.total > 20;
};
async function smallJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error();
  if (Number(request.headers.get('Content-Length')) > 128 || !request.body) throw new Error();
  const reader = request.body.getReader(); let length = 0, value = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 128) { await reader.cancel(); throw new Error(); }
      value += decoder.decode(chunk.value, {stream:true});
    }
    return JSON.parse(value + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function handleMetrics(request, env, adminAuthorized) {
  const url = new URL(request.url), origin = request.headers.get('Origin') || '';
  const websiteOrigins = String(env.LATTENSPECIALIST_ORIGINS || 'https://lattenspecialist.nl,https://www.lattenspecialist.nl').split(',').map(value => value.trim());
  const admin = url.pathname === '/api/admin/metrics';
  if (!admin && !websiteOrigins.includes(origin)) return reply({message:'Niet toegestaan.'}, 403, origin);
  if (admin && !adminAuthorized) return reply({message:'Toegangscode onjuist.'}, 401, origin);
  if (request.method !== (admin ? 'GET' : 'POST')) return reply({message:'Methode niet toegestaan.'}, 405, origin);
  const db = env.LATTENSPECIALIST_ANALYTICS_DB;
  if (!db) return reply({message:'Websitestatistieken zijn nog niet beschikbaar.'}, 503, origin);
  try {
    if (admin) {
      const days = Number(url.searchParams.get('days') || 30);
      if (![7,30,90].includes(days)) return reply({message:'Kies 7, 30 of 90 dagen.'}, 400, origin);
      const result = await db.prepare('SELECT day, event, total FROM website_metrics WHERE day >= ? AND day <= ? ORDER BY day, event').bind(windowStart(days), dayString(new Date())).all();
      const totals = Object.fromEntries(EVENTS.map(event => [event, 0]));
      for (const row of result.results) if (EVENTS.includes(row.event)) totals[row.event] += Number(row.total);
      return reply({ok:true, days, from:windowStart(days), through:dayString(new Date()), totals}, 200, origin);
    }
    if (limited(request)) return reply({message:'Probeer later opnieuw.'}, 429, origin);
    let data;
    try { data = await smallJson(request); } catch { return reply({message:'Ongeldige telling.'}, 400, origin); }
    if (!data || Array.isArray(data) || Object.keys(data).length !== 1 || !EVENTS.includes(data.event)) return reply({message:'Ongeldige telling.'}, 400, origin);
    await db.batch([
      db.prepare('INSERT INTO website_metrics(day,event,total) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET total = MIN(total + 1, 10000)').bind(dayString(new Date()), data.event),
      db.prepare('DELETE FROM website_metrics WHERE day < ?').bind(windowStart(90))
    ]);
    return reply({ok:true}, 202, origin);
  } catch { return reply({message:'De websitestatistieken zijn tijdelijk niet beschikbaar.'}, 503, origin); }
}
