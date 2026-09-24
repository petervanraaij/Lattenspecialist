import assert from 'node:assert/strict';
import {createECDH, hkdfSync, createDecipheriv} from 'node:crypto';
import {validateEndpoint} from './src/push.js';
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
  async delete(key) { this.values.delete(key); }
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
  assert.match(lattenMessage.text, /Ophaaldatum: 2099-11-28/);
  assert.equal(requests.length, 2, 'Only verification and owner email; no customer email');
  assert.equal(lattenResult.confirmationChannel, 'app');
  assert.equal((await store.list({prefix: 'reservation:'})).keys.length, 1);
  assert.match(lattenResult.customerToken, /^[a-f0-9]{64}$/);
  const customerGet = async token => worker.fetch(new Request('https://worker.example/api/customer/status', {headers:{Origin:lattenOrigin,Authorization:`Bearer ${token}`}}), testEnv);
  const customerRecord = async token => (await (await customerGet(token)).json()).record;
  const firstView = await customerRecord(lattenResult.customerToken);
  assert.equal(firstView.currentStep, 1);
  assert.deepEqual(firstView.payment, {state:'none'});
  assert.match(firstView.code, /^LS-[A-Z2-9]{6}$/);
  assert.equal((await customerGet(firstView.code)).status, 401);
  assert.equal((await customerGet('0'.repeat(64))).status, 404);
  for (const field of ['name','email','phone','address','postcode','customerToken','notes','reference']) assert.equal(firstView[field], undefined);

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
  assert.equal(updateResult.record.customerToken, lattenResult.customerToken);
  assert.deepEqual((await customerRecord(lattenResult.customerToken)).payment, {state:'none'}, 'Saving a draft must not publish a payment link');

  const consentResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({currentStep: 4, whatsappConsent: true, sendStatusEmail: true, sendWhatsApp: true})}), testEnv);
  const consentResult = await consentResponse.json();
  assert.equal(consentResponse.status, 200);
  assert.equal(consentResult.record.whatsappConsent, true);
  assert.equal(consentResult.notifications.email.sent, false);
  assert.equal(consentResult.notifications.whatsapp.reason, 'app_only');

  const paymentResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({sendPaymentEmail: true})}), testEnv);
  const paymentResult = await paymentResponse.json();
  assert.equal(paymentResult.notifications.paymentEmail.sent, false);
  const paymentView = await customerRecord(lattenResult.customerToken);
  assert.deepEqual(paymentView.payment, {state:'open',amount:'44.95',url:'https://example.test/betalen'});
  assert.equal((await customerGet(lattenResult.customerToken)).headers.get('Cache-Control'), 'no-store');
  const publicPayment = await worker.fetch(new Request(`https://worker.example/api/status/${updateResult.record.serviceCode}`,{headers:{Origin:lattenOrigin}}),testEnv);
  assert.equal((await publicPayment.json()).record.payment, undefined);
  const patchPayment = async values => worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`,{method:'PATCH',headers:adminHeaders,body:JSON.stringify(values)}),testEnv);
  assert.equal((await patchPayment({paymentPaid:true})).status,200);
  const paid = await customerRecord(lattenResult.customerToken);
  assert.equal(paid.payment.state,'paid');
  assert.equal(paid.payment.url,undefined);
  assert.equal((await patchPayment({sendPaymentEmail:true})).status,400,'Do not send another request for a registered payment');
  assert.equal((await patchPayment({paymentAmount:'49.95'})).status,200);
  assert.deepEqual((await customerRecord(lattenResult.customerToken)).payment,{state:'none'},'A changed amount requires republication');
  assert.equal((await patchPayment({paymentUrl:'https://bank@example.test/pay'})).status,400);
  assert.equal((await patchPayment({paymentUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await patchPayment({sendPaymentEmail:true})).status,200);

  const closeResponse = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${lattenResult.reference}`, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify({closed: true})}), testEnv);
  assert.ok((await closeResponse.json()).record.closedAt);
  assert.deepEqual((await customerRecord(lattenResult.customerToken)).payment,{state:'withdrawn'});
  assert.equal((await patchPayment({sendPaymentEmail:true})).status,400);

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
  assert.equal(autoWhatsappResult.notifications.whatsapp.sent, false);
  assert.ok(!requests.some(request => request.url.includes('graph.facebook.com')));

  // First status notification must already contain a working personal link.
  const newReference = 'LS-2609-NEW234';
  await store.put(`reservation:${newReference}`, JSON.stringify({...adminResult.records[0], reference:newReference, serviceCode:null,customerToken:null}));
  const firstNotify = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`, {method:'PATCH',headers:adminHeaders,body:JSON.stringify({sendWhatsApp:true,sendStatusEmail:true})}),whatsappEnv);
  const firstResult = await firstNotify.json();
  assert.equal(firstNotify.status,200);
  const personalCode = firstResult.record.serviceCode;
  assert.match(personalCode,/^LS-[A-Z2-9]{6}$/);
  assert.equal(await store.get(`service:${personalCode}`),newReference);
  const personalUrl = `https://lattenspecialist.nl/app.html#klant=${firstResult.record.customerToken}`;
  assert.notEqual(firstResult.record.customerToken,lattenResult.customerToken);
  assert.equal((await customerRecord(firstResult.record.customerToken)).code,personalCode);
  assert.equal((await customerRecord(lattenResult.customerToken)).code,updateResult.record.serviceCode);
  assert.equal(firstResult.notifications.email.reason, 'app_only');
  assert.equal(firstResult.notifications.whatsapp.reason, 'app_only');
  assert.equal(requests.filter(request => request.url.includes('api.resend.com')).length, 1, 'Updates and payments never email a customer');
  const followup = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`, {method:'PATCH',headers:adminHeaders,body:JSON.stringify({sendWhatsApp:true})}),whatsappEnv);
  assert.equal((await followup.json()).record.serviceCode,personalCode);
  const directStatus = await worker.fetch(new Request(`https://worker.example/api/status/${personalCode}`,{headers:{Origin:lattenOrigin}}),testEnv);
  const directRecord = (await directStatus.json()).record;
  assert.equal(directRecord.code,personalCode);
  for (const field of ['name','email','phone','address','postcode','paymentUrl']) assert.equal(directRecord[field],undefined);
  const writeAttempt = await worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`,{method:'PATCH',headers:{Origin:lattenOrigin,Authorization:`Bearer ${firstResult.record.customerToken}`},body:JSON.stringify({paymentPaid:true})}),testEnv);
  assert.equal(writeAttempt.status,401,'A customer token cannot change an order or payment');

  // A real encrypted Web Push payload is generated, but all network delivery is mocked.
  const vapid = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk',vapid.privateKey);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url');
  const pushEnv = {...testEnv,VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:privateJwk.d};
  const receiver = createECDH('prime256v1'); receiver.generateKeys();
  const auth = Buffer.alloc(16, 1);
  const subscription = {endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-test-only',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};
  let deliveryStatus = 201;
  const existingFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://fcm.googleapis.com/')) {
      requests.push({url:String(url),options}); return new Response('',{status:deliveryStatus});
    }
    return existingFetch(url, options);
  };
  const pushApi = async (token,raw) => worker.fetch(new Request('https://worker.example/api/customer/push',{method:'POST',headers:{Origin:lattenOrigin,Authorization:`Bearer ${token}`},body:JSON.stringify(raw)}),pushEnv);
  const pushUpdate = async raw => worker.fetch(new Request(`https://worker.example/api/admin/reservations/${newReference}`,{method:'PATCH',headers:adminHeaders,body:JSON.stringify(raw)}),pushEnv);
  const token = firstResult.record.customerToken;
  assert.equal((await pushApi('invalid',{action:'subscribe',subscription})).status,401);
  assert.equal((await pushApi('0'.repeat(64),{action:'subscribe',subscription})).status,404);
  assert.equal((await pushApi(token,{action:'subscribe',subscription:{...subscription,endpoint:'https://127.0.0.1/private'}})).status,400);
  for (const endpoint of ['http://fcm.googleapis.com/test','https://fcm.googleapis.com.evil.test/test','https://user:pass@fcm.googleapis.com/test','https://fcm.googleapis.com:444/test','https://example.com']) assert.throws(()=>validateEndpoint(endpoint));
  assert.equal((await pushApi(token,{action:'subscribe',subscription:{...subscription,keys:{p256dh:'bad',auth:'bad'}}})).status,400);
  assert.equal((await pushApi(token,{action:'subscribe',subscription})).status,200);
  const statusFor = async (accessToken, action='status') => (await (await pushApi(accessToken,{action,endpoint:subscription.endpoint})).json()).subscribed;
  assert.equal(await statusFor(token),true);
  assert.equal(await statusFor(lattenResult.customerToken),false,'Subscriptions are scoped to a single customer');
  await statusFor(lattenResult.customerToken,'unsubscribe');
  assert.equal(await statusFor(token),true,'Another customer cannot remove this subscription');
  const publicConfig = await (await worker.fetch(new Request('https://worker.example/api/push/config',{headers:{Origin:lattenOrigin}}),pushEnv)).json();
  assert.deepEqual(publicConfig,{ok:true,configured:true,publicKey});
  const notified = await (await pushUpdate({currentStep:6,status:STATUS_STEPS[5]})).json();
  assert.equal(notified.notifications.push.accepted,1);
  const pushRequest = requests.findLast(item=>item.url===subscription.endpoint);
  assert.equal(pushRequest.options.redirect,'error');
  const payload = Buffer.from(pushRequest.options.body);
  assert.ok(!payload.includes(Buffer.from(token)),'Private link must not travel in cleartext');
  // Decrypt using Node crypto and RFC 8291 (independent of the sender library).
  const salt = payload.subarray(0,16), serverPublic = payload.subarray(21,21+payload[20]);
  const shared = receiver.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'),receiver.getPublicKey(),serverPublic]);
  const ikm = hkdfSync('sha256',shared,auth,keyInfo,32);
  const cek = hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16);
  const nonce = hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
  const ciphertext = payload.subarray(21+payload[20]);
  const decipher = createDecipheriv('aes-128-gcm',cek,nonce); decipher.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]).toString().replace(/\x02\x00*$/,'');
  assert.equal(JSON.parse(plain).url,`https://lattenspecialist.nl/app.html#klant=${token}`);
  assert.ok(!plain.includes(lattenPayload.name));
  const pushCount = () => requests.filter(item=>item.url===subscription.endpoint).length;
  const count = pushCount();
  assert.equal((await (await pushUpdate({currentStep:6,status:STATUS_STEPS[5]})).json()).notifications.push.reason,'unchanged');
  assert.equal(pushCount(),count,'Saving unchanged data must not send duplicate notifications');
  deliveryStatus = 503;
  const failedPush = await (await pushUpdate({note:'Nieuwe appstatus'})).json();
  assert.equal(failedPush.ok,true); assert.equal(failedPush.notifications.push.reason,'failed');
  assert.equal((await customerRecord(token)).note,'Nieuwe appstatus','Provider failures do not roll back maintenance');
  deliveryStatus = 410;
  await pushUpdate({note:'Volgende appstatus'});
  assert.equal(await statusFor(token),false,'Expired push subscriptions are removed');
  await pushApi(token,{action:'subscribe',subscription});
  assert.equal(await statusFor(token,'unsubscribe'),false);
  assert.equal((await (await pushUpdate({note:'Geen melding meer'})).json()).notifications.push.reason,'not_subscribed');
  assert.equal(requests.filter(request=>request.url.includes('api.resend.com')).length,1,'No email fallback when push is unavailable');

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
