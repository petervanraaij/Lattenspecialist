import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8');
test('new requests remain visible, refresh automatically and disappear after being picked up',async t=>{
 const dom=new JSDOM(await read('beheer.html'),{url:'https://lattenspecialist.nl/beheer.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window;let poll;w.setInterval=fn=>{poll=fn;};Object.defineProperty(w.document,'hidden',{value:false});
 w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example'};w.sessionStorage.setItem('lattenspecialist-admin-token','test');
 let records=[{reference:'LS-TEST',name:'Test',service:'Onderhoud',currentStep:1}];
 w.fetch=async url=>({ok:true,status:200,json:async()=>url.endsWith('/reservations')?{records}:{dates:[]}});
 w.eval(await read('maintenance-selection.js'));w.eval(await read('manual-maintenance.js'));w.eval(await read('beheer.js'));
 await new Promise(resolve=>setTimeout(resolve,40));
 const alert=w.document.querySelector('.admin-request-alert');assert.equal(alert.hidden,false);assert.match(alert.textContent,/1 nieuwe onderhoudsaanvraag/);
 await poll();assert.equal(alert.hidden,false);
 records=[{...records[0],currentStep:2}];await poll();assert.equal(alert.hidden,true);
 records=[{reference:'LS-NEXT',name:'Nieuwe klant',service:'Onderhoud',currentStep:1}];await poll();assert.equal(alert.hidden,false);assert.match(alert.textContent,/LS-NEXT/);
 assert.ok(w.document.querySelector('.admin-quick-request'));
});
