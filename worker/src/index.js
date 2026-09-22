const JSON_HEADERS = {'Content-Type': 'application/json; charset=utf-8'};
class ValidationError extends Error {}

const STATUS_STEPS = [
  'Aanvraag ontvangen',
  'Ophalen of brengen gepland',
  'Materiaal ontvangen',
  'Inspectie uitgevoerd',
  'Onderhoud gestart',
  'Wax koelt af',
  'Finish en eindcontrole',
  'Klaar voor ophalen of terugbrengen'
];

const clean = (value, maxLength) => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const csv = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...JSON_HEADERS,
    ...(origin ? {'Access-Control-Allow-Origin': origin} : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  }
});

const getSite = (origin, env) => {
  if (origin === (env.STUITERBAAS_ORIGIN || 'https://stuiterbaas.nl')) return 'stuiterbaas';
  if (csv(env.LATTENSPECIALIST_ORIGINS || 'https://lattenspecialist.nl,https://www.lattenspecialist.nl').includes(origin)) return 'lattenspecialist';
  return null;
};

const verifyTurnstile = async (token, secret, remoteIp) => {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method: 'POST', body});
  const result = await response.json();
  return result.success === true;
};

const readAndValidateStuiterbaas = raw => {
  const data = {
    name: clean(raw.name, 80), phone: clean(raw.phone, 30), email: clean(raw.email, 120),
    date: clean(raw.date, 10), location: clean(raw.location, 140), startTime: clean(raw.startTime, 5),
    endTime: clean(raw.endTime, 5), notes: clean(raw.notes, 600), website: clean(raw.website, 120),
    turnstileToken: clean(raw.turnstileToken, 2048), privateSite: raw.privateSite === true,
    powerAvailable: raw.powerAvailable === true, adultHelper: raw.adultHelper === true,
    privacyConsent: raw.privacyConsent === true
  };
  if (data.website) return {data, spam: true};
  if (!data.name || !data.phone || !data.location || !data.date || !data.startTime || !data.endTime) throw new ValidationError('Vul alle verplichte velden in.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime)) throw new ValidationError('Controleer de datum en tijden.');
  const requestedDate = new Date(`${data.date}T23:59:59Z`);
  if (Number.isNaN(requestedDate.getTime()) || requestedDate < new Date()) throw new ValidationError('Kies een datum vanaf vandaag.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new ValidationError('Controleer het e-mailadres.');
  if (!data.privateSite || !data.powerAvailable || !data.adultHelper || !data.privacyConsent) throw new ValidationError('Bevestig alle voorwaarden voor de aanvraag.');
  if (!data.turnstileToken) throw new ValidationError('Voltooi de beveiligingscontrole.');
  return {data, spam: false};
};

const readAndValidateLattenspecialist = raw => {
  const data = {
    service: clean(raw.service, 24), material: clean(raw.material, 40), amount: clean(raw.amount, 3),
    package: clean(raw.package, 60), logistics: clean(raw.logistics, 100), pickupday: clean(raw.pickupday, 30),
    urgent: clean(raw.urgent, 80), destination: clean(raw.destination, 100), skidate: clean(raw.skidate, 10),
    conditions: clean(raw.conditions, 80), rentaltype: clean(raw.rentaltype, 60), height: clean(raw.height, 3),
    shoesize: clean(raw.shoesize, 20), level: clean(raw.level, 30), rentfrom: clean(raw.rentfrom, 10),
    rentto: clean(raw.rentto, 10), name: clean(raw.name, 80), phone: clean(raw.phone, 30),
    email: clean(raw.email, 120), postcode: clean(raw.postcode, 12), address: clean(raw.address, 140),
    notes: clean(raw.notes, 800), website: clean(raw.website, 120), turnstileToken: clean(raw.turnstileToken, 2048),
    privacyConsent: raw.privacyConsent === true
  };
  if (data.website) return {data, spam: true};
  if (!['Onderhoud', 'Verhuur'].includes(data.service)) throw new ValidationError('Kies onderhoud of verhuur.');
  if (!data.name || !data.phone || !data.email) throw new ValidationError('Vul naam, telefoonnummer en e-mailadres in.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new ValidationError('Controleer het e-mailadres.');
  if (data.service === 'Onderhoud' && (!data.material || !/^\d{1,2}$/.test(data.amount) || Number(data.amount) < 1 || Number(data.amount) > 20 || !data.package)) throw new ValidationError('Controleer het materiaal, aantal en pakket.');
  if (data.service === 'Verhuur' && !data.rentaltype) throw new ValidationError('Kies wat je wilt huren.');
  for (const dateValue of [data.skidate, data.rentfrom, data.rentto].filter(Boolean)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) throw new ValidationError('Controleer de ingevulde datum.');
  }
  if (data.rentfrom && data.rentto && data.rentto < data.rentfrom) throw new ValidationError('De einddatum ligt vóór de begindatum.');
  if (!data.privacyConsent) throw new ValidationError('Geef toestemming om je aanvraag te verwerken.');
  if (!data.turnstileToken) throw new ValidationError('Voltooi de beveiligingscontrole.');
  return {data, spam: false};
};

const createReference = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
  const now = new Date();
  return `LS-${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}-${suffix}`;
};

const createServiceCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `LS-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`;
};

const normalizeServiceCode = value => clean(value, 24).toUpperCase().replace(/\s+/g, '');

const isAdminAuthorized = (request, env) => {
  const expected = String(env.LATTENSPECIALIST_ADMIN_TOKEN || '');
  const authorization = request.headers.get('Authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return difference === 0;
};

const requireReservationStore = env => {
  if (!env.LATTENSPECIALIST_RESERVATIONS_KV) throw new Error('Reservation storage is unavailable.');
  return env.LATTENSPECIALIST_RESERVATIONS_KV;
};

const listReservations = async env => {
  const store = requireReservationStore(env);
  const records = [];
  let cursor;
  do {
    const page = await store.list({prefix: 'reservation:', cursor});
    const values = await Promise.all((page.keys || []).map(key => store.get(key.name, 'json')));
    records.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  records.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  return records;
};

const assignUniqueServiceCode = async store => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createServiceCode();
    if (!await store.get(`service:${code}`)) return code;
  }
  throw new Error('Unable to create a unique service code.');
};

const updateReservation = async (reference, raw, env) => {
  const store = requireReservationStore(env);
  const key = `reservation:${reference}`;
  const record = await store.get(key, 'json');
  if (!record) return null;
  const currentStep = Math.max(1, Math.min(STATUS_STEPS.length, Number(raw.currentStep) || Number(record.currentStep) || 1));
  const status = clean(raw.status, 100) || STATUS_STEPS[currentStep - 1];
  const expectedReady = clean(raw.expectedReady, 40);
  const note = clean(raw.note, 320);
  let serviceCode = normalizeServiceCode(raw.serviceCode || record.serviceCode);
  if (raw.generateServiceCode === true && !serviceCode) serviceCode = await assignUniqueServiceCode(store);
  if (serviceCode && !/^LS-[A-Z2-9]{6}$/.test(serviceCode)) throw new ValidationError('De servicecode heeft geen geldig formaat.');
  if (serviceCode) {
    const owner = await store.get(`service:${serviceCode}`);
    if (owner && owner !== reference) throw new ValidationError('Deze servicecode is al in gebruik.');
    await store.put(`service:${serviceCode}`, reference);
  }
  const updated = {...record, serviceCode: serviceCode || null, currentStep, status, expectedReady, note, updatedAt: new Date().toISOString()};
  await store.put(key, JSON.stringify(updated));
  return updated;
};

const publicStatus = record => ({
  code: record.serviceCode,
  material: record.service === 'Verhuur' ? record.rentaltype : `${record.amount || 1}× ${record.material || 'materiaal'}`,
  package: record.package || (record.service === 'Verhuur' ? 'Verhuur op aanvraag' : 'In overleg'),
  currentStep: Number(record.currentStep) || 1,
  status: record.status || STATUS_STEPS[0],
  updatedAt: record.updatedAt || record.createdAt,
  expectedReady: record.expectedReady || '',
  note: record.note || ''
});

const getReservationByServiceCode = async (code, env) => {
  const store = requireReservationStore(env);
  const reference = await store.get(`service:${code}`);
  if (!reference) return null;
  return store.get(`reservation:${reference}`, 'json');
};

const sendResendEmail = async (message, env) => {
  if (!env.RESEND_API_KEY) throw new Error('Email configuration is incomplete.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(message)
  });
  if (!response.ok) {
    console.error('Email provider rejected the booking notification.', response.status);
    throw new Error('Email notification failed.');
  }
};

const sendStuiterbaasEmail = async (data, env) => {
  const fields = [['Naam', data.name], ['Telefoon', data.phone], ['E-mail', data.email || 'Niet ingevuld'], ['Datum', data.date], ['Tijd', `${data.startTime} – ${data.endTime}`], ['Locatie', data.location], ['Opmerking', data.notes || 'Geen opmerkingen']];
  const rows = fields.map(([label, value]) => `<tr><th align="left" style="padding:6px 14px 6px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`).join('');
  const message = {
    from: env.STUITERBAAS_FROM_EMAIL || 'Stuiterbaas Reserveringen <reserveringen@stuiterbaas.nl>',
    to: [env.STUITERBAAS_TO_EMAIL || 'verhuur@stuiterbaas.nl'],
    subject: `Reserveringsaanvraag ${data.date} – ${data.name}`,
    text: ['Nieuwe reserveringsaanvraag via stuiterbaas.nl', '', ...fields.map(([label, value]) => `${label}: ${value}`), '', 'De aanvrager bevestigde: privéterrein, geschikt stroompunt, een volwassen helper en toestemming om contact op te nemen.', '', 'Deze aanvraag is nog geen definitieve reservering.'].join('\n'),
    html: `<h1 style="font-size:20px">Nieuwe reserveringsaanvraag</h1><table style="border-collapse:collapse">${rows}</table><p>De aanvrager bevestigde: privéterrein, geschikt stroompunt, een volwassen helper en toestemming om contact op te nemen.</p><p><strong>Deze aanvraag is nog geen definitieve reservering.</strong></p>`
  };
  if (data.email) message.reply_to = data.email;
  await sendResendEmail(message, env);
};

const lattenspecialistFields = data => {
  const common = [['Dienst', data.service], ['Naam', data.name], ['Telefoon', data.phone], ['E-mail', data.email], ['Postcode', data.postcode || 'Niet ingevuld'], ['Adres / plaats', data.address || 'Niet ingevuld']];
  const specific = data.service === 'Onderhoud' ? [
    ['Materiaal', data.material], ['Aantal', data.amount], ['Pakket', data.package], ['Logistiek', data.logistics], ['Voorkeursdag', data.pickupday], ['Spoed', data.urgent], ['Bestemming', data.destination || 'Niet ingevuld'], ['Eerste skidag', data.skidate || 'Niet ingevuld'], ['Omstandigheden', data.conditions || 'Niet ingevuld']
  ] : [
    ['Verhuur', data.rentaltype], ['Lengte persoon', data.height ? `${data.height} cm` : 'Niet ingevuld'], ['Schoenmaat', data.shoesize || 'Niet ingevuld'], ['Niveau', data.level || 'Niet ingevuld'], ['Van', data.rentfrom || 'Niet ingevuld'], ['Tot en met', data.rentto || 'Niet ingevuld']
  ];
  return [...common, ...specific, ['Opmerking', data.notes || 'Geen opmerkingen']];
};

const sendLattenspecialistEmail = async (data, reference, env) => {
  const fields = lattenspecialistFields(data);
  const rows = fields.map(([label, value]) => `<tr><th align="left" style="padding:6px 14px 6px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`).join('');
  await sendResendEmail({
    from: env.LATTENSPECIALIST_FROM_EMAIL || 'De Lattenspecialist via Stuiterbaas <reserveringen@stuiterbaas.nl>',
    to: [env.LATTENSPECIALIST_TO_EMAIL || 'info@lattenspecialist.nl'],
    reply_to: data.email,
    subject: `[Lattenspecialist aanvraag] ${data.service} ${reference} – ${data.name}`,
    text: ['Nieuwe aanvraag via lattenspecialist.nl', `Aanvraagcode: ${reference}`, '', ...fields.map(([label, value]) => `${label}: ${value}`), '', 'Deze aanvraag is nog geen definitieve afspraak.'].join('\n'),
    html: `<h1 style="font-size:20px">Nieuwe aanvraag</h1><p><strong>Aanvraagcode: ${escapeHtml(reference)}</strong></p><table style="border-collapse:collapse">${rows}</table><p><strong>Deze aanvraag is nog geen definitieve afspraak.</strong></p>`
  }, env);
};

const saveLattenspecialistReservation = async (data, reference, env) => {
  if (!env.LATTENSPECIALIST_RESERVATIONS_KV) return;
  const now = new Date().toISOString();
  const stored = {...data, reference, createdAt: now, updatedAt: now, status: STATUS_STEPS[0], currentStep: 1, expectedReady: '', note: '', serviceCode: null};
  delete stored.turnstileToken;
  delete stored.website;
  await env.LATTENSPECIALIST_RESERVATIONS_KV.put(`reservation:${reference}`, JSON.stringify(stored));
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const site = getSite(origin, env);
    if (!site) return json({message: 'Niet toegestaan.'}, 403, '');
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin', 'Cache-Control': 'no-store'}});
    const url = new URL(request.url);

    if (site === 'lattenspecialist' && request.method === 'GET' && url.pathname.startsWith('/api/status/')) {
      const code = normalizeServiceCode(decodeURIComponent(url.pathname.slice('/api/status/'.length)));
      if (!/^LS-[A-Z2-9]{6}$/.test(code)) return json({message: 'Controleer de servicecode.'}, 400, origin);
      try {
        const record = await getReservationByServiceCode(code, env);
        return record ? json({ok: true, record: publicStatus(record)}, 200, origin) : json({message: 'Servicecode niet gevonden.'}, 404, origin);
      } catch {
        return json({message: 'De status kon niet worden opgehaald.'}, 502, origin);
      }
    }

    if (site === 'lattenspecialist' && url.pathname === '/api/admin/reservations' && request.method === 'GET') {
      if (!isAdminAuthorized(request, env)) return json({message: 'Toegangscode onjuist.'}, 401, origin);
      try {
        return json({ok: true, records: await listReservations(env)}, 200, origin);
      } catch {
        return json({message: 'De reserveringen konden niet worden opgehaald.'}, 502, origin);
      }
    }

    if (site === 'lattenspecialist' && url.pathname.startsWith('/api/admin/reservations/') && request.method === 'PATCH') {
      if (!isAdminAuthorized(request, env)) return json({message: 'Toegangscode onjuist.'}, 401, origin);
      const reference = clean(decodeURIComponent(url.pathname.slice('/api/admin/reservations/'.length)), 32).toUpperCase();
      if (!/^LS-\d{4}-[A-Z2-9]{6}$/.test(reference)) return json({message: 'Aanvraagcode ongeldig.'}, 400, origin);
      try {
        const record = await updateReservation(reference, await request.json(), env);
        return record ? json({ok: true, record}, 200, origin) : json({message: 'Aanvraag niet gevonden.'}, 404, origin);
      } catch (error) {
        const validation = error instanceof ValidationError;
        return json({message: validation ? error.message : 'De aanvraag kon niet worden bijgewerkt.'}, validation ? 400 : 502, origin);
      }
    }

    if (request.method !== 'POST') return json({message: 'Alleen POST is toegestaan.'}, 405, origin);

    const turnstileSecret = site === 'stuiterbaas' ? env.TURNSTILE_SECRET_KEY : env.LATTENSPECIALIST_TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) return json({message: 'De reserveringsservice is nog niet geconfigureerd.'}, 503, origin);
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 18000) return json({message: 'De aanvraag is te groot.'}, 413, origin);
      const result = site === 'stuiterbaas' ? readAndValidateStuiterbaas(await request.json()) : readAndValidateLattenspecialist(await request.json());
      if (result.spam) return json({ok: true}, 202, origin);
      const turnstileOk = await verifyTurnstile(result.data.turnstileToken, turnstileSecret, request.headers.get('CF-Connecting-IP'));
      if (!turnstileOk) return json({message: 'De beveiligingscontrole is verlopen. Probeer het opnieuw.'}, 400, origin);

      if (site === 'stuiterbaas') {
        await sendStuiterbaasEmail(result.data, env);
        return json({ok: true}, 202, origin);
      }
      const reference = createReference();
      await sendLattenspecialistEmail(result.data, reference, env);
      await saveLattenspecialistReservation(result.data, reference, env);
      return json({ok: true, reference}, 202, origin);
    } catch (error) {
      const validation = error instanceof ValidationError;
      return json({message: validation ? error.message : 'De aanvraag kon niet worden verstuurd.'}, validation ? 400 : 502, origin);
    }
  }
};

export {STATUS_STEPS, clean, createReference, createServiceCode, escapeHtml, getSite, isAdminAuthorized, normalizeServiceCode, publicStatus, readAndValidateLattenspecialist, readAndValidateStuiterbaas};
