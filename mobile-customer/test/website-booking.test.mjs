import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read = name => readFile(new URL('../../'+name,import.meta.url),'utf8');
const [html,code,home,choice,metrics] = await Promise.all(['afspraak.html','booking.js','index.html','package-choice.js','website-metrics.js'].map(read));
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
 w.eval(code);d.querySelector('script[src*="turnstile/v0"]').dispatchEvent(new w.Event('load'));await turn();
 return {w,d,f:d.querySelector('form'),posts};
}
const change=(w,input,value)=>{input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));};
function complete(w,f) {
 change(w,f.elements.package,'Zilver');change(w,f.elements.logistics,'Zelf brengen en zelf ophalen');
 f.elements.name.value='Voorbeeld';f.elements.phone.value='0612345678';f.elements.email.value='test@example.com';f.elements.privacyConsent.checked=true;
}
const submit=(w,f)=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
test('all homepage package selections transfer explicitly; no package is silently preselected',async t=>{
 const dom=new JSDOM(home,{url:'https://lattenspecialist.nl',runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(choice);
 for(const name of ['Brons','Zilver','Goud','Platinum']) {
  dom.window.document.querySelector(`input[value="${name}"]`).click();
  assert.equal(dom.window.document.querySelector('#packageRequest').href,`https://lattenspecialist.nl/afspraak.html?pakket=${name}`);
  const {f}=await setup(t,{url:`https://lattenspecialist.nl/afspraak.html?pakket=${name}`});assert.equal(f.elements.package.value,name);
 }
 assert.equal((await setup(t)).f.elements.package.value,'');
 assert.equal((await setup(t,{url:'https://lattenspecialist.nl/afspraak.html?pakket=Onbekend'})).f.elements.package.value,'');
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
