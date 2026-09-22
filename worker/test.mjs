import assert from 'node:assert/strict';
import worker, {createReference, escapeHtml, getSite, readAndValidateLattenspecialist, readAndValidateStuiterbaas} from './src/index.js';

const stuiterOrigin = 'https://stuiterbaas.nl';
const lattenOrigin = 'https://lattenspecialist.nl';
const baseEnv = {
  STUITERBAAS_ORIGIN: stuiterOrigin,
  STUITERBAAS_TO_EMAIL: 'verhuur@stuiterbaas.nl',
  STUITERBAAS_FROM_EMAIL: 'Stuiterbaas Reserveringen <reserveringen@stuiterbaas.nl>',
  LATTENSPECIALIST_ORIGINS: `${lattenOrigin},https://www.lattenspecialist.nl`,
  LATTENSPECIALIST_TO_EMAIL: 'info@lattenspecialist.nl',
  LATTENSPECIALIST_FROM_EMAIL: 'De Lattenspecialist via Stuiterbaas <reserveringen@stuiterbaas.nl>',
  TURNSTILE_SECRET_KEY: 'stuiter-secret',
  LATTENSPECIALIST_TURNSTILE_SECRET_KEY: 'latten-secret',
  RESEND_API_KEY: 'resend-secret'
};
const lattenPayload = {service: 'Onderhoud', material: 'Ski', amount: '1', package: 'Goud', logistics: 'Zelf brengen in Wamel', pickupday: 'Vrijdag', urgent: 'Nee', destination: 'Sölden', skidate: '2099-12-01', conditions: 'Koud', name: 'Peter', phone: '06 12 34 56 78', email: 'peter@example.nl', postcode: '6659 BB', address: 'Wamel', notes: 'Lichte kras', privacyConsent: true, website: '', turnstileToken: 'verified-token'};
const stuiterPayload = {name: 'Peter', phone: '06 12 34 56 78', email: 'peter@example.nl', date: '2099-06-12', location: 'Wamel', startTime: '10:00', endTime: '18:00', notes: 'Graag bellen.', privateSite: true, powerAvailable: true, adultHelper: true, privacyConsent: true, website: '', turnstileToken: 'verified-token'};

assert.equal(getSite(lattenOrigin, baseEnv), 'lattenspecialist');
assert.equal(getSite(stuiterOrigin, baseEnv), 'stuiterbaas');
assert.equal(getSite('https://example.com', baseEnv), null);
assert.equal(readAndValidateLattenspecialist(lattenPayload).data.package, 'Goud');
assert.equal(readAndValidateStuiterbaas(stuiterPayload).data.name, 'Peter');
assert.equal(escapeHtml('<script>&"\''), '&lt;script&gt;&amp;&quot;&#039;');
assert.match(createReference(), /^LS-\d{4}-[A-Z2-9]{6}$/);
assert.throws(() => readAndValidateLattenspecialist({...lattenPayload, email: 'fout'}), /e-mailadres/);
assert.throws(() => readAndValidateStuiterbaas({...stuiterPayload, privateSite: false}), /voorwaarden/);

const blocked = await worker.fetch(new Request('https://worker.example', {method: 'POST', headers: {Origin: 'https://example.com', 'Content-Type': 'application/json'}, body: JSON.stringify(lattenPayload)}), baseEnv);
assert.equal(blocked.status, 403);
for (const origin of [stuiterOrigin, lattenOrigin]) {
  const preflight = await worker.fetch(new Request('https://worker.example', {method: 'OPTIONS', headers: {Origin: origin}}), baseEnv);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
}

const requests = [];
const stored = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  requests.push({url: String(url), options});
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({success: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
  return new Response(JSON.stringify({id: 'email-test'}), {status: 200, headers: {'Content-Type': 'application/json'}});
};
try {
  const lattenResponse = await worker.fetch(new Request('https://worker.example', {method: 'POST', headers: {Origin: lattenOrigin, 'Content-Type': 'application/json'}, body: JSON.stringify(lattenPayload)}), {...baseEnv, LATTENSPECIALIST_RESERVATIONS_KV: {put: async (...args) => stored.push(args)}});
  const lattenResult = await lattenResponse.json();
  assert.equal(lattenResponse.status, 202);
  assert.match(lattenResult.reference, /^LS-/);
  const lattenMessage = JSON.parse(requests[1].options.body);
  assert.deepEqual(lattenMessage.to, ['info@lattenspecialist.nl']);
  assert.match(lattenMessage.subject, /^\[Lattenspecialist aanvraag\].*Onderhoud/);
  assert.match(lattenMessage.text, /Bestemming: Sölden/);
  assert.equal(stored.length, 1);

  requests.length = 0;
  const stuiterResponse = await worker.fetch(new Request('https://worker.example', {method: 'POST', headers: {Origin: stuiterOrigin, 'Content-Type': 'application/json'}, body: JSON.stringify(stuiterPayload)}), baseEnv);
  assert.equal(stuiterResponse.status, 202);
  const stuiterMessage = JSON.parse(requests[1].options.body);
  assert.deepEqual(stuiterMessage.to, ['verhuur@stuiterbaas.nl']);
  assert.match(stuiterMessage.subject, /Reserveringsaanvraag/);
  assert.match(stuiterMessage.text, /privéterrein/);
} finally {
  globalThis.fetch = nativeFetch;
}
console.log('Combined worker tests passed for Stuiterbaas and Lattenspecialist.');
