import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createNotifications} from '../src/notifications.js';

const turn=()=>new Promise(resolve=>setTimeout(resolve,20));
const token='a'.repeat(64);
function setup(t, {permission='default',native=false}={}) {
  const dom=new JSDOM('<aside id="notificationCard"><p id="notificationMessage"></p><button id="enableNotifications"></button><button id="disableNotifications"></button></aside>',{url:'https://lattenspecialist.nl'});
  t.after(()=>dom.window.close());
  const w=dom.window, d=w.document, calls=[];
  let permissions=0, subscriptions=0, attached=false, failure=false, currentToken=token;
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/mock',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/mock',keys:{p256dh:'test',auth:'test'}})};
  const registration={active:{},pushManager:{getSubscription:async()=>subscriptions?subscription:null,subscribe:async()=>{subscriptions++;return subscription;}},getNotifications:async()=>[]};
  Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>registration}});
  w.PushManager=function(){};
  w.Notification={permission,requestPermission:()=>{permissions++;w.Notification.permission=permission==='denied'?'denied':'granted';return Promise.resolve(w.Notification.permission);}};
  w.fetch=async(url,options)=>{
    calls.push({url,options}); if(failure)throw new Error('Offline');
    if(url.endsWith('/config'))return {ok:true,json:async()=>({configured:true,publicKey:Buffer.alloc(65,1).toString('base64url')})};
    const raw=JSON.parse(options.body);
    if(raw.action==='subscribe')attached=true;
    if(raw.action==='unsubscribe')attached=false;
    return {ok:true,json:async()=>({subscribed:attached})};
  };
  const controller=createNotifications({endpoint:'https://api.example',native,getToken:()=>currentToken,document:d,navigator:w.navigator,window:w});
  return {controller,w,d,calls,getPermissions:()=>permissions,getSubscriptions:()=>subscriptions,setFailure:value=>{failure=value;},setToken:value=>{currentToken=value;}};
}
test('push requires an explicit click, authenticates privately, and can be turned off per order',async t=>{
  const app=setup(t); await app.controller.refresh();
  assert.equal(app.getPermissions(),0); assert.equal(app.getSubscriptions(),0);
  app.d.getElementById('enableNotifications').click(); await turn();
  assert.equal(app.getPermissions(),1); assert.equal(app.getSubscriptions(),1);
  const request=app.calls.find(call=>JSON.parse(call.options.body||'{}').action==='subscribe');
  assert.equal(request.options.headers.Authorization,`Bearer ${token}`);
  assert.ok(!request.url.includes(token));
  assert.match(app.d.getElementById('notificationMessage').textContent,/staan aan/);
  app.d.getElementById('disableNotifications').click(); await turn();
  assert.match(app.d.getElementById('notificationMessage').textContent,/uitgezet/);
  app.setFailure(true); assert.equal(await app.controller.remove(),false,'Do not claim a device was disconnected while offline');
});
test('denied notification permission sends no subscription; native test build states its limitation',async t=>{
  const app=setup(t,{permission:'denied'}); await app.controller.refresh();
  assert.match(app.d.getElementById('notificationMessage').textContent,/geblokkeerd/);
  assert.equal(app.getSubscriptions(),0);
  const native=setup(t,{native:true}); await native.controller.refresh();
  assert.match(native.d.getElementById('notificationMessage').textContent,/Android-testapp/);
  assert.equal(native.calls.length,0);
});
test('changing customer during permission request cannot attach notifications to previous customer',async t=>{
  const app=setup(t); await app.controller.refresh();
  let allow;
  app.w.Notification.requestPermission=()=>new Promise(resolve=>{allow=resolve;});
  app.d.getElementById('enableNotifications').click();
  app.setToken('b'.repeat(64)); allow('granted'); await turn();
  assert.equal(app.getSubscriptions(),0);
  assert.ok(!app.calls.some(call=>call.url.endsWith('/api/customer/push')));
});

test('background push is generic and notification click opens only a valid personal page',async()=>{
  const source=await readFile(new URL('../../sw.js',import.meta.url),'utf8');
  const handlers={}, shown=[], opened=[];
  const self={addEventListener:(type,handler)=>{handlers[type]=handler;},registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
  vm.runInNewContext(source,{self,URL});
  const run=async(type,extra)=>{let promise;handlers[type]({...extra,waitUntil:value=>{promise=value;}});await promise;};
  for(const url of ['https://evil.test/app.html',`https://lattenspecialist.nl/app.html?token=bad#klant=${token}`])await run('push',{data:{json:()=>({url})}});
  assert.equal(shown.length,0);
  const url=`https://lattenspecialist.nl/app.html#klant=${token}`;
  await run('push',{data:{json:()=>({url,title:'Untrusted',body:'Customer name'})}});
  assert.equal(shown[0][0],'Mijn Lattenspecialist');
  assert.ok(!shown[0][1].body.includes('Customer'));
  await run('notificationclick',{notification:{close:()=>{},data:{url}}});
  assert.deepEqual(opened,[url]);
  await run('notificationclick',{notification:{close:()=>{},data:{url:'https://evil.test'}}});
  assert.equal(opened.length,1);
});
