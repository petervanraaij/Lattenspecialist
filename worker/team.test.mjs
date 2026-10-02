import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';

// Real SQLite executes the migration, conditional updates, constraints and audit triggers.
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(readFileSync(new URL('./team-migrations/0001_team.sql',import.meta.url),'utf8'));}
 prepare(query){const sql=this.sql;let values=[];const statement={bind(...args){values=args;return statement;},async first(){return sql.prepare(query).get(...values) || null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:sql.prepare(query).run(...values)};},exec(){const s=sql.prepare(query);return s.columns().length?{results:s.all(...values)}:{results:[],meta:s.run(...values)};}};return statement;}
 async batch(statements){this.sql.exec('BEGIN');try{const result=statements.map(s=>s.exec());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
class KV {values=new Map();async put(k,v){this.values.set(k,v);}async get(k,type){const v=this.values.get(k);return v===undefined?null:type==='json'?JSON.parse(v):v;}async list({prefix}){return {keys:[...this.values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}}
const kv=new KV(),db=new D1(),origin='https://lattenspecialist.nl',owner='test-owner-secret';
const env={LATTENSPECIALIST_RESERVATIONS_KV:kv,LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_ADMIN_TOKEN:owner};
const reference='LS-2609-ABCDEF',other='LS-2609-GHJKLM';
const record={reference,name:'Klant Geheim',email:'private@example.test',phone:'0612345678',address:'Privéadres',material:'Ski',amount:'1',service:'Onderhoud',package:'Goud',currentStep:3,status:'Materiaal ontvangen',waxType:'Nog te bepalen',paymentAmount:'99',paymentUrl:'https://payment.example/private',note:'Voor klant',serviceCode:'LS-ABCDEF',closedAt:null,createdAt:new Date().toISOString()};
await kv.put('reservation:'+reference,JSON.stringify(record));await kv.put('reservation:'+other,JSON.stringify({...record,reference:other,serviceCode:null}));await kv.put('service:LS-ABCDEF',reference);
let sequence=0;
async function call(path,method='GET',body,token=owner,ip='127.0.0.1') {const response=await worker.fetch(new Request('https://example.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),'CF-Connecting-IP':ip},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);const data=await response.json();return {status:response.status,data};}
async function create(login){const response=await call('/api/admin/team/members','POST',{name:'Medewerker '+login,login});assert.equal(response.status,201);return response.data;}
async function login(m){const response=await call('/api/team/login','POST',{login:m.login,accessKey:m.accessKey},'');assert.equal(response.status,200);return response.data.token;}
const a=await create('robin'),b=await create('sam'),ta=await login(a),tb=await login(b);
const customKey='Mijn-Eigen-Sleutel-2026',custom=await call('/api/admin/team/members','POST',{name:'Medewerker eigen',login:'eigen',accessKey:customKey});assert.equal(custom.status,201);assert.equal(custom.data.accessKey,customKey);assert.equal((await call('/api/team/login','POST',{login:'eigen',accessKey:customKey},'')).status,200);
assert.equal((await call('/api/admin/team/members','POST',{name:'Te kort',login:'tekort',accessKey:'kort'})).status,400);
assert.equal((await call('/api/admin/team/members','GET',undefined,ta)).status,401);
assert.equal((await call('/api/admin/reservations','GET',undefined,ta)).status,401);
assert.equal((await call('/api/admin/availability','PATCH',{dates:[]},ta)).status,401);
assert.equal((await call('/api/admin/team/members','POST',{name:'Again',login:'robin'})).status,409);
const stored=db.sql.prepare('SELECT key_hash FROM members WHERE id=?').get(a.id);assert.notEqual(stored.key_hash,a.accessKey);
let response=await call('/api/admin/reservations/'+reference,'PATCH',{assignedTo:a.id,revision:0});assert.equal(response.status,200,JSON.stringify(response));assert.equal(response.data.record.revision,1);
response=await call('/api/team/tasks','GET',undefined,ta);assert.equal(response.data.records.length,1);
for(const field of ['email','phone','address','paymentAmount','paymentUrl','serviceCode','note'])assert.equal(response.data.records[0][field],undefined,field);
assert.equal((await call('/api/team/tasks','GET',undefined,tb)).data.records.length,0);
let update={revision:1,currentStep:4,waxType:'Premium universele wax',workNote:'Kanten gecontroleerd'};
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',update,tb)).status,404);
assert.equal((await call('/api/team/tasks/'+other,'PATCH',update,ta)).status,404);
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',{...update,paymentAmount:1},ta)).status,403);
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',{...update,currentStep:8},ta)).status,400);
response=await call('/api/team/tasks/'+reference,'PATCH',update,ta);assert.equal(response.status,200,JSON.stringify(response));assert.equal(response.data.record.revision,2);
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',update,ta)).status,409);
response=await call('/api/status/LS-ABCDEF','GET',undefined,'');assert.equal(response.data.record.currentStep,4);assert.equal(response.data.record.waxType,'Premium universele wax');assert.equal(response.data.record.workNote,undefined);
assert.equal((await call('/api/admin/reservations/'+reference,'PATCH',{currentStep:5,revision:1})).status,409);
assert.equal((await call('/api/admin/reservations/'+other,'PATCH',{currentStep:5})).status,409);
response=await call('/api/admin/reservations','GET');assert.equal(response.data.records.find(r=>r.reference===other).currentStep,3,'Rejected legacy write must not alter saved record');
assert.equal(response.data.records.find(r=>r.reference===reference).workNote,update.workNote);
assert.equal((await call('/api/admin/team/audit?reference='+reference)).data.events.length,2);
response=await call('/api/admin/reservations/'+reference,'PATCH',{assignedTo:b.id,revision:2});assert.equal(response.status,200);
assert.equal((await call('/api/team/tasks','GET',undefined,ta)).data.records.length,0);
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',{...update,revision:3},ta)).status,404);
assert.equal((await call('/api/team/tasks','GET',undefined,tb)).data.records.length,1);
assert.equal((await call('/api/admin/team/members/'+b.id,'PATCH',{action:'revoke'})).status,200);
assert.equal((await call('/api/team/tasks','GET',undefined,tb)).status,401);
assert.equal((await call('/api/team/login','POST',{login:b.login,accessKey:b.accessKey},'')).status,401);
const rotated=(await call('/api/admin/team/members/'+b.id,'PATCH',{action:'rotate',accessKey:'Nieuwe-Sleutel-2026'})).data;
assert.equal(rotated.accessKey,'Nieuwe-Sleutel-2026');assert.equal((await call('/api/team/login','POST',{login:b.login,accessKey:b.accessKey},'')).status,401);
const newToken=await login(rotated);assert.equal((await call('/api/team/tasks','GET',undefined,newToken)).status,200);
await call('/api/admin/reservations/'+reference,'PATCH',{closed:true,revision:3});
assert.equal((await call('/api/team/tasks','GET',undefined,newToken)).data.records.length,0);
assert.equal((await call('/api/team/tasks/'+reference,'PATCH',{...update,revision:4},newToken)).status,409);
assert.equal((await call('/api/team/logout','POST',{},newToken)).status,200);assert.equal((await call('/api/team/tasks','GET',undefined,newToken)).status,401);
db.sql.prepare('UPDATE sessions SET expires_at=0').run();assert.equal((await call('/api/team/tasks','GET',undefined,ta)).status,401);
for(let i=0;i<20;i++)assert.equal((await call('/api/team/login','POST',{login:'nobody',accessKey:'wrong'},'','198.51.100.1')).status,401);
assert.equal((await call('/api/team/login','POST',{login:'nobody',accessKey:'wrong'},'','198.51.100.1')).status,429);
console.log('Team security: assignment, privacy, role isolation, stale writes, audit, closure, rotation, expiry, revocation and rate limits passed.');
