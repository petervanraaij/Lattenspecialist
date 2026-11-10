import assert from 'node:assert/strict';
import worker from './src/index.js';
const secret='synthetic-owner-code';
const record={reference:'LS-2611-ABC234',service:'Onderhoud',currentStep:1,name:'Fictieve testklant',createdAt:'2026-11-09T10:00:00Z'};
const env={LATTENSPECIALIST_ADMIN_TOKEN:secret,LATTENSPECIALIST_RESERVATIONS_KV:{async list(){return{keys:[{name:'reservation:'+record.reference}],list_complete:true};},async get(key,type){return key==='reservation:'+record.reference?(type==='json'?record:JSON.stringify(record)):null;}}};
async function call({path='/api/admin/reservations',method='GET',token=secret,origin}={}){
 return worker.fetch(new Request('https://worker.test'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})}}),env);
}
let response=await call();assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);assert.equal(response.headers.get('Cache-Control'),'no-store');
assert.equal((await response.json()).records[0].reference,record.reference);
assert.equal((await call({token:''})).status,401);assert.equal((await call({token:'wrong-code'})).status,401);
assert.equal((await call({origin:'https://attacker.test'})).status,403,'valid owner token never opens CORS to a foreign origin');
assert.equal((await call({method:'POST'})).status,403,'native exception grants no writes');
assert.equal((await call({path:'/api/admin/team/members'})).status,403,'exception is not inherited by other endpoints');
assert.equal((await call({origin:'https://lattenspecialist.nl'})).status,200,'existing website stays supported');
assert.equal((await call({origin:'https://localhost'})).status,200,'existing Capacitor webview stays supported');
env.LATTENSPECIALIST_ADMIN_TOKEN='rotated-owner-code';assert.equal((await call()).status,401,'old device code is invalid after rotation');
console.log('Native widgets/notifications: authenticated read without Origin, no CORS expansion, no anonymous reads/writes, no other endpoints, and code rotation passed.');
