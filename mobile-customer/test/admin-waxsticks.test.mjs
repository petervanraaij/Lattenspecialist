import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../../beheer.html',import.meta.url),'utf8');
const script=await readFile(new URL('../../beheer.js',import.meta.url),'utf8');
const selection=await readFile(new URL('../../maintenance-selection.js',import.meta.url),'utf8');
const manual=await readFile(new URL('../../manual-maintenance.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setTimeout(resolve,25));
test('admin order shows selected waxsticks and records handover only after explicit click',async t=>{
  const dom=new JSDOM(html,{url:'https://lattenspecialist.nl/beheer.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,posts=[];
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://api.example'};w.sessionStorage.setItem('lattenspecialist-admin-token','test');
  w.fetch=async(url,options={})=>{
    let value={dates:[]};
    if(url.endsWith('/reservations'))value={records:[{reference:'LS-2611-ABC234',name:'Testklant',service:'Onderhoud',waxstickCount:2},{reference:'LS-2611-BCD234',name:'Zonder stick',service:'Onderhoud'}]};
    if(url.includes('/inventory/waxsticks/')){if(options.method==='POST')posts.push(JSON.parse(options.body));value={ordered:2,delivered:posts.length?2:0,remaining:posts.length?0:2,handedOverAt:posts.length?'2026-11-09T18:00:00Z':null};}
    return{ok:true,status:200,json:async()=>value};
  };
  w.eval(selection);w.eval(manual);w.eval(script);await turn();await turn();
  const panel=d.querySelector('[data-waxstick-reference]');assert.ok(panel);assert.equal(d.querySelectorAll('[data-waxstick-reference]').length,1);
  assert.match(panel.textContent,/2× Holmenkol/);assert.match(panel.textContent,/2 nog mee te geven/);assert.equal(posts.length,0);
  const button=panel.querySelector('.waxstick-handover');assert.equal(button.disabled,false);button.click();button.click();await turn();
  assert.deepEqual(posts,[{confirmed:true}]);assert.match(panel.textContent,/2 waxsticks meegegeven op/);assert.equal(button.hidden,true);
});
