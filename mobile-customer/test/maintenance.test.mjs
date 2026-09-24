import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderStatus,tokenFromAppLink,tokenFromStatusHash} from '../src/domain.js';

const html=await readFile(new URL('../www/index.html',import.meta.url),'utf8');
const bundle=await readFile(new URL('../www/customer.js',import.meta.url),'utf8');
const token='a'.repeat(64), other='b'.repeat(64), key='lattenspecialist-customer-access';
const record={code:'LS-ABC234',material:'1× Ski',package:'Goud',currentStep:4,status:'Inspectie uitgevoerd',waxType:'Nog te bepalen',updatedAt:'2026-09-24T10:00:00Z',payment:{state:'open',amount:'44.95',url:'https://example.test/pay'}};
const turn=()=>new Promise(resolve=>setTimeout(resolve,20));
const reply=(record,status=200)=>({ok:status===200,status,json:async()=>({record})});
async function app(t,{hash=`#klant=${token}`,session='',saved='',fetcher=async()=>reply(record)}={}) {
  const dom=new JSDOM(html,{url:`https://localhost/${hash}`,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close()); const w=dom.window,d=w.document,requests=[],opened=[];
  w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example'};
  if(session)w.sessionStorage.setItem(key,session);
  if(saved)w.localStorage.setItem(key,saved);
  w.open=(...args)=>opened.push(args);
  w.fetch=async(url,options)=>{requests.push({url,options});return fetcher(url,options);};
  w.eval(bundle); await turn(); return {w,d,requests,opened};
}

test('personal link authenticates outside URLs and opens payment without login, code or installation',async t=>{
  const {w,d,requests,opened}=await app(t);
  assert.equal(d.getElementById('statusForm').hidden,true);
  assert.equal(w.location.hash,'#onderhoud');
  assert.equal(requests[0].url,'https://api.example/api/customer/status');
  assert.equal(requests[0].options.headers.Authorization,`Bearer ${token}`);
  assert.equal(requests[0].options.cache,'no-store');
  assert.equal(w.localStorage.getItem(key),null);
  assert.equal(w.sessionStorage.getItem(key),token);
  assert.match(d.getElementById('statusResult').textContent,/Waxkeuze volgt/);
  assert.equal(opened.length,0);
  d.getElementById('customerPayment').click();
  assert.deepEqual(opened[0],['https://example.test/pay','_blank','noopener,noreferrer']);
  assert.doesNotMatch(d.getElementById('statusResult').textContent,/Betaling ontvangen/);
});

test('reload restores only this tabs access; explicit remember and forget control persistence',async t=>{
  const {w,d}=await app(t,{hash:'#onderhoud',session:token});
  assert.equal(d.getElementById('statusForm').hidden,true);
  d.getElementById('rememberMaintenance').click();
  assert.equal(w.localStorage.getItem(key),token);
  assert.equal(d.getElementById('rememberMaintenance').hidden,true);
  d.getElementById('forgetMaintenance').click();
  assert.equal(w.sessionStorage.getItem(key),null);
  assert.equal(w.localStorage.getItem(key),null);
  assert.equal(d.getElementById('statusResult').textContent,'');
  const reopened=await app(t,{hash:'',saved:token});
  assert.equal(reopened.d.getElementById('onderhoud').hidden,false);
});

test('incoming links cannot reuse another customer or restore a late forgotten response',async t=>{
  const invalid=await app(t,{hash:'#klant=invalid',session:token,saved:token});
  assert.equal(invalid.requests.length,0);
  assert.equal(invalid.w.localStorage.getItem(key),null);
  assert.equal(invalid.w.sessionStorage.getItem(key),null);
  let resolveOld;
  const {w,d}=await app(t,{fetcher:async(url,options)=>options.headers.Authorization===`Bearer ${token}`?new Promise(resolve=>{resolveOld=resolve;}):reply({...record,code:'LS-DEF567',status:'Andere klant'})});
  w.location.hash=`klant=${other}`;await turn();
  resolveOld(reply(record));await turn();
  assert.match(d.getElementById('statusResult').textContent,/Andere klant/);
  assert.doesNotMatch(d.getElementById('statusResult').textContent,/LS-ABC234/);
  d.getElementById('forgetMaintenance').click();
  assert.equal(d.getElementById('customerPayment'),null);
});

test('offline and network failure remove stale payment buttons; retry keeps personal access',async t=>{
  let fail=false;
  const {w,d}=await app(t,{fetcher:async()=>{if(fail)throw new Error('offline');return reply(record);}});
  fail=true;d.getElementById('refreshStatus').click();await turn();
  assert.equal(d.getElementById('customerPayment'),null);
  assert.equal(d.getElementById('statusForm').hidden,true);
  fail=false;d.querySelector('#statusResult button').click();await turn();
  assert.ok(d.getElementById('customerPayment'));
  w.dispatchEvent(new w.Event('offline'));
  assert.equal(d.getElementById('customerPayment'),null);
});

test('only genuine HTTPS app links accepted; payment links escaped and unsafe protocols rejected',()=>{
  assert.equal(tokenFromAppLink(`https://lattenspecialist.nl/app.html#klant=${token}`),token);
  assert.equal(tokenFromStatusHash(`#klant=${token}`),token);
  for(const url of [`https://evil.test/app.html#klant=${token}`,`https://user@lattenspecialist.nl/app.html#klant=${token}`,`https://lattenspecialist.nl/app.html?x=1#klant=${token}`])assert.equal(tokenFromAppLink(url),'');
  for(const url of ['javascript:alert(1)','http://example.test','https://user:pass@example.test'])assert.doesNotMatch(renderStatus({...record,payment:{...record.payment,url}}),/id="customerPayment"/);
  assert.doesNotMatch(renderStatus({...record,closed:true}),/id="customerPayment"|status-steps/);
  assert.doesNotMatch(renderStatus({...record,payment:{state:'paid',amount:'44.95'}}),/id="customerPayment"/);
  assert.match(renderStatus({...record,payment:{state:'paid',amount:'44.95'}}),/Betaling ontvangen/);
  assert.match(renderStatus({...record,material:'<script>oops</script>',note:'<img src=x onerror=oops>'}),/&lt;script&gt;/);
});

test('confirmed booking can open maintenance only from the trusted form frame',async t=>{
  const {w,d}=await app(t,{hash:'#aanvragen'});
  const frame=d.getElementById('bookingFrame');
  const data={type:'lattenspecialist:booked',reference:'LS-2609-ABC234',customerToken:token};
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://evil.test',source:frame.contentWindow,data}));
  assert.equal(d.getElementById('openBookedMaintenance').hidden,true);
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://lattenspecialist.nl',source:frame.contentWindow,data}));
  assert.equal(d.getElementById('openBookedMaintenance').hidden,false);
  d.getElementById('openBookedMaintenance').click();await turn();
  assert.equal(d.getElementById('onderhoud').hidden,false);
  assert.ok(d.getElementById('customerPayment'));
});
