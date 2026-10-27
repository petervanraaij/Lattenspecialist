import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {readAndValidateLattenspecialist} from '../../worker/src/index.js';
const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8');
const [home,selection,choice,options,modal,bookingHtml,booking]=await Promise.all(['index.html','maintenance-selection.js','package-choice.js','service-options.js','test-reservation-modal.js','afspraak.html','booking.js'].map(read));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const change=(w,el,value)=>{el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
function setup(t){
  const dom=new JSDOM(home,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,posts=[];
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://example.invalid',turnstileSiteKey:'test'};
  w.turnstile={render:()=>1,getResponse:()=> 'fake-token',reset:()=>{}};
  w.fetch=async(url,config)=>{posts.push(JSON.parse(config.body));return {ok:true,json:async()=>({ok:true,reference:'LS-2610-ABC234'})};};
  [selection,choice,options,modal].forEach(code=>w.eval(code));
  change(w,d.querySelector('#brons-ski'),'2');d.querySelector('#packageRequest').click();
  const f=d.querySelector('#testReservationForm');f.elements.testName.value='Voorbeeld';f.elements.testPhone.value='0612345678';
  f.querySelectorAll('input[type="checkbox"]').forEach(c=>c.checked=true);
  change(w,f.elements.testPickupWeekend,f.elements.testPickupWeekend.options[1].value);
  return {w,d,f,posts};
}
test('optional cleaning starts at zero, can be declined, and selected extras reach the existing API with correct totals',async t=>{
  const {w,d,f,posts}=setup(t);
  assert.equal(f.elements.firstWaxCount.value,'0');assert.equal(f.elements.waxstickCount.value,'0');
  assert.match(d.querySelector('#testDialogTotal').textContent,/39,90/);
  change(w,f.elements.firstWaxCount,'2');change(w,f.elements.waxstickCount,'1');
  assert.match(d.querySelector('#testDialogTotal').textContent,/67,40/);
  change(w,f.elements.firstWaxCount,'0');assert.match(d.querySelector('#testDialogTotal').textContent,/57,40/);
  f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(posts.length,1);assert.equal(posts[0].logistics,'Zelf brengen en zelf ophalen');
  assert.equal(posts[0].postcode,'');assert.equal(new Date(posts[0].pickupDate+'T12:00:00Z').getUTCDay(),3);
  assert.match(posts[0].notes,/Standaard reiniging/);assert.match(posts[0].notes,/Natural Skiwax Stick 50g 1x à€17,50/);
  assert.doesNotMatch(posts[0].notes,/Extra waxreiniging \d+x/);
  assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes);
});
test('extra cleaning cannot exceed materials that receive wax, invalid quantities cannot submit',t=>{
  const {w,f,d,posts}=setup(t);
  change(w,f.elements.firstWaxCount,'3');assert.equal(f.checkValidity(),false);
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(posts.length,0);
  for(const bad of ['-1','0.5','21']){change(w,f.elements.firstWaxCount,'0');change(w,f.elements.waxstickCount,bad);assert.equal(f.checkValidity(),false);}
  d.querySelector('.test-dialog-close').click();change(w,d.querySelector('#brons-ski'),'0');change(w,d.querySelector('#slijpen-ski'),'1');d.querySelector('#packageRequest').click();
  assert.equal(f.elements.firstWaxCount.disabled,true);assert.equal(f.elements.firstWaxCount.value,'0');
});
test('Wednesday dates and seven-day return dates handle the year boundary in Dutch time',t=>{
  const {w,f}=setup(t),RealDate=w.Date;
  w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-12-29T23:30:00Z']));}};
  w.LATTEN_SERVICE.dates(f.elements.testPickupWeekend);
  const dates=[...f.elements.testPickupWeekend.options].map(o=>o.value).filter(v=>/^\d{4}-/.test(v));
  assert.equal(dates[0],'2027-01-06');
  for(const value of dates){assert.equal(new RealDate(value+'T12:00:00Z').getUTCDay(),3);assert.equal((new RealDate(w.LATTEN_SERVICE.plusWeek(value))-new RealDate(value))/86400000,7);}
  assert.ok([...f.elements.testPickupWeekend.options].some(o=>o.value==='In overleg'));
});
test('direct booking preserves chosen extra services and requested Wednesday without calling retired pickup availability',async t=>{
  const dom=new JSDOM(bookingHtml,{url:'https://lattenspecialist.nl/afspraak.html?pakket=Koper',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,posts=[];w.LATTENSPECIALIST_BOOKING={endpoint:'https://example.invalid',turnstileSiteKey:'test'};
  w.turnstile={render:()=>1,getResponse:()=> 'fake-token',reset:()=>{}};
  w.fetch=async(url,config)=>{assert.equal(config.method,'POST');posts.push(JSON.parse(config.body));return {ok:true,json:async()=>({ok:true,reference:'LS-2610-ABC234',confirmationSent:true})};};
  [selection,options,booking].forEach(code=>w.eval(code));d.querySelector('script[src*="turnstile/v0"]').dispatchEvent(new w.Event('load'));
  const f=d.querySelector('#requestForm');f.elements.name.value='Voorbeeld';f.elements.phone.value='0612345678';f.elements.email.value='test@example.com';f.elements.privacyConsent.checked=true;
  change(w,f.elements.firstWaxCount,'1');change(w,f.elements.waxstickCount,'2');
  const date=f.elements.pickupDate.options[1].value;change(w,f.elements.pickupDate,date);
  assert.match(d.querySelector('#requestSummary').textContent,/Extra waxreiniging: 1×/);
  f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(posts.length,1);assert.equal(posts[0].pickupDate,'In overleg');
  assert.match(posts[0].notes,new RegExp(`Brengen ${date}`));assert.match(posts[0].notes,/Extra waxreiniging 1x à€5/);
  assert.match(posts[0].notes,/Stick 50g 2x à€17,50/);assert.equal(posts[0].address,undefined);
  assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});
