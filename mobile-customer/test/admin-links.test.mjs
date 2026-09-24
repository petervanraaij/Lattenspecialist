import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html = await readFile(new URL('../../beheer.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../../beheer.js', import.meta.url), 'utf8');
const turn = () => new Promise(resolve => setTimeout(resolve, 20));
async function admin(t, serviceCode = 'LS-ABC234') {
  const dom = new JSDOM(html, {url:'https://lattenspecialist.nl/beheer.html', runScripts:'outside-only'});
  t.after(() => dom.window.close());
  const w = dom.window;
  w.LATTENSPECIALIST_BOOKING = {endpoint:'https://api.example'};
  w.sessionStorage.setItem('lattenspecialist-admin-token', 'test-only');
  const requests = [];
  w.fetch = async (url, options) => {
    requests.push({url, options});
    return {ok:true, status:200, json:async () => url.endsWith('/reservations') ? {records:[{reference:'LS-2609-ABC234', name:'Testklant', serviceCode, createdAt:'2026-09-24T10:00:00Z'}]} : {dates:[]}};
  };
  w.eval(script); await turn();
  return {w, d:w.document, requests};
}

test('copying a personal customer link never sends a message or uses the reservation reference', async t => {
  const {w, d, requests} = await admin(t);
  const copied = [];
  Object.defineProperty(w.navigator, 'clipboard', {value:{writeText:async value => copied.push(value)}});
  const before = requests.length;
  d.querySelector('.copy-customer-link').click(); await turn();
  assert.deepEqual(copied, ['https://lattenspecialist.nl/app.html#status=LS-ABC234']);
  assert.equal(requests.length, before);
  assert.match(d.querySelector('.customer-link-message').textContent, /gekopieerd/);
  assert.equal(d.querySelector('.admin-customer-link a').href, copied[0]);
});

test('clipboard denial selects the correct link for manual copying', async t => {
  const {d} = await admin(t);
  d.querySelector('.copy-customer-link').click(); await turn();
  const input = d.querySelector('.customer-status-link');
  assert.equal(d.activeElement, input);
  assert.equal(input.selectionEnd, input.value.length);
  assert.match(d.querySelector('.customer-link-message').textContent, /geselecteerd/);
});

test('no personal link is shown until a valid maintenance code exists', async t => {
  for (const code of [null, 'LS-2609-ABC234']) {
    const {d} = await admin(t, code);
    assert.equal(d.querySelector('.copy-customer-link'), null);
    assert.match(d.querySelector('.admin-update-form').textContent, /persoonlijke klantlink/);
  }
});

test('admin publishes payments only to the app and reports notification availability honestly', async t => {
  const {w,d} = await admin(t);
  const payloads = [], token = 'c'.repeat(64);
  w.CSS = {escape:value=>value};
  w.fetch = async (url,options) => {
    const payload = JSON.parse(options.body); payloads.push(payload);
    return {ok:true,status:200,json:async()=>({record:{reference:'LS-2609-ABC234',name:'Testklant',serviceCode:'LS-ABC234',customerToken:token,...payload,paymentRequestedAt:'2026-09-24T10:00:00Z'},notifications:{push:{reason:'not_subscribed'}}})};
  };
  d.querySelector('[name="paymentAmount"]').value='44,95';
  d.querySelector('[name="paymentUrl"]').value='https://example.test/pay';
  d.querySelector('[data-action="payment"]').click(); await turn();
  assert.equal(payloads[0].publishPayment,true);
  assert.equal(payloads[0].paymentAmount,'44.95');
  for (const flag of ['sendStatusEmail','sendPaymentEmail','sendWhatsApp']) assert.equal(payloads[0][flag],undefined);
  assert.match(d.querySelector('#adminList .admin-record-message').textContent,/nog geen telefoonmeldingen/);
  assert.equal(d.querySelector('.customer-status-link').value,`https://lattenspecialist.nl/app.html#klant=${token}`);
  d.querySelector('[name="paymentPaid"]').checked=true;
  d.querySelector('[data-action="save"]').click(); await turn();
  assert.equal(payloads[1].paymentPaid,true);
  assert.equal(payloads[1].publishPayment,undefined);
});
