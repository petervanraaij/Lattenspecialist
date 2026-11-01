import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {readAndValidateLattenspecialist} from '../../worker/src/index.js';
const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8');
const [home,selection,choice,options,bookingHtml,booking]=await Promise.all(['onderhoud-kiezen.html','maintenance-selection.js','package-choice.js','service-options.js','afspraak.html','booking.js'].map(read));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const change=(w,el,value)=>{el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};

function catalogue(t,url='https://lattenspecialist.nl/onderhoud-kiezen.html'){
 const dom=new JSDOM(home,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;[selection,choice].forEach(code=>w.eval(code));
 return{w,d,next:()=>d.getElementById('packageRequest').href};
}
function appointment(t,url='https://lattenspecialist.nl/afspraak.html?pakket=Koper'){
 const dom=new JSDOM(bookingHtml,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,posts=[];
 w.LATTENSPECIALIST_BOOKING={endpoint:'https://example.invalid',turnstileSiteKey:'synthetic-public-key'};
 w.turnstile={render:()=>1,getResponse:()=> 'synthetic-token',reset:()=>{}};
 w.fetch=async(url,config={})=>{assert.equal(config.method,'POST','No retired pickup-availability request is needed');posts.push(JSON.parse(config.body));return{ok:true,json:async()=>({ok:true,reference:'LS-2611-TEST01',confirmationSent:true})};};
 [selection,options,booking].forEach(code=>w.eval(code));d.querySelector('script[src*=turnstile]').dispatchEvent(new w.Event('load'));
 const f=d.getElementById('requestForm');f.elements.name.value='Fictieve klant';f.elements.phone.value='0612345678';f.elements.email.value='fixture@example.test';f.elements.privacyConsent.checked=true;
 change(w,f.elements.pickupDate,'In overleg');
 return{w,d,f,posts};
}
const submit=async page=>{page.f.dispatchEvent(new page.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();};
function twoWaxedSkis(t){const page=catalogue(t);change(page.w,page.d.getElementById('brons-ski'),'2');return page;}

test('optional cleaning defaults to zero and can be declined in the single appointment flow, with correct extras totals',async t=>{
 const catalog=twoWaxedSkis(t);
 assert.equal(catalog.d.getElementById('testReservationDialog'),null);
 assert.equal(catalog.d.querySelector('script[src*=test-reservation-modal]'),null);
 assert.equal(catalog.d.getElementById('brons-cleaning').value,'0');
 const next=new URL(catalog.next());assert.equal(next.pathname,'/afspraak.html');assert.ok(next.searchParams.get('keuze'));
 const page=appointment(t,next.href),{w,d,f,posts}=page;
 assert.equal(f.elements.firstWaxCount.value,'0');assert.equal(f.elements.waxstickCount.value,'0');
 assert.match(d.getElementById('requestSummary').textContent,/39,90/);
 change(w,f.elements.firstWaxCount,'2');change(w,f.elements.waxstickCount,'1');assert.match(d.getElementById('requestSummary').textContent,/67,40/);
 change(w,f.elements.firstWaxCount,'0');assert.match(d.getElementById('requestSummary').textContent,/57,40/);
 await submit(page);assert.equal(posts.length,1,d.getElementById('bookingStatus').textContent);
 assert.equal(posts[0].logistics,'Zelf brengen en zelf ophalen');assert.equal(posts[0].address,undefined);assert.equal(posts[0].postcode,undefined);
 assert.match(posts[0].notes,/Standaard reiniging/);assert.match(posts[0].notes,/Natural Skiwax Stick 50g 1x/);assert.doesNotMatch(posts[0].notes,/Extra waxreiniging \d+x/);
 assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});

test('cleaning cannot exceed waxed material count and invalid optional quantities cannot submit',async t=>{
 const catalog=twoWaxedSkis(t),page=appointment(t,catalog.next()),{w,d,f,posts}=page;
 change(w,f.elements.firstWaxCount,'3');assert.equal(f.checkValidity(),false);await submit(page);assert.equal(posts.length,0);
 for(const bad of ['-1','0.5','21']){change(w,f.elements.firstWaxCount,'0');change(w,f.elements.waxstickCount,bad);assert.equal(f.checkValidity(),false);}
 const onlyEdges=catalogue(t);change(onlyEdges.w,onlyEdges.d.getElementById('slijpen-ski'),'1');
 const edgePage=appointment(t,onlyEdges.next());assert.equal(edgePage.f.elements.firstWaxCount.disabled,true);assert.equal(edgePage.f.elements.firstWaxCount.value,'0');
 const mixed={p:{brons:{s:1,b:0,w:'beta',u:false},slijpen:{s:1,b:0,w:'none',u:false}},e:{},u:false};
 const mixedPage=appointment(t,'https://lattenspecialist.nl/afspraak.html?keuze='+encodeURIComponent(JSON.stringify(mixed)));
 assert.equal(mixedPage.f.elements.firstWaxCount.max,'1');
});

test('Wednesday bringing preferences cross the Dutch year boundary without promising a collection date',t=>{
 const {w,f,d}=appointment(t),RealDate=w.Date;
 w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-12-29T23:30:00Z']));}};
 w.LATTEN_SERVICE.dates(f.elements.pickupDate);
 const dates=[...f.elements.pickupDate.options].filter(o=>/^\d{4}-/.test(o.value));
 assert.equal(dates[0].value,'2027-01-06');
 for(const option of dates){assert.equal(new RealDate(option.value+'T12:00:00Z').getUTCDay(),3);assert.doesNotMatch(option.textContent,/ophalen|terug|retour/i);}
 assert.ok([...f.elements.pickupDate.options].some(o=>o.value==='In overleg'));
 change(w,f.elements.pickupDate,dates[0].value);
 assert.match(d.getElementById('requestSummary').textContent,/Brengen 2027-01-06; ophalen op afspraak/);
 assert.doesNotMatch(d.getElementById('requestSummary').textContent,/2027-01-13/);
});

test('direct booking preserves extra services and a requested Wednesday without calling pickup availability',async t=>{
 const page=appointment(t),{w,d,f,posts}=page;
 change(w,f.elements.firstWaxCount,'1');change(w,f.elements.waxstickCount,'2');
 const date=[...f.elements.pickupDate.options].find(o=>/^\d{4}-/.test(o.value)).value;change(w,f.elements.pickupDate,date);
 assert.match(d.getElementById('requestSummary').textContent,/Extra waxreiniging: 1×/);
 await submit(page);assert.equal(posts.length,1);assert.equal(posts[0].pickupDate,'In overleg');
 assert.match(posts[0].notes,new RegExp(`Brengen ${date}; ophalen op afspraak`));assert.match(posts[0].notes,/Extra waxreiniging 1x/);assert.match(posts[0].notes,/Stick 50g 2x/);
 assert.equal(posts[0].address,undefined);assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});

test('catalogue cleaning reaches the appointment once and remains editable without double charging',async t=>{
 const catalog=twoWaxedSkis(t),clean=catalog.d.getElementById('brons-cleaning');
 assert.equal(clean.value,'0');assert.equal(clean.disabled,false);assert.equal(catalog.d.querySelector('[data-package=slijpen] [name=homepageCleaning]'),null);
 change(catalog.w,clean,'2');assert.match(catalog.d.getElementById('bookingCartTotal').textContent,/49,90/);
 const page=appointment(t,catalog.next()),{w,d,f,posts}=page;
 assert.equal(f.elements.firstWaxCount.value,'2');assert.match(d.getElementById('requestSummary').textContent,/49,90/);
 change(w,f.elements.firstWaxCount,'1');assert.match(d.getElementById('requestSummary').textContent,/44,90/);
 await submit(page);assert.equal(posts.length,1);assert.equal((posts[0].notes.match(/Extra waxreiniging 1x/g)||[]).length,1);
 assert.equal(w.LATTEN_SELECTION.cleaningCount(JSON.parse(posts[0].maintenanceSelection)),0);
 assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});

test('reducing material counts clamps optional cleaning and the edit URL restores all remaining choices',t=>{
 const catalog=twoWaxedSkis(t);change(catalog.w,catalog.d.getElementById('brons-cleaning'),'2');change(catalog.w,catalog.d.getElementById('brons-ski'),'1');
 assert.equal(catalog.d.getElementById('brons-cleaning').value,'1');assert.match(catalog.d.getElementById('bookingCartTotal').textContent,/24,95/);
 const page=appointment(t,catalog.next()),restored=catalogue(t,page.d.getElementById('editMaintenanceSelection').href);
 assert.equal(restored.d.getElementById('brons-ski').value,'1');assert.equal(restored.d.getElementById('brons-cleaning').value,'1');
 change(catalog.w,catalog.d.getElementById('brons-ski'),'0');assert.equal(catalog.d.getElementById('brons-cleaning').value,'0');assert.equal(catalog.d.getElementById('brons-cleaning').disabled,true);assert.match(catalog.d.getElementById('bookingCartTotal').textContent,/0,00/);
 for(const c of [-1,.5,3])assert.equal(catalog.w.LATTEN_SELECTION.normalize({p:{brons:{s:2,b:0,w:'beta',u:false,c}},e:{},u:false}),null);
});

test('package cleaning can be explicitly removed in the appointment with the plain package price restored',t=>{
 const value={p:{brons:{s:2,b:0,w:'beta',u:false,c:2}},e:{},u:false};
 const {w,d,f}=appointment(t,'https://lattenspecialist.nl/afspraak.html?keuze='+encodeURIComponent(JSON.stringify(value)));
 assert.equal(f.elements.firstWaxCount.value,'2');assert.match(d.getElementById('requestSummary').textContent,/49,90/);
 change(w,f.elements.firstWaxCount,'0');assert.match(d.getElementById('requestSummary').textContent,/39,90/);assert.doesNotMatch(d.getElementById('requestSummary').textContent,/49,90/);
 const editUrl=d.getElementById('editMaintenanceSelection').href,edited=w.LATTEN_SELECTION.parse(new URL(editUrl).searchParams.get('keuze'));
 assert.equal(w.LATTEN_SELECTION.cleaningCount(edited),0,'Declining cleaning must survive the edit link');
 const restored=catalogue(t,editUrl);assert.equal(restored.d.getElementById('brons-cleaning').value,'0');assert.match(restored.d.getElementById('bookingCartTotal').textContent,/39,90/);
 const back=appointment(t,restored.next());assert.equal(back.f.elements.firstWaxCount.value,'0');assert.match(back.d.getElementById('requestSummary').textContent,/39,90/);
});

test('editing retains a preferred cleaning package and distributes newly chosen cleaning without duplication',t=>{
 const value={p:{brons:{s:1,b:0,w:'beta',u:false},goud:{s:1,b:0,w:'beta',u:false,c:1},slijpen:{s:1,b:0,w:'none',u:false}},e:{},u:false};
 const {w,d,f}=appointment(t,'https://lattenspecialist.nl/afspraak.html?keuze='+encodeURIComponent(JSON.stringify(value)));
 const editing=()=>w.LATTEN_SELECTION.parse(new URL(d.getElementById('editMaintenanceSelection').href).searchParams.get('keuze'));
 assert.equal(editing().p.goud.c,1);assert.equal(editing().p.brons.c,undefined);
 change(w,f.elements.firstWaxCount,'2');const updated=editing();assert.equal(updated.p.goud.c,1);assert.equal(updated.p.brons.c,1);assert.equal(updated.p.slijpen.c,undefined);assert.equal(w.LATTEN_SELECTION.cleaningCount(updated),2);
 change(w,f.elements.firstWaxCount,'1');assert.equal(editing().p.goud.c,1);assert.equal(editing().p.brons.c,undefined);
});
