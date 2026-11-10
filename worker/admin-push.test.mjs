import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';
import {queueReservationPush,deliverPushOutbox} from './src/admin-push.js';
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');for(const file of ['0001_team.sql','0002_operations.sql','0007_admin_push.sql'])this.sql.exec(readFileSync(new URL('./team-migrations/'+file,import.meta.url),'utf8'));}
 prepare(query){const sql=this.sql;let values=[];const s={bind(...args){values=args;return s;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return{results:sql.prepare(query).all(...values)};},async run(){return{meta:sql.prepare(query).run(...values)};},exec(){return{meta:sql.prepare(query).run(...values)};}};return s;}
 async batch(statements){this.sql.exec('BEGIN');try{const values=statements.map(s=>s.exec());this.sql.exec('COMMIT');return values;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
const db=new D1(),owner='synthetic-owner-code',id=crypto.randomUUID(),other=crypto.randomUUID(),deviceToken='synthetic-device-token-that-is-not-real';
const env={LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_ADMIN_TOKEN:owner,HRM_DATA_KEY:Buffer.alloc(32,4).toString('base64'),FCM_PROJECT_ID:'synthetic-project',FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'synthetic-project',client_email:'push@synthetic-project.iam.gserviceaccount.com',private_key:pem})};
let messages=[],oauth=0,mode='success';
globalThis.fetch=async(url,options)=>{
 if(url==='https://oauth2.googleapis.com/token'){
  oauth++;const assertion=new URLSearchParams(options.body).get('assertion'),[head,body,signature]=assertion.split('.');
  const claim=JSON.parse(Buffer.from(body,'base64url'));assert.equal(claim.scope,'https://www.googleapis.com/auth/firebase.messaging');assert.equal(claim.aud,url);
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(head+'.'+body)));
  return Response.json({access_token:'synthetic-oauth',expires_in:3600});
 }
 assert.equal(url,'https://fcm.googleapis.com/v1/projects/synthetic-project/messages:send');
 const payload=JSON.parse(options.body);messages.push(payload);
 assert.equal(payload.message.android.priority,'HIGH');assert.equal(payload.message.notification,undefined);
 assert.deepEqual(Object.keys(payload.message.data).sort(),['eventId','reference','type']);
 if(mode==='invalid')return Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404});
 return Response.json(mode==='fail'?{}:{name:'synthetic-message'},{status:mode==='fail'?503:200});
};
async function call(path,value,token=owner,origin='https://localhost',method='POST'){
 const response=await worker.fetch(new Request('https://worker.test/api/admin/push/'+path,{method,headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(value)}:{})}),env);
 return{status:response.status,data:await response.json()};
}
assert.equal((await call('register',{deviceId:id,token:deviceToken,generation:1},'invalid')).status,401);
assert.equal((await call('register',{deviceId:id,token:deviceToken,generation:1},owner,'https://attacker.test')).status,403);
assert.equal((await call('register',{deviceId:id,token:deviceToken,generation:1})).status,200);
const stored=db.sql.prepare('SELECT * FROM admin_push_devices WHERE id=?').get(id);assert.ok(!stored.token_ciphertext.includes(deviceToken));assert.notEqual(stored.token_hash,deviceToken);
assert.equal((await call('status',undefined,owner,'https://localhost','GET')).data.devices.length,1);
await queueReservationPush({service:'Onderhoud',name:'DO NOT SEND',email:'private@example.test'},'LS-2611-ABC234',env);
assert.equal(messages.length,1);assert.equal(messages[0].message.token,deviceToken);assert.equal(db.sql.prepare('SELECT state FROM admin_push_deliveries').get().state,'accepted');
await queueReservationPush({service:'Onderhoud'},'LS-2611-ABC234',env);assert.equal(messages.length,1,'no duplicate event');
await call('register',{deviceId:other,token:'other-synthetic-device-token',generation:1});
await queueReservationPush({service:'Onderhoud'},'LS-2611-ABC234',env);assert.equal(messages.length,1,'new devices do not receive replayed old events');
mode='fail';await queueReservationPush({service:'Onderhoud'},'LS-2611-ABC235',env);assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM admin_push_deliveries WHERE state='retry'").get().n,2);
mode='success';db.sql.exec("UPDATE admin_push_deliveries SET next_at=0 WHERE state='retry'");await deliverPushOutbox(env);assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM admin_push_deliveries WHERE state='accepted'").get().n,3);assert.equal(oauth,1,'reuse scoped OAuth token');
await call('register',{deviceId:id,token:'newer-synthetic-device-token',generation:2});await call('register',{deviceId:id,token:deviceToken,generation:1});
const newer=db.sql.prepare('SELECT generation,token_ciphertext FROM admin_push_devices WHERE id=?').get(id);assert.equal(newer.generation,2);
await call('received',{deviceId:id});assert.ok(db.sql.prepare('SELECT last_received_at FROM admin_push_devices WHERE id=?').get(id).last_received_at);
await call('unregister',{deviceId:other});mode='invalid';await queueReservationPush({service:'Onderhoud'},'LS-2611-ABC236',env);assert.equal(db.sql.prepare('SELECT enabled FROM admin_push_devices WHERE id=?').get(id).enabled,0);
mode='success';await call('register',{deviceId:id,token:deviceToken,generation:3});
const testKey='root-deviceids-testpush-'+new Date().toISOString().slice(0,10).replace(/-/g,'');
assert.equal((await call('test',{testKey:'arbitrary-test'})).status,400);
const testBefore=messages.length;assert.equal((await call('test',{testKey})).data.state,'accepted');
assert.equal(messages.length,testBefore+1);await call('test',{testKey});assert.equal(messages.length,testBefore+1,'daily test is idempotent');
const before=messages.length;
env.LATTENSPECIALIST_ADMIN_TOKEN='rotated-owner-code';await queueReservationPush({service:'Onderhoud'},'LS-2611-ABC237',env);assert.equal(messages.length,before,'credential rotation invalidates subscriptions');
assert.equal((await call('status',undefined,env.LATTENSPECIALIST_ADMIN_TOKEN,'https://localhost','GET')).data.devices.length,0);
console.log('Push checks passed: owner-only registration, encryption, scoped signed JWT, no customer payload, durable retries, event dedup, token refresh, receipt, logout, invalid-token removal and credential rotation.');
