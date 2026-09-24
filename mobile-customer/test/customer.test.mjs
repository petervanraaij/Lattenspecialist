import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {normalizeCode, validCode, validDate, readTrip, renderStatus, codeFromAppLink} from '../src/domain.js';

const html=await readFile(new URL('../www/index.html',import.meta.url),'utf8');
const bundle=await readFile(new URL('../www/customer.js',import.meta.url),'utf8');
const site=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const embed=await readFile(new URL('../../customer-booking.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setTimeout(resolve,20));
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>String(body)});
const record={code:'LS-ABC234',material:'1× Ski',currentStep:5,status:'Onderhoud gestart',waxType:'Premium koud',updatedAt:'2026-09-23T16:00:00Z'};
function app(t,fetcher,{hash='',saved=''}={}) {
  const dom=new JSDOM(html,{url:`https://localhost/${hash}`,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window;
  w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example'};
  if(saved)w.localStorage.setItem('lattenspecialist-customer-code',saved);
  const requests=[];
  w.fetch=async url=>{requests.push(url);return url.includes('/api/availability')?reply({dates:[]}):fetcher(url);};
  w.eval(bundle);
  return {w,d:w.document,requests};
}
function submit(w,d,code) {d.getElementById('serviceCode').value=code;d.getElementById('statusForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}

test('servicecodes distinguish public status from booking references; trip dates are real dates',()=>{
  assert.equal(normalizeCode(' ls-abc234 '),'LS-ABC234');
  assert.equal(validCode('LS-ABC234'),true);
  assert.equal(validCode('LS-2609-ABC234'),false);
  assert.equal(validDate('2027-02-30'),false);
  assert.equal(validDate('2027-13-01'),false);
  assert.equal(readTrip({destination:'Sölden',skidate:'2027-02-20',conditions:'injected'}).conditions,'Weet ik nog niet');
});
test('personal WhatsApp link opens only its status without input or silently remembering it',async t=>{
  const {w,d,requests}=app(t,async()=>reply({record}),{hash:'#status=LS-ABC234',saved:'LS-DEF567'});
  await turn();
  assert.equal(d.getElementById('onderhoud').hidden,false);
  assert.equal(d.getElementById('statusForm').hidden,true);
  assert.match(d.getElementById('statusResult').textContent,/Onderhoud gestart/);
  assert.deepEqual(requests,['https://api.example/api/status/LS-ABC234']);
  assert.equal(w.location.hash,'#onderhoud');
  assert.equal(w.localStorage.getItem('lattenspecialist-customer-code'),null);
  d.getElementById('changeCode').click();
  assert.equal(d.getElementById('statusForm').hidden,false);
});
test('invalid personal link cannot load a previously saved customers status',async t=>{
  const {d,requests}=app(t,async()=>reply({record}),{hash:'#status=LS-2609-ABC234',saved:'LS-DEF567'});
  await turn();
  assert.equal(requests.length,0);
  assert.equal(d.getElementById('statusForm').hidden,false);
  assert.match(d.getElementById('codeFeedback').textContent,/link is niet geldig/);
  assert.equal(d.getElementById('statusResult').textContent,'');
});

test('personal link retries a network failure without asking for a code or installing',async t=>{
  let attempts=0;
  const {d}=app(t,async()=>{if(++attempts===1)throw new Error('offline');return reply({record});},{hash:'#status=LS-ABC234'});
  await turn();
  assert.equal(d.getElementById('statusForm').hidden,true);
  assert.match(d.getElementById('statusResult').textContent,/Opnieuw proberen/);
  d.querySelector('#statusResult button').click();await turn();
  assert.equal(d.getElementById('statusForm').hidden,true);
  assert.match(d.getElementById('statusResult').textContent,/Onderhoud gestart/);
  assert.doesNotMatch(d.getElementById('statusIntro').textContent,/wordt opgehaald/);
});
test('another incoming personal link supersedes an in-flight status request',async t=>{
  let resolveOld;
  const {w,d}=app(t,url=>url.endsWith('LS-ABC234')?new Promise(done=>{resolveOld=done;}):Promise.resolve(reply({record:{...record,code:'LS-DEF567',status:'Tweede aanvraag'}})),{hash:'#status=LS-ABC234'});
  w.location.hash='status=LS-DEF567';await turn();
  resolveOld(reply({record}));await turn();
  assert.match(d.getElementById('statusResult').textContent,/Tweede aanvraag/);
  assert.doesNotMatch(d.getElementById('statusResult').textContent,/LS-ABC234/);
});
test('native app accepts only exact official HTTPS personal app links',()=>{
  assert.equal(codeFromAppLink('https://lattenspecialist.nl/app.html#status=LS-ABC234'),'LS-ABC234');
  for(const url of ['https://evil.example/app.html#status=LS-ABC234','https://lattenspecialist.nl.evil.example/app.html#status=LS-ABC234','http://lattenspecialist.nl/app.html#status=LS-ABC234','https://lattenspecialist.nl/other#status=LS-ABC234','https://user@lattenspecialist.nl/app.html#status=LS-ABC234','https://lattenspecialist.nl/app.html?redirect=evil#status=LS-ABC234','https://lattenspecialist.nl/app.html#status=%E0%A4%A'])assert.equal(codeFromAppLink(url),'');
});
test('status renders only escaped public fields, selected wax, and closure without false completion',()=>{
  const output=renderStatus({...record,material:'<img onerror=alert(1)>',note:'<script>x</script>',closed:true});
  assert.match(output,/Premium koud/);
  assert.match(output,/Afgemeld/);
  assert.doesNotMatch(output,/<script>|<img|status-steps/);
});
test('customer can fetch status without an admin code and explicitly remember or forget it',async t=>{
  const {w,d,requests}=app(t,async()=>reply({record}));
  d.getElementById('rememberCode').checked=true;
  submit(w,d,' ls-abc234 '); await turn();
  assert.match(d.getElementById('statusResult').textContent,/Premium koud/);
  assert.equal(w.localStorage.getItem('lattenspecialist-customer-code'),'LS-ABC234');
  assert.ok(requests.every(url=>!url.includes('/admin/')));
  d.getElementById('forgetCode').click();
  assert.equal(w.localStorage.getItem('lattenspecialist-customer-code'),null);
  assert.equal(d.getElementById('statusResult').textContent,'');
});
test('a late response cannot restore a forgotten code or show another request',async t=>{
  let resolve;
  const {w,d}=app(t,()=>new Promise(done=>{resolve=done;}));
  d.getElementById('rememberCode').checked=true;
  submit(w,d,'LS-ABC234');
  d.getElementById('forgetCode').click();
  resolve(reply({record})); await turn();
  assert.equal(d.getElementById('statusResult').textContent,'');
  assert.equal(w.localStorage.getItem('lattenspecialist-customer-code'),null);
});
test('network failure replaces previous status; invalid request codes are never sent',async t=>{
  let failing=false;
  const {w,d,requests}=app(t,async()=>{if(failing)throw new Error('offline');return reply({record});});
  submit(w,d,'LS-ABC234');await turn();
  failing=true;d.getElementById('refreshStatus').click();await turn();
  assert.match(d.getElementById('statusResult').textContent,/niet worden opgehaald/);
  assert.doesNotMatch(d.getElementById('statusResult').textContent,/Premium koud/);
  const before=requests.length;submit(w,d,'LS-2609-ABC234');
  assert.equal(requests.length,before);
  assert.match(d.getElementById('codeFeedback').textContent,/aanvraagcode/);
});
test('packages use current website prices and include starting-price labels unchanged',async t=>{
  const {w,d}=app(t,async url=>url.endsWith('aanbod.json')?reply({items:[]}):reply(site));
  w.location.hash='aanbod';await turn();await turn();
  const source=new JSDOM(site).window.document;
  assert.equal(d.querySelectorAll('#packages .card').length,4);
  assert.deepEqual([...d.querySelectorAll('#packages .price-row strong')].map(el=>el.textContent),[...source.querySelectorAll('#pakketten .price-row strong')].map(el=>el.textContent));
  assert.match(d.getElementById('packages').textContent,/Ski vanaf/);
  assert.match(d.getElementById('inventory').textContent,/geen vast openbaar aanbod/);
});
test('trip transfers only after user action and only to verified booking frame',async t=>{
  const {w,d}=app(t,async()=>reply({record}));
  const form=d.getElementById('tripForm');form.elements.destination.value='Sölden';form.elements.skidate.value='2099-02-20';
  d.getElementById('tripBooking').click();await turn();
  const frame=d.getElementById('bookingFrame');const sent=[];
  frame.contentWindow.postMessage=(message,origin)=>sent.push({message,origin});
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://evil.example',source:frame.contentWindow,data:{type:'lattenspecialist:ready'}}));
  assert.equal(sent.length,0);
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://lattenspecialist.nl',source:frame.contentWindow,data:{type:'lattenspecialist:ready'}}));
  assert.equal(sent.length,1);
  assert.equal(sent[0].origin,'https://lattenspecialist.nl');
  assert.equal(sent[0].message.values.destination,'Sölden');
  assert.equal(w.localStorage.getItem('lattenspecialist-customer-trip'),null);
});
test('website form stays unchanged without app flag and embed rejects untrusted prefill',async t=>{
  const dom=new JSDOM(site,{url:'https://lattenspecialist.nl/?app=klant',runScripts:'outside-only'});
  t.after(()=>dom.window.close());const w=dom.window;
  w.ResizeObserver=class {observe(){}};
  w.eval(embed);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const message={type:'lattenspecialist:prefill',values:{service:'Verhuur',destination:'Untrusted'}};
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://evil.example',source:w.parent,data:message}));
  assert.equal(w.document.querySelector('[name=destination]').value,'');
  assert.equal(w.document.querySelector('[name=service]:checked').value,'Onderhoud');
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://localhost',source:w.parent,data:{type:'lattenspecialist:hello'}}));
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://localhost',source:w.parent,data:{type:'lattenspecialist:prefill',values:{service:'Verhuur',destination:'Sölden',skidate:'2099-02-20',conditions:'Koud',package:'Not a package'}}}));
  assert.equal(w.document.querySelector('[name=service]:checked').value,'Verhuur');
  assert.equal(w.document.querySelector('[name=destination]').value,'Sölden');
  assert.equal(w.document.querySelector('[name=conditions]').value,'Koud');
  assert.notEqual(w.document.querySelector('[name=package]').value,'Not a package');
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.parent,data:{type:'lattenspecialist:hello'}}));
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.parent,data:{type:'lattenspecialist:prefill',values:{destination:'Davos'}}}));
  assert.equal(w.document.querySelector('[name=destination]').value,'Davos');
  const plain=new JSDOM(site,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});t.after(()=>plain.window.close());plain.window.eval(embed);
  assert.equal(plain.window.document.documentElement.classList.contains('customer-booking'),false);
});
