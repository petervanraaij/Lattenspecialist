import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url);
function page(t,file,url){const dom=new JSDOM(readFileSync(new URL(file,root),'utf8'),{url,runScripts:'outside-only'});t.after(()=>dom.window.close());return dom.window;}
const script=readFileSync(new URL('admin-recovery.js',root),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('recovery request mails through fixed backend without sending the login code',async t=>{
  const w=page(t,'beheer.html','https://lattenspecialist.nl/beheer.html'),calls=[];
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://backend.test'};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async(url,options)=>{calls.push({url,...options});return{ok:true,json:async()=>({message:'Herstellink aangevraagd.'})};};
  w.eval(script);w.document.querySelector('#adminLoginForm input[name=token]').value='not-to-be-transmitted';
  w.document.querySelector('#forgotAdminCode').click();assert.ok(w.document.querySelector('dialog').open);
  const form=w.document.querySelector('#adminRecoveryForm');form.elements.email.value='owner@example.test';
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(calls[0].url,'https://backend.test/api/admin/recovery/request');assert.deepEqual(JSON.parse(calls[0].body),{email:'owner@example.test'});
  assert.equal(w.document.querySelector('#adminRecoveryStatus').textContent,'Herstellink aangevraagd.');
  assert.equal(form.querySelector('button').disabled,false);
});
test('reset removes fragment, requires matching codes and clears stored access only after success',async t=>{
  const token='a'.repeat(64),w=page(t,'beheer-herstellen.html','https://lattenspecialist.nl/beheer-herstellen.html#token='+token),calls=[];
  w.LATTENSPECIALIST_BOOKING={endpoint:'https://backend.test'};w.localStorage.setItem('lattenspecialist-admin-token','old-code');
  w.fetch=async(url,options)=>{calls.push({url,...options});return{ok:true,json:async()=>({message:'Code gewijzigd.'})};};w.eval(script);
  assert.equal(w.location.hash,'');const form=w.document.querySelector('form');form.elements.code.value='new-secure-test-code';form.elements.confirm.value='different';
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(calls.length,0);assert.equal(w.localStorage.getItem('lattenspecialist-admin-token'),'old-code');
  form.elements.confirm.value='new-secure-test-code';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.deepEqual(JSON.parse(calls[0].body),{token,code:'new-secure-test-code'});assert.equal(calls[0].referrerPolicy,'no-referrer');
  assert.ok(form.hidden);assert.equal(w.localStorage.getItem('lattenspecialist-admin-token'),null);assert.equal(form.elements.code.value,'');
});
test('missing or invalid reset token never offers password submission',t=>{
  const w=page(t,'beheer-herstellen.html','https://lattenspecialist.nl/beheer-herstellen.html#token=bad');w.eval(script);
  assert.ok(w.document.querySelector('form').hidden);assert.match(w.document.querySelector('#resetAdminStatus').textContent,/nieuwe link/);
});
