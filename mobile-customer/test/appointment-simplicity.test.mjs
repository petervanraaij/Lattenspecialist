import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {readAndValidateLattenspecialist} from '../../worker/src/index.js';

const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8');
const [html,model,options,booking]=await Promise.all(['afspraak.html','maintenance-selection.js','service-options.js','booking.js'].map(read));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const change=(w,input,value)=>{input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));};

function setup(t,url='https://lattenspecialist.nl/afspraak.html'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,posts=[];
 w.LATTENSPECIALIST_BOOKING={endpoint:'https://fixture.invalid',turnstileSiteKey:'synthetic-public-key'};
 w.turnstile={render:()=>1,getResponse:()=> 'synthetic-token',reset:()=>{}};
 w.fetch=async(url,config={})=>{if(config.method==='POST')posts.push(JSON.parse(config.body));return{ok:true,json:async()=>({ok:true,reference:'LS-2611-TEST01'})};};
 [model,options,booking].forEach(code=>w.eval(code));
 d.querySelector('script[src*=turnstile]').dispatchEvent(new w.Event('load'));
 const f=d.querySelector('#requestForm');f.elements.name.value='Fictieve klant';f.elements.phone.value='0612345678';f.elements.email.value='fixture@example.test';f.elements.privacyConsent.checked=true;
 return{w,d,f,posts};
}

test('maintenance books a bringing preference without holiday details or an invented collection date',async t=>{
 const {w,d,f,posts}=setup(t);
 for(const name of ['skidate','destination','conditions'])assert.equal(f.elements[name],undefined);
 assert.equal(d.getElementById('planningStepTitle').textContent,'Brengafspraak');
 assert.doesNotMatch(d.querySelector('#maintenancePlanningFields').textContent,/komend weekend|woensdag erop|eerste skidag/i);
 change(w,f.elements.package,'Koper');change(w,f.elements.firstWaxSkiCount,'1');change(w,f.elements.waxstickCount,'1');
 const date=[...f.elements.pickupDate.options].find(o=>/^\d{4}-\d{2}-\d{2}$/.test(o.value)).value;
 change(w,f.elements.pickupDate,date);
 const summary=d.getElementById('requestSummary').textContent;
 assert.match(summary,/ophalen op afspraak/);assert.doesNotMatch(summary,/Eerste skidag|Bestemming:|Omstandigheden:/);
 assert.match(summary,/39,95/);
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(posts.length,1,d.getElementById('bookingStatus').textContent);
 for(const name of ['skidate','destination','conditions'])assert.equal(Object.hasOwn(posts[0],name),false);
 assert.match(posts[0].notes,new RegExp(`Brengen ${date}; ophalen op afspraak`));
 assert.equal(readAndValidateLattenspecialist(posts[0]).data.notes,posts[0].notes.replace(/\s+/g,' ').trim());
});

test('legacy package and rush links still submit while stale embedded trip fields are discarded',async t=>{
 const {w,d,f,posts}=setup(t,'https://lattenspecialist.nl/afspraak.html?pakket=Goud&spoed=1');
 assert.equal(f.elements.package.value,'Goud');assert.match(f.elements.urgent.value,/in overleg/);
 for(const [name,value] of Object.entries({skidate:'1999-01-01',destination:'Oude bestemming',conditions:'Koud'})){
  const input=d.createElement('input');input.type='hidden';input.name=name;input.value=value;f.append(input);
 }
 change(w,f.elements.pickupDate,'In overleg');
 assert.doesNotMatch(d.getElementById('requestSummary').textContent,/Oude bestemming|1999|Omstandigheden:/);
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(posts.length,1);assert.equal(posts[0].package,'Goud');assert.match(posts[0].urgent,/in overleg/);
 for(const name of ['skidate','destination','conditions'])assert.equal(Object.hasOwn(posts[0],name),false);
});

test('rental retains its own date fields and end-date validation',async t=>{
 const {w,d,f,posts}=setup(t,'https://lattenspecialist.nl/afspraak.html?dienst=verhuur');
 assert.equal(d.getElementById('planningStepTitle').textContent,'Huurperiode');
 assert.equal(f.elements.pickupDate.disabled,true);assert.equal(f.elements.rentfrom.disabled,false);
 assert.match(f.elements.rentfrom.min,/^\d{4}-\d{2}-\d{2}$/);
 change(w,f.elements.rentfrom,'2099-02-20');change(w,f.elements.rentto,'2099-02-19');
 assert.equal(f.elements.rentto.checkValidity(),false);
 change(w,f.elements.rentto,'2099-02-27');assert.equal(f.elements.rentto.checkValidity(),true);
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(posts.length,1,d.getElementById('bookingStatus').textContent);
 assert.equal(posts[0].rentfrom,'2099-02-20');assert.equal(posts[0].rentto,'2099-02-27');assert.equal(posts[0].pickupDate,undefined);
});
