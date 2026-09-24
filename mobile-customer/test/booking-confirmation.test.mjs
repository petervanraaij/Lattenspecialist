import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const script=await readFile(new URL('../../booking.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setTimeout(resolve,20));
test('website booking exposes its own maintenance link and does not promise customer email',async t=>{
  const dom=new JSDOM(html,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,token='f'.repeat(64),submitted=[];
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example',turnstileSiteKey:'test'};
  w.turnstile={render:()=>0,getResponse:()=>'verified',reset:()=>{}};
  w.fetch=async(url,options)=>({ok:true,json:async()=>options?.method==='POST'?{ok:true,reference:'LS-2609-TEST23',confirmationChannel:'app',customerToken:token}:{dates:[]}});
  w.addEventListener('lattenspecialist:booking-submitted',event=>submitted.push(event.detail));
  w.eval(script);
  d.querySelector('script[src*="turnstile/v0/api.js"]').dispatchEvent(new w.Event('load'));
  await turn();
  const form=d.getElementById('requestForm');
  // Field validation has separate backend coverage; exercise the success/notification flow here.
  form.checkValidity=()=>true;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})); await turn();
  assert.equal(submitted.length,1); assert.equal(submitted[0].customerToken,token);
  assert.equal(d.querySelector('#bookingStatus a').href,`https://lattenspecialist.nl/app.html#klant=${token}`);
  assert.match(d.getElementById('bookingStatus').textContent,/bevestiging, voortgang en betaalverzoek staan in je klantenapp/);
  assert.doesNotMatch(d.getElementById('bookingStatus').textContent,/e-mail/);
});
