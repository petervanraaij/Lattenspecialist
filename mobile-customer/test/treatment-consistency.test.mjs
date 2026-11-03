import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {maintenancePriceQuote} from '../../worker/src/maintenance-pricing.js';
const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8');
const [model,overview,booking,options,html,staff,staffCode]=await Promise.all(['maintenance-selection.js','treatment-overview.js','booking.js','service-options.js','afspraak.html','medewerkers.html','medewerkers-workflow.js'].map(read));
const change=(w,input,value)=>{input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));};
const tick=()=>new Promise(r=>setTimeout(r,10));
function page(t,source,url='https://lattenspecialist.nl/afspraak.html'){
 const dom=new JSDOM(source,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.eval(model);w.eval(overview);return{w,d:w.document};
}
test('direct reservation exposes selected standard and premium scope and submits a priced structured work order',async t=>{
 const {w,d}=page(t,html);const posts=[];w.LATTENSPECIALIST_BOOKING={endpoint:'https://example.invalid',turnstileSiteKey:'synthetic-public-key'};w.turnstile={render:()=>1,getResponse:()=> 'synthetic-token',reset:()=>{}};w.fetch=async(url,config={})=>{if(config.method==='POST')posts.push(JSON.parse(config.body));return{ok:true,json:async()=>({ok:true,reference:'LS-2611-TEST01',dates:[]})};};w.eval(options);w.eval(booking);d.querySelector('script[src*=turnstile]').dispatchEvent(new w.Event('load'));const f=d.querySelector('#requestForm');
 change(w,f.elements.package,'Zilver');change(w,f.elements.performanceWax,[...f.elements.performanceWax.options].find(o=>o.dataset.wax==='alpha').value);f.elements.premiumFiling.checked=true;f.elements.premiumFiling.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.match(d.querySelector('#requestTreatmentOverview').textContent,/Racing File S/);assert.match(d.querySelector('#requestTreatmentOverview').textContent,/World Cup/);assert.match(d.querySelector('#requestTreatmentOverview').textContent,/BetaMix Red/);assert.match(d.querySelector('#requestSummary').textContent,/47,45/);
 f.elements.name.value='Fictieve klant';f.elements.phone.value='0612345678';f.elements.email.value='fixture@example.test';f.elements.privacyConsent.checked=true;change(w,f.elements.pickupDate,'In overleg');f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(posts.length,1,JSON.stringify({status:d.querySelector('#bookingStatus').textContent,invalid:[...f.querySelectorAll(':invalid')].map(x=>({name:x.name,value:x.value,message:x.validationMessage}))}));const saved=JSON.parse(posts[0].maintenanceSelection);assert.equal(saved.p.zilver.f,true);assert.equal(saved.p.zilver.w,'alpha');assert.equal(maintenancePriceQuote(saved).knownTotalCents,4745);assert.equal(Object.hasOwn(posts[0],'premiumFiling'),false);
});
test('changing to wax-only removes premium and its surcharge; ordinary scope never promises premium work',t=>{
 const {w,d}=page(t,html);w.eval(options);w.eval(booking);const f=d.querySelector('#requestForm');change(w,f.elements.package,'Zilver');f.elements.premiumFiling.checked=true;change(w,f.elements.package,'Koper');assert.equal(f.elements.premiumFiling.checked,false);assert.equal(f.elements.premiumFiling.disabled,true);assert.match(d.querySelector('#requestSummary').textContent,/19,95/);assert.doesNotMatch(d.querySelector('#requestTreatmentOverview').textContent,/Racing File S/);
});
test('practice preview and posted choice agree on extra wax and premium, with no customer billing',async t=>{
 const {w,d}=page(t,staff,'https://lattenspecialist.nl/medewerkers.html');w.LATTENSPECIALIST_BOOKING={endpoint:'https://example.invalid'};w.sessionStorage.setItem('ls-team-session','synthetic-session');const posts=[];w.fetch=async(url,config)=>{posts.push(JSON.parse(config.body));return{ok:false,json:async()=>({message:'Synthetic preview request captured'})};};w.eval(staffCode);const f=d.querySelector('#practiceForm');change(w,f.elements.finishWax,'ultra');assert.match(d.querySelector('#practiceTreatmentOverview').textContent,/UltraMix Blue/);assert.match(d.querySelector('#practiceTreatmentOverview').textContent,/geen klantfactuur/);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(posts[0].finishWax,'ultra');assert.equal(posts[0].waxProtocol,'yellow-red');change(w,f.elements.activity,'filing');f.elements.premiumFiling.checked=true;f.elements.premiumFiling.dispatchEvent(new w.Event('change',{bubbles:true}));assert.match(d.querySelector('#practiceTreatmentOverview').textContent,/Racing File S/);assert.doesNotMatch(d.querySelector('#practiceTreatmentOverview').textContent,/UltraMix Blue/);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(posts[1].premiumFiling,true);assert.equal(Object.hasOwn(posts[1],'finishWax'),false);
});

test('five visible homepage offers lead directly to choice without a popup and explain optional extras',async t=>{
 const {d}=page(t,await read('index.html'),'https://lattenspecialist.nl/');
 const targetDom=new JSDOM(await read('onderhoud-kiezen.html'));t.after(()=>targetDom.window.close());const targets=targetDom.window.document;
 assert.equal(d.querySelectorAll('.offer-card').length,5);
 assert.equal(d.querySelectorAll('.offer-card select,.offer-card input').length,0);
 assert.equal(d.querySelector('dialog'),null);assert.equal(d.querySelector('script[src*="treatment-offer-popup"]'),null);
 for(const key of ['brons','slijpen','zilver','goud','platinum']){
  const card=d.querySelector(`[data-offer-card=${key}]`),next=card.querySelector('a.btn');
  const target=targets.querySelector(`[data-package=${key}]`);assert.ok(target,`Choice page must contain package ${key}`);
  assert.equal(new URL(next.href).pathname,'/onderhoud-kiezen.html');assert.equal(new URL(next.href).hash,'#'+target.id,`Homepage CTA must target the real ${key} package article`);
  assert.ok([...card.querySelectorAll('li')].every(li=>!li.closest('[hidden]')));
 }
 const explanation=d.getElementById('standaard-en-extra').textContent;
 assert.doesNotMatch(explanation,/Extra’s kies je zelf/);assert.match(explanation,/Je kiest deze extra reiniging/);assert.match(explanation,/diamant medium, daarna met Racing File S/);
 assert.match(explanation,/0 tot −12 °C/);assert.match(explanation,/zwart of transparant herstelmateriaal/i);assert.doesNotMatch(explanation,/gele verbruik apart/);
 assert.doesNotMatch(d.getElementById('haalbreng').textContent,/woensdag erop|week later/);
});
