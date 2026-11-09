import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const script=await readFile(new URL('../../waxstick-offer.js',import.meta.url),'utf8');
function setup(t,value='0'){
  const dom=new JSDOM(`<form><input name="waxstickCount" value="${value}"></form>`,{runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.eval(script);
  return {w,form:w.document.querySelector('form')};
}
test('waxstick offer adds exactly one item, notifies pricing and continues only once',t=>{
  const {w,form}=setup(t);let next=0,changes=0;
  form.addEventListener('input',()=>changes++);
  assert.equal(w.LATTEN_WAXSTICK.offer(form,()=>next++),true);
  const add=w.document.querySelector('[data-add-stick]');add.click();add.click();
  assert.equal(form.elements.waxstickCount.value,'1');assert.equal(changes,1);assert.equal(next,1);
  assert.equal(w.document.querySelector('dialog'),null);
  assert.equal(w.LATTEN_WAXSTICK.offer(form,()=>next++),false);
});
test('declining or pressing Escape does not charge a waxstick and proceeds',t=>{
  for(const action of ['skip','escape']){
    const {w,form}=setup(t);let next=0;
    w.LATTEN_WAXSTICK.offer(form,()=>next++);
    if(action==='skip')w.document.querySelector('[data-skip-stick]').click();
    else w.document.querySelector('dialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));
    assert.equal(form.elements.waxstickCount.value,'0');assert.equal(next,1);
    assert.equal(w.LATTEN_WAXSTICK.offer(form,()=>next++),false);
  }
});
test('already selected waxsticks are preserved without a second offer',t=>{
  const {w,form}=setup(t,'2');
  assert.equal(w.LATTEN_WAXSTICK.offer(form,()=>assert.fail()),false);
  assert.equal(form.elements.waxstickCount.value,'2');assert.equal(w.document.querySelector('dialog'),null);
});
