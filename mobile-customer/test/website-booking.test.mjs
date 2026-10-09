import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read = name => readFile(new URL('../../'+name,import.meta.url),'utf8');
const [html,code,home,choice,metrics,selection] = await Promise.all(['afspraak.html','booking.js','index.html','package-choice.js','website-metrics.js','maintenance-selection.js'].map(read));
const turn=()=>new Promise(resolve=>setTimeout(resolve,25));
async function setup(t, {url='https://lattenspecialist.nl/afspraak.html',confirmationSent=true,fail=false}={}) {
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,posts=[];
 w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example',turnstileSiteKey:'public-test'};
 w.turnstile={render:()=>1,getResponse:()=> 'test-token',reset:()=>{}};
 w.fetch=async (url,options={})=>{
  if(options.method==='POST') {posts.push(JSON.parse(options.body)); await turn();return {ok:!fail,json:async()=>fail?{message:'Tijdelijk niet beschikbaar'}:{ok:true,reference:'LS-2609-ABC234',confirmationSent}};}
  return {ok:true,json:async()=>({dates:['2099-12-12','2099-12-13']})};
 };
 w.eval(selection);w.eval(code);d.querySelector('script[src*="turnstile/v0"]').dispatchEvent(new w.Event('load'));await turn();
 return {w,d,f:d.querySelector('form'),posts};
}
const change=(w,input,value)=>{input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));};
function complete(w,f) {
 change(w,f.elements.package,'Zilver');change(w,f.elements.logistics,'Zelf brengen en zelf ophalen');
 f.elements.name.value='Voorbeeld';f.elements.phone.value='0612345678';f.elements.email.value='test@example.com';f.elements.privacyConsent.checked=true;
}
const submit=(w,f)=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
function homepage(t,url='https://lattenspecialist.nl/') {
 const dom=new JSDOM(home,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(selection);w.eval(choice);
 return {w,d,model:w.LATTEN_SELECTION};
}
const chosen=d=>JSON.parse(new URL(d.querySelector('#packageRequest').href).searchParams.get('keuze'));
const waxChoices={beta:'Holmenkol BetaMix Red (standaard inbegrepen)',alpha:'Holmenkol AlphaMix Yellow (inbegrepen)',ultra:'Holmenkol UltraMix Blue (inbegrepen)',performance:'Performance Wax (+ € 7,50)'};
test('copper and bronze package links work and no package is silently preselected',async t=>{
 for(const name of ['Koper','Brons','Zilver','Goud','Platinum']) {
  const {f}=await setup(t,{url:`https://lattenspecialist.nl/afspraak.html?pakket=${name}`});assert.equal(f.elements.package.value,name);
 }
 assert.equal((await setup(t)).f.elements.package.value,'');
 assert.equal((await setup(t,{url:'https://lattenspecialist.nl/afspraak.html?pakket=Onbekend'})).f.elements.package.value,'');
 const {d}=homepage(t);
 assert.equal(chosen(d),null);
 assert.equal(d.querySelectorAll('[name="homepagePackage"]').length,0);
 assert.equal(d.querySelectorAll('.package-details:not([open])').length,5);
 assert.equal(d.querySelectorAll('#pakketten').length,1);
 assert.equal(d.querySelector('.hero').nextElementSibling.id,'wax');
 assert.equal(d.querySelector('#wax').nextElementSibling.id,'pakketten');
 assert.equal(d.querySelector('.maintenance-sidebar'),null);
 assert.equal(d.querySelectorAll('[data-extra]').length,0);
 assert.match(d.querySelector('.complex-repair-note').textContent,/Grotere of complexere reparaties/);
 assert.match(d.querySelector('.complex-repair-note').textContent,/Prijs na beoordeling en overleg/);
 assert.match(d.querySelector('.complex-repair-note').textContent,/bespreken de aanpak en kosten vooraf/);
 assert.equal(d.querySelector('[data-extra="edges"]'),null);
 assert.match(d.querySelector('[data-package="slijpen"] .package-wax-price').textContent,/alleen slijpen/);
 assert.match(d.querySelector('#faq').textContent,/Kan ik alleen mijn kanten laten slijpen/);
 const bronze=await setup(t,{url:'https://lattenspecialist.nl/afspraak.html?pakket=Brons'});
 assert.equal(bronze.f.elements.performanceWax.disabled,true);
 assert.equal(bronze.d.querySelector('#waxChoiceField').hidden,true);
 assert.match(bronze.d.querySelector('#requestSummary').textContent,/Pakket: Brons/);
 assert.doesNotMatch(bronze.d.querySelector('#requestSummary').textContent,/Wax:/);
});
test('counts, multiple packages, different materials and wax survive one complete request',async t=>{
 const {w,d}=homepage(t);
 d.querySelector('#brons-ski').closest('.quantity-control').querySelector('[data-step="1"]').click();
 d.querySelector('#brons-ski').closest('.quantity-control').querySelector('[data-step="1"]').click();
 change(w,d.querySelector('#goud-snowboard'),'1');
 const gold=d.querySelector('[data-package="goud"]');
 change(w,gold.querySelector('[name="homepageWax"]'),'performance');gold.querySelector('[name="homepageUrgent"]').click();
 change(w,d.querySelector('#slijpen-ski'),'1');
 const value=chosen(d);
 assert.equal(value.p.brons.s,2);assert.equal(value.p.goud.b,1);assert.equal(value.p.slijpen.s,1);assert.equal(value.p.slijpen.w,'none');assert.equal(value.p.goud.u,true);assert.equal(value.p.goud.w,'performance');
 assert.equal(d.querySelectorAll('.package-card.is-selected').length,3);
 assert.equal(d.querySelector('.mobile-sticky-cta').href,d.querySelector('#packageRequest').href);
 const {w:rw,d:rd,f,posts}=await setup(t,{url:d.querySelector('#packageRequest').href});
 assert.equal(rd.querySelector('#maintenanceSelection').hidden,false);
 assert.equal(rd.querySelector('#singleMaintenanceFields').hidden,true);
 assert.match(rd.querySelector('#maintenanceSelectionItems').textContent,/Koper: 2×/);
 assert.match(rd.querySelector('#maintenanceSelectionItems').textContent,/Goud: 1× snowboard/);
 assert.match(rd.querySelector('#maintenanceSelectionItems').textContent,/Performance Purple/);
 complete(rw,f);f.elements.notes.value='Graag vooraf bellen.';submit(rw,f);await turn();await turn();
 assert.equal(posts.length,1);assert.equal(posts[0].amount,'4');assert.equal(posts[0].material,'Meerdere / combinatie');
 assert.equal(posts[0].package,'Meerdere pakketten / losse werkzaamheden');
 assert.match(posts[0].notes,/Koper: 2x ski/);assert.match(posts[0].notes,/Goud: 1x snowboard; Performance Purple/);
 assert.match(posts[0].notes,/Brons: 1x ski \| Koper:/);assert.doesNotMatch(posts[0].notes,/Brons: 1x ski;/);assert.match(posts[0].notes,/spoed/);assert.match(posts[0].notes,/Graag vooraf bellen/);
 assert.match(rd.querySelector('#confirmationSummary').textContent,/Koper: 2×/);
 const edited=homepage(t,rd.querySelector('#editMaintenanceSelection').href);
 assert.equal(edited.d.querySelector('#brons-ski').value,'2');assert.equal(edited.d.querySelector('#slijpen-ski').value,'1');
 assert.deepEqual(chosen(edited.d),value);
});
test('snowboard prompts add bindings and their cost to the correct package, never to separate work',async t=>{
 const {d}=homepage(t),dialog=d.querySelector('#bindingsDialog');
 for (const id of ['slijpen','brons','zilver','goud','platinum']) {
  const plus=d.querySelector(`#${id}-snowboard`).closest('.quantity-control').querySelector('[data-step="1"]');
  plus.click();assert.equal(dialog.open,true);
  assert.match(d.querySelector('#bindingsPrice').textContent,/7,50/);
  d.querySelector('#bindingsYes').click();d.querySelector('#bindingsYes').click();
  assert.equal(dialog.open,false);assert.equal(chosen(d).p[id].d,1);
  plus.click();d.querySelector('#bindingsNo').click();
  assert.equal(chosen(d).p[id].b,2);assert.equal(chosen(d).p[id].d,1);
  plus.click();d.querySelector('#bindingsYes').click();
  assert.equal(chosen(d).p[id].d,2);
  assert.match(d.querySelector(`[data-package="${id}"] .package-bindings-price`).textContent,/15,00 extra in dit pakket/);
 }
 assert.equal(d.querySelector('#extra-bindings'),null);assert.deepEqual(chosen(d).e,{});
 const {w,f,posts,d:rd}=await setup(t,{url:d.querySelector('#packageRequest').href});
 assert.match(rd.querySelector('#maintenanceSelectionItems').textContent,/2× bindingen demonteren \+ monteren \(\+ €\s15,00\)/);
 complete(w,f);submit(w,f);await turn();await turn();
 assert.match(posts[0].notes,/Brons:.*bindingen 2x/);
 assert.match(posts[0].notes,/bindingen 2x à€7,50/);
 const restored=homepage(t,rd.querySelector('#editMaintenanceSelection').href);
 assert.deepEqual(chosen(restored.d),chosen(d));assert.equal(restored.d.querySelector('#bindingsDialog').open,false);
});

test('bindings decline, escape, fewer snowboards and manual quantity changes do not add unwanted services',t=>{
 const {w,d,model}=homepage(t),dialog=d.querySelector('#bindingsDialog');
 const board=d.querySelector('#goud-snowboard'),bindings=d.querySelector('#goud-bindings');
 change(w,board,'2');assert.equal(dialog.open,true);
 assert.match(d.querySelector('#bindingsQuestion').textContent,/2 extra snowboards bij Goud/);
 d.querySelector('#bindingsYes').click();assert.equal(bindings.value,'2');
 change(w,board,'1');assert.equal(dialog.open,false);assert.equal(bindings.value,'1');
 change(w,board,'0');assert.equal(bindings.value,'0');assert.equal(d.querySelector('[data-package="goud"] .package-bindings').hidden,true);
 board.closest('.quantity-control').querySelector('[data-step="1"]').click();
 dialog.dispatchEvent(new w.Event('cancel'));dialog.close();
 assert.equal(bindings.value,'0');assert.equal(chosen(d).p.goud.b,1);
 const ski=d.querySelector('#brons-ski');ski.closest('.quantity-control').querySelector('[data-step="1"]').click();
 assert.equal(dialog.open,false);
 bindings.closest('.quantity-control').querySelector('[data-step="1"]').click();
 assert.equal(bindings.value,'1');assert.equal(bindings.closest('.quantity-control').querySelector('[data-step="1"]').disabled,true);
 assert.equal(model.normalize({p:{goud:{s:0,b:1,d:2,w:'beta',u:false}},e:{},u:false}),null);
 assert.equal(model.normalize({p:{goud:{s:0,b:1,d:-1,w:'beta',u:false}},e:{},u:false}),null);
});

test('small repair totals are available in Brons, Zilver, Goud and Platinum and survive booking',async t=>{
 const {w,d,model}=homepage(t),repairs=d.querySelector('#platinum-repairs');
 for (const id of ['brons','zilver','goud','platinum']) {
  const selector=d.querySelector(`#${id}-repairs`);
  assert.ok(selector);assert.match(selector.nextElementSibling.textContent,/Kies eerst/);
  change(w,d.querySelector(`#${id}-ski`),'1');assert.equal(selector.disabled,false);
  change(w,selector,'2');assert.equal(chosen(d).p[id].r,2);
  assert.match(d.querySelector('#selectionItems').textContent,/vanaf € 7,50 per reparatie/);
  change(w,d.querySelector(`#${id}-ski`),'0');assert.equal(selector.value,'0');assert.equal(selector.disabled,true);
 }
 assert.equal(d.querySelector('#slijpen-repairs'),null);
 assert.equal(repairs.disabled,true);
 change(w,d.querySelector('#platinum-ski'),'2');
 assert.equal(repairs.disabled,false);assert.equal(repairs.value,'0');
 change(w,repairs,'3');
 assert.equal(chosen(d).p.platinum.r,3);
 assert.match(d.querySelector('#selectionItems').textContent,/3× kleine belagreparaties in totaal/);
 assert.deepEqual(chosen(d).e,{});
 const {w:rw,d:rd,f,posts}=await setup(t,{url:d.querySelector('#packageRequest').href});
 assert.match(rd.querySelector('#maintenanceSelectionItems').textContent,/Platinum: 2×.*3× kleine belagreparaties/);
 complete(rw,f);submit(rw,f);await turn();await turn();
 assert.equal(posts[0].amount,'2');assert.equal(posts[0].package,'Platinum');
 assert.match(posts[0].notes,/kleine rep\. 3x/);
 assert.match(rd.querySelector('#confirmationSummary').textContent,/3× kleine belagreparaties/);
 const edited=homepage(t,rd.querySelector('#editMaintenanceSelection').href);
 assert.equal(edited.d.querySelector('#platinum-repairs').value,'3');assert.deepEqual(chosen(edited.d),chosen(d));
 change(w,repairs,'0');assert.equal(chosen(d).p.platinum.r,undefined);
 change(w,repairs,'3');change(w,d.querySelector('#platinum-ski'),'0');
 assert.equal(repairs.value,'0');assert.equal(repairs.disabled,true);assert.equal(chosen(d),null);
 for(const r of [-1,1.5,21,'3']) assert.equal(model.normalize({p:{platinum:{s:1,b:0,w:'beta',u:false,r}},e:{},u:false}),null);
 assert.equal(model.normalize({p:{goud:{s:1,b:0,w:'beta',u:false,r:1}},e:{},u:false}).p.goud.r,1);
 assert.equal(model.normalize({p:{slijpen:{s:1,b:0,w:'none',u:false,r:1}},e:{},u:false}),null);
});

test('wax is independently selectable for every package without removing earlier choices',async t=>{
 const {w,d}=homepage(t);
 for(const id of ['brons','zilver','goud','platinum']) {
  const card=d.querySelector(`[data-package="${id}"]`);
  for(const wax of Object.keys(waxChoices)) {
   change(w,card.querySelector('[name="homepageWax"]'),wax);
   const selected=chosen(d);assert.equal(selected.p[id].w,wax);assert.equal(selected.p[id].s,1);
   const request=await setup(t,{url:d.querySelector('#packageRequest').href});
   assert.match(request.d.querySelector('#maintenanceSelectionItems').textContent,new RegExp(wax==='performance'?'Performance Purple':wax==='alpha'?'AlphaMix Yellow':wax==='ultra'?'UltraMix Blue':'BetaMix Red'));
  }
 }
 assert.equal(Object.keys(chosen(d).p).length,4);
 change(w,d.querySelector('#brons-ski'),'0');
 assert.equal(chosen(d).p.brons,undefined);assert.equal(Object.keys(chosen(d).p).length,3);
});
test('invalid selections cannot produce a partial or over-limit order',async t=>{
 const {w,d,model}=homepage(t);
 change(w,d.querySelector('#brons-ski'),'20');change(w,d.querySelector('#goud-snowboard'),'1');
 assert.equal(d.querySelector('#packageRequest').getAttribute('aria-disabled'),'true');assert.match(d.querySelector('#packageSelection').textContent,/maximaal 20/);
 change(w,d.querySelector('#brons-ski'),'-1');assert.equal(d.querySelector('#packageRequest').getAttribute('aria-disabled'),'true');
 change(w,d.querySelector('#brons-ski'),'0');assert.equal(d.querySelector('#packageRequest').hasAttribute('aria-disabled'),false);
 for(const text of ['{','null',JSON.stringify({p:{brons:{s:1.5,b:0,w:'beta',u:false}},e:{},u:false}),JSON.stringify({p:{constructor:{s:1,b:0,w:'beta',u:false}},e:{},u:false})]) {
  assert.equal(model.parse(text),null);
  const {f,d:rd}=await setup(t,{url:'https://lattenspecialist.nl/afspraak.html?keuze='+encodeURIComponent(text)});
  assert.equal(f.elements.package.value,'');assert.match(rd.querySelector('#bookingStatus').textContent,/opnieuw/);
 }
});
test('the largest selection and allowed comment reach the existing backend without truncation',async t=>{
 const {model}=homepage(t);const value=model.empty();
 for(const id of Object.keys(model.packages))value.p[id]={s:2,b:2,d:2,w:id==='slijpen'?'none':'performance',u:true};
 for(const id of ['brons','zilver','goud','platinum'])value.p[id].r=20;
 for(const id of Object.keys(model.extras))value.e[id]={q:20,m:'snowboard'};
 value.u=true;
 assert.ok(model.notes(model.normalize(value)).length<800);
 const {w,f,posts}=await setup(t,{url:'https://lattenspecialist.nl/afspraak.html?keuze='+encodeURIComponent(JSON.stringify(value))});
 complete(w,f);
 const limit=f.elements.notes.maxLength;
 assert.ok(limit>0);
 f.elements.notes.value='x'.repeat(limit+1);f.elements.notes.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(f.elements.notes.checkValidity(),false);
 f.elements.notes.value='x'.repeat(limit);f.elements.notes.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(f.elements.notes.checkValidity(),true);submit(w,f);await turn();await turn();
 assert.equal(posts[0].notes.length,800);
 const {readAndValidateLattenspecialist}=await import('../../worker/src/index.js');
 assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});

test('wax choices survive submission, invalid URL choices stay on the included default',async t=>{
 for(const [value,label] of Object.entries(waxChoices)) {
  const {w,f,posts}=await setup(t,{url:`https://lattenspecialist.nl/afspraak.html?pakket=Goud&wax=${value}`});
  complete(w,f);change(w,f.elements.package,'Goud');submit(w,f);await turn();await turn();
  assert.equal(posts.length,1);assert.equal(posts[0].package,'Goud');
  assert.ok(posts[0].notes.includes(`Waxkeuze: ${label}`));
 }
 for(const query of ['','?wax=unknown','?wax=constructor']) {
  const {f}=await setup(t,{url:'https://lattenspecialist.nl/afspraak.html'+query});
  assert.equal(f.elements.performanceWax.value,waxChoices.beta);
 }
});
const urgentChoice='Ja, graag overleggen (+ € 10,00 indien mogelijk)';
test('rush remains optional and scoped to each selected package',async t=>{
 const {d,w}=homepage(t);
 for(const id of ['slijpen','brons','zilver','goud','platinum']) {
  const card=d.querySelector(`[data-package="${id}"]`),urgent=card.querySelector('[name="homepageUrgent"]');
  assert.equal(urgent.checked,false);urgent.click();
  assert.equal(chosen(d).p[id].s,1);assert.equal(chosen(d).p[id].u,true);
  if(id !== 'slijpen') change(w,card.querySelector('[name="homepageWax"]'),'alpha');
  assert.equal(chosen(d).p[id].u,true);
  urgent.click();assert.equal(chosen(d).p[id].u,false);
 }
 assert.equal(Object.keys(chosen(d).p).length,5);
});
test('rush can be declined in the form and does not leak into rentals or invalid URL choices',async t=>{
 for(const query of ['','?spoed=0','?spoed=false','?spoed=unknown']) {
  const {f}=await setup(t,{url:'https://lattenspecialist.nl/afspraak.html'+query});
  assert.equal(f.elements.urgent.value,'Nee');
 }
 const url='https://lattenspecialist.nl/afspraak.html?pakket=Goud&spoed=1';
 const {w,d,f,posts}=await setup(t,{url});
 complete(w,f);change(w,f.elements.urgent,'Nee');submit(w,f);await turn();await turn();
 assert.equal(posts[0].urgent,'Nee');
 assert.match(d.querySelector('#confirmationSummary').textContent,/Spoed: Nee/);
 const rental=await setup(t,{url:url+'&dienst=verhuur'});
 complete(rental.w,rental.f);
 assert.equal(rental.f.elements.urgent.disabled,true);
 submit(rental.w,rental.f);await turn();await turn();
 assert.equal(rental.posts[0].urgent,undefined);
 assert.doesNotMatch(rental.d.querySelector('#confirmationSummary').textContent,/Spoed:/);
});

test('dropoff does not send hidden address, pickup date or stale rental fields; success is clear and duplicate clicks are ignored',async t=>{
 const {w,d,f,posts}=await setup(t,{confirmationSent:false});complete(w,f);
 f.elements.address.value='Should not be sent';f.elements.rentfrom.value='2020-01-02';f.elements.rentto.value='2020-01-01';
 assert.equal(d.querySelector('#pickupAddressFields').hidden,true);assert.equal(f.elements.pickupDate.disabled,true);
 assert.equal(f.checkValidity(),true);submit(w,f);submit(w,f);await turn();await turn();
 assert.equal(posts.length,1);assert.equal(posts[0].pickupDate,'In overleg');assert.equal(posts[0].address,undefined);assert.equal(posts[0].rentfrom,undefined);
 assert.equal(d.querySelector('#bookingConfirmation').hidden,false);assert.equal(f.hidden,true);
 assert.match(d.querySelector('#confirmationDelivery').textContent,/kon niet worden verstuurd/);assert.doesNotMatch(d.querySelector('#confirmationDelivery').textContent,/spam/);
 d.querySelector('#newRequest').click();assert.equal(f.hidden,false);assert.equal(d.querySelector('#confirmationReference').textContent,'');
});
test('pickup requires an explicit date and address, rental excludes maintenance, failed send preserves entered data',async t=>{
 const {w,d,f,posts}=await setup(t,{fail:true});
 assert.equal(f.elements.pickupDate.value,'');assert.equal(f.elements.address.required,true);
 complete(w,f);const rental=f.querySelector('[name="service"][value="Verhuur"]');rental.checked=true;rental.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(f.elements.package.disabled,true);assert.equal(f.elements.address.disabled,true);submit(w,f);await turn();await turn();
 assert.equal(posts[0].package,undefined);assert.equal(posts[0].rentaltype,'Complete set');
 assert.equal(f.hidden,false);assert.equal(f.elements.name.value,'Voorbeeld');assert.match(d.querySelector('#bookingStatus').textContent,/Tijdelijk/);
});
test('metrics contain only event name, do not run on preview, and respect browser privacy signals',async t=>{
 for(const [url,privacy,expected] of [['https://lattenspecialist.nl/afspraak.html?secret=test',false,1],['https://lattenspecialist.nl/afspraak.html',true,0],['http://127.0.0.1/afspraak.html',false,0]]) {
  const dom=new JSDOM(html,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,calls=[];
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example'};Object.defineProperty(w.navigator,'globalPrivacyControl',{value:privacy});
  w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true}};w.eval(metrics);await turn();assert.equal(calls.length,expected);
  if(expected) {assert.deepEqual(JSON.parse(calls[0].options.body),{event:'form_opened'});assert.equal(calls[0].options.referrerPolicy,'no-referrer');assert.equal(calls[0].options.credentials,'omit');}
 }
});
