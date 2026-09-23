import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {JSDOM} from 'jsdom';

const read = name => readFile(new URL(`../../${name}`,import.meta.url),'utf8');
const [html,install,bundle,worker] = await Promise.all(['app.html','pwa-install.js','customer-app.js','sw.js'].map(read));
const turn = () => new Promise(resolve=>setTimeout(resolve,20));

function installPage(t,{secure=true,standalone=false}={}) {
  const dom=new JSDOM(html,{url:'https://lattenspecialist.nl/app.html',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window;
  Object.defineProperty(w,'isSecureContext',{value:secure});
  w.matchMedia=()=>({matches:standalone,addEventListener(){}});
  let registrations=0;
  Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async path=>{assert.equal(path,'/sw.js');registrations++;}}});
  w.eval(install);
  return {w,d:w.document,registrations:()=>registrations};
}

test('web app keeps its existing installation identity, local icons and no APK download',async()=>{
  const manifest=JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.id,'/app.html');
  assert.equal(manifest.start_url,'/app.html');
  assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons)assert.ok((await readFile(new URL(`../../${icon.src.slice(1)}`,import.meta.url))).length);
  assert.match(html,/rel="manifest"/);
  assert.match(html,/apple-touch-icon" href="images\/app-icon-192.png/);
  assert.doesNotMatch(html,/<(?:script|iframe|link|img)[^>]+(?:src|href)="http:|\.apk(?:["?])/);
  const native=await readFile(new URL('../www/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(native,/id="installCard"|pwa-install\.js/);
});

test('installation starts only after a click; dismissal leaves usable help and installed hides it',async t=>{
  const {w,d}=installPage(t);
  const event=new w.Event('beforeinstallprompt',{cancelable:true});
  let prompted=0;
  event.prompt=async()=>{prompted++;};event.userChoice=Promise.resolve({outcome:'dismissed'});
  w.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
  assert.equal(prompted,0);
  assert.equal(d.getElementById('installApp').hidden,false);
  d.getElementById('installApp').click();await turn();
  assert.equal(prompted,1);
  assert.match(d.getElementById('installFeedback').textContent,/later installeren/);
  d.getElementById('installApp').click();await turn();
  assert.equal(prompted,1);
  w.dispatchEvent(new w.Event('appinstalled'));
  assert.equal(d.getElementById('installCard').hidden,true);
});

test('secure browser registers worker; insecure pages never offer installation; standalone needs no banner',async t=>{
  const safe=installPage(t);await turn();assert.equal(safe.registrations(),1);
  const unsafe=installPage(t,{secure:false});
  unsafe.w.dispatchEvent(new unsafe.w.Event('beforeinstallprompt'));
  await turn();assert.equal(unsafe.registrations(),0);
  assert.equal(unsafe.d.getElementById('installApp').hidden,true);
  const installed=installPage(t,{standalone:true});
  assert.equal(installed.d.getElementById('installCard').hidden,true);
});

test('web booking uses the same origin, preserves status links and accepts only its own frame',async t=>{
  const dom=new JSDOM(html,{url:'https://lattenspecialist.nl/app.html#status',runScripts:'outside-only'});
  t.after(()=>dom.window.close());const w=dom.window,d=w.document;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.fetch=async()=>({ok:true,json:async()=>({dates:[]})});
  w.eval(bundle);
  assert.equal(d.getElementById('onderhoud').hidden,false);
  w.location.hash='aanvragen';await turn();
  const frame=d.getElementById('bookingFrame');
  assert.equal(frame.src,'https://lattenspecialist.nl/?app=klant');
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://evil.example',source:frame.contentWindow,data:{type:'lattenspecialist:ready'}}));
  assert.notEqual(d.getElementById('bookingLoadStatus').textContent,'');
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:frame.contentWindow,data:{type:'lattenspecialist:ready'}}));
  assert.equal(d.getElementById('bookingLoadStatus').textContent,'');
});

function serviceWorker({offline=false}={}) {
  const handlers={},network=[],cached=[];
  const caches={
    match:async request=>{cached.push(request);return new Response('cached app');},
    open:async()=>({put:async()=>{}})
  };
  runInNewContext(worker,{URL,Response,caches,self:{location:{origin:'https://lattenspecialist.nl'},addEventListener:(name,fn)=>{handlers[name]=fn;}},fetch:async req=>{network.push(req);if(offline)throw new Error('offline');return new Response('fresh');}});
  return {network,cached,request:(path,options={})=>{
    let response;
    handlers.fetch({request:{url:`https://lattenspecialist.nl${path}`,method:'GET',cache:'default',mode:'cors',...options},respondWith:value=>{response=value;},waitUntil(){}});
    return response;
  }};
}

test('worker bypasses cached prices and inventory, and reports network errors honestly',async()=>{
  const online=serviceWorker();
  assert.equal(await (await online.request('/',{cache:'no-store'})).text(),'fresh');
  assert.equal(await (await online.request('/data/aanbod.json')).text(),'fresh');
  assert.equal(online.cached.length,0);
  const offline=serviceWorker({offline:true});
  await assert.rejects(offline.request('/',{cache:'no-store'}),/offline/);
  await assert.rejects(offline.request('/data/aanbod.json'),/offline/);
  assert.equal(offline.cached.length,0);
});

test('offline app shell stays accessible but booking iframe never receives a recursive app shell',async()=>{
  const sw=serviceWorker({offline:true});
  assert.equal(await (await sw.request('/app.html',{mode:'navigate'})).text(),'cached app');
  const form=await sw.request('/?app=klant',{mode:'navigate'});
  assert.equal(form.status,503);
  assert.match(await form.text(),/Geen internetverbinding/);
  assert.equal(sw.cached.length,1);
});
