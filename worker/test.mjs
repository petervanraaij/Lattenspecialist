import assert from 'node:assert/strict';
import worker, {STATUS_STEPS, createReference, createServiceCode, escapeHtml, getSite, normalizeServiceCode, readAndValidateLattenspecialist, readAndValidateStuiterbaas} from './src/index.js';

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
  LATTENSPECIALIST_ADMIN_TOKEN: 'admin-secret-test',
  RESEND_API_KEY: 'resend-secret'
};
const lattenPayload = {service: 'Onderhoud', material: 'Ski', amount: '1', package: 'Goud', logistics: 'Gratis ophalen & terugbrengen (servicegebied)', pickupDate: '2099-11-28', urgent: 'Nee', destination: 'Sölden', skidate: '2099-12-01', conditions: 'Koud', name: 'Peter', phone: '06 12 34 56 78', email: 'peter@example.nl', postcode: '6659 BB', houseNumber: '13', address: 'Hollenhof 13, 6659 BB Wamel', addressCity: 'Wamel', notes: 'Lichte kras', privacyConsent: true, whatsappConsent: true, website: '', turnstileToken: 'verified-token'};
const stuiterPayload = {name: 'Peter', phone: '06 12 34 56 78', email: 'peter@example.nl', date: '2099-06-12', location: 'Wamel', startTime: '10:00', endTime: '18:00', notes: 'Graag bellen.', privateSite: true, powerAvailable: true, adultHelper: true, privacyConsent: true, website: '', turnstileToken: 'verified-token'};

assert.equal(getSite(lattenOrigin, baseEnv), 'lattenspecialist');
assert.equal(getSite('capacitor://localhost', baseEnv), 'lattenspecialist');
assert.equal(getSite('https://localhost', baseEnv), 'lattenspecialist');
assert.equal(getSite(stuiterOrigin, baseEnv), 'stuiterbaas');
assert.equal(getSite('https://example.com', baseEnv), null);
assert.equal(readAndValidateLattenspecialist(lattenPayload).data.package, 'Goud');
assert.equal(readAndValidateStuiterbaas(stuiterPayload).data.name, 'Peter');
assert.equal(escapeHtml('<script>&"\''), '&lt;script&gt;&amp;&quot;&#039;');
assert.match(createReference(), /^LS-\d{4}-[A-Z2-9]{6}$/);
assert.match(createServiceCode(), /^LS-[A-Z2-9]{6}$/);
assert.equal(normalizeServiceCode(' ls-ab2cde '), 'LS-AB2CDE');
assert.equal(STATUS_STEPS.length, 8);
assert.throws(() => readAndValidateLattenspecialist({...lattenPayload, email: 'fout'}), /e-mailadres/);
assert.throws(() => readAndValidateLattenspecialist({...lattenPayload, addressCity: 'Deest'}), /buiten het gratis servicegebied/);
assert.throws(() => readAndValidateStuiterbaas({...stuiterPayload, privateSite: false}), /voorwaarden/);

const blocked = await worker.fetch(new Request('https://worker.example', {method: 'POST', headers: {Origin: 'https://example.com', 'Content-Type': 'application/json'}, body: JSON.stringify(lattenPayload)}), baseEnv);
assert.equal(blocked.status, 403);
for (const origin of [stuiterOrigin, lattenOrigin]) {
  const preflight = await worker.fetch(new Request('https://worker.example', {method: 'OPTIONS', headers: {Origin: origin}}), baseEnv);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
}

const requests = [];
class MemoryKV {
  constructor() { this.values = new Map(); }
  async put(key, value) { this.values.set(key, String(value)); }
  async get(key, type) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }
  async list({prefix = ''} = {}) {
    return {keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({name})), list_complete: true};
  }
}
const store = new MemoryKV();
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  requests.push({url: String(url), options});
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({success: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
  if (String(url).includes('api.pdok.nl')) return new Response(JSON.stringify({response: {docs: [{postcode: '6659BB', huisnummer: 13, huis_nlt: '13', straatnaam: 'Hollenhof', woonplaatsnaam: 'Wamel'}]}}), {status: 200, headers: {'Content-Type': 'application/json'}});
  return new Response(JSON.stringify({id: 'email-test'}), {status: 200, headers: {'Content-Type': 'application/json'}});
};
try {
  const testEnv = {...baseEnv, LATTENSPECIALIST_RESERVATIONS_KV: store};
  const adminHeaders = {Origin: lattenOrigin, Authorization: 'Bearer admin-secret-test', 'Content-Type': 'application/json'};
  const saveDates = await worker.fetch(new Request('https://worker.example/api/admin/availability', {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({dates: ['2099-11-28', '2099-12-05']})}), testEnv);
  assert.equal(saveDates.status, 200);
  const publicDates = await worker.fetch(new Request('https://worker.example/api/availability', {method: 'GET', headers: {Origin: lattenOrigin}}), testEnv);
  assert.deepEqual((await publicDates.json()).dates, ['2099-11-28', '2099-12-05']);
  const addressResponse = await worker.fetch(new Request('https://worker.example/api/address?postcode=6659BB&houseNumber=13', {headers: {Origin: lattenOrigin}}), testEnv);
  const addressResult = await addressResponse.json();
  assert.equal(addressResponse.status, 200);
  assert.equal(addressResult.address.address, 'Hollenhof 13, 6659 BB Wamel');
  assert.equal(addressResult.address.freePickup, true);
  requests.length = 0;
  const lattenResponse = await worker.fetch(new Request('https://worker.example', {method: 'POST', headers: {Origin: lattenOrigin, 'Content-Type': 'application/json'}, body: JSON.stringify(lattenPayload)}), testEnv);
  const lattenResult = await lattenResponse.json();
  assert.equal(lattenResponse.status, 202);
  assert.match(lattenResult.reference, /^LS-/);
  const lattenMessage = JSON.parse(requests[1].options.body);
  assert.deepEqual(lattenMessage.to, ['info@lattenspecialist.nl']);
  assert.match(lattenMessage.subject, /^\[Lattenspecialist aanvraag\].*Onderhoud/);
  assert.match(lattenMessage.text, /Bestemming: Sölden/);
  assert.match(lattenMessage.text, /WhatsApp-statusupdates: Ja, toestemming gegeven/);
  assert.match(lattenMessage.text, /Ophaaldatum: 2099-11-28/);
  assert.deepEqual(JSON.parse(requests[2].options.body).to, ['peter@example.nl']);
  assert.equal((await store.list({prefix: 'reservation:'})).keys.length, 1);

  const unauthorized = await worker.fetch(new Request('https://worker.example/api/admin/reservations', {method: 'GET', headers: {Origin: lattenOrigin}}), testEnv);
  assert.equal(unauthorized.status, 401);

  const adminList = await worker.fetch(new Request('https://worker.example/api/admin/reservations', {method: 'GET', headers: adminHeaders}), testEnv);
  const adminResult = await adminList.json();
  assert.equal(adminList.status, 200);
  assert.equal(adminResult.records.length, 1);
  assert.equal(adminResult.records[0].email, lattenPayload.email);
  assert.equal(adminResult.records[0].whatsappConsent, true);

  const updateResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({generateServiceCode: true, currentStep: 4, status: STATUS_STEPS[3], expectedReady: '2099-12-03', note: 'Kanten gecontroleerd.', whatsappConsent: false, waxType: 'Premium koudweerwax', paymentAmount: '44.95', paymentUrl: 'https://example.test/betalen'})}), testEnv);
  const updateResult = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.match(updateResult.record.serviceCode, /^LS-[A-Z2-9]{6}$/);
  assert.equal(updateResult.record.currentStep, 4);
  assert.equal(updateResult.record.whatsappConsent, false);
  assert.equal(updateResult.record.waxType, 'Premium koudweerwax');
  assert.equal(updateResult.record.paymentAmount, '44.95');

  const consentResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({currentStep: 4, whatsappConsent: true, sendStatusEmail: true, sendWhatsApp: true})}), testEnv);
  const consentResult = await consentResponse.json();
  assert.equal(consentResponse.status, 200);
  assert.equal(consentResult.record.whatsappConsent, true);
  assert.equal(consentResult.notifications.email.sent, true);
  assert.equal(consentResult.notifications.whatsapp.reason, 'not_configured');

  const paymentResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({sendPaymentEmail: true})}), testEnv);
  const paymentResult = await paymentResponse.json();
  assert.equal(paymentResult.notifications.paymentEmail.sent, true);

  const closeResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({closed: true})}), testEnv);
  assert.ok((await closeResponse.json()).record.closedAt);

  const statusResponse = await worker.fetch(new Request(`https://worker.example/api/status/${updateResult.record.serviceCode}`, {method: 'GET', headers: {Origin: lattenOrigin}}), testEnv);
  const statusResult = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResult.record.status, STATUS_STEPS[3]);
  assert.equal(statusResult.record.email, undefined);
  assert.equal(statusResult.record.phone, undefined);
  assert.equal(statusResult.record.waxType, 'Premium koudweerwax');

  const whatsappEnv = {...testEnv, WHATSAPP_ACCESS_TOKEN: 'meta-test', WHATSAPP_PHONE_NUMBER_ID: '123456', LATTENSPECIALIST_WHATSAPP_STATUS_TEMPLATE: 'status_update'};
  const autoWhatsappResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({currentStep: 5, status: STATUS_STEPS[4], whatsappConsent: true, sendWhatsApp: true})}), whatsappEnv);
  const autoWhatsappResult = await autoWhatsappResponse.json();
  assert.equal(autoWhatsappResult.notifications.whatsapp.sent, true);
  assert.ok(requests.some(request => request.url.includes('graph.facebook.com/v23.0/123456/messages')));
  const statusMessage = JSON.parse(requests.findLast(request => request.url.includes('graph.facebook.com')).options.body);
  assert.equal(statusMessage.template.components[0].parameters[3].text, `https://lattenspecialist.nl/app.html#status=${updateResult.record.serviceCode}`);

  // First status notification must already contain a working personal link.
  const newReference = 'LS-2609-NEW234';
  await store.put(`reservation:${newReference}`, JSON.stringify({...adminResult.records[0], reference:newReference, serviceCode:null}));
  const firstNotify = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`, {method:'PATCH',headers:adminHeaders,body:JSON.stringify({sendWhatsApp:true,sendStatusEmail:true})}),whatsappEnv);
  const firstResult = await firstNotify.json();
  assert.equal(firstNotify.status,200);
  const personalCode = firstResult.record.serviceCode;
  assert.match(personalCode,/^LS-[A-Z2-9]{6}$/);
  assert.equal(await store.get(`service:${personalCode}`),newReference);
  const personalUrl = `https://lattenspecialist.nl/app.html#status=${personalCode}`;
  const firstEmail = JSON.parse(requests.findLast(request => request.url.includes('api.resend.com')).options.body);
  assert.ok(firstEmail.text.includes(personalUrl));
  assert.ok(firstEmail.html.includes(`href="${personalUrl}"`));
  const firstWhatsApp = JSON.parse(requests.findLast(request => request.url.includes('graph.facebook.com')).options.body);
  assert.equal(firstWhatsApp.template.components[0].parameters[3].text,personalUrl);
  const followup = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`, {method:'PATCH',headers:adminHeaders,body:JSON.stringify({sendWhatsApp:true})}),whatsappEnv);
  assert.equal((await followup.json()).record.serviceCode,personalCode);
  const directStatus = await worker.fetch(new Request(`https://worker.example/api/status/${personalCode}`,{headers:{Origin:lattenOrigin}}),testEnv);
  const directRecord = (await directStatus.json()).record;
  assert.equal(directRecord.code,personalCode);
  for (const field of ['name','email','phone','address','postcode','paymentUrl']) assert.equal(directRecord[field],undefined);

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
console.log('Combined worker, reservation management and public status tests passed.');
