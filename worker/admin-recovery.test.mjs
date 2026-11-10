import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';
import {verifyAdminAccessCode,createAdminAccessHash} from './src/operations.js';
class D1 {
  constructor(){this.sql=new DatabaseSync(':memory:');for(const file of ['0001_team.sql','0002_operations.sql','0006_admin_recovery.sql'])this.sql.exec(readFileSync(new URL('./team-migrations/'+file,import.meta.url),'utf8'));}
  prepare(query){const sql=this.sql;let values=[];const statement={bind(...args){values=args;return statement;},async first(){return sql.prepare(query).get(...values)||null;},async run(){return{meta:sql.prepare(query).run(...values)};},exec(){return{meta:sql.prepare(query).run(...values)};}};return statement;}
  async batch(statements){this.sql.exec('BEGIN');try{const result=statements.map(s=>s.exec());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
const db=new D1(),origin='https://lattenspecialist.nl';
const env={LATTENSPECIALIST_TEAM_DB:db,HRM_DATA_KEY:Buffer.alloc(32,7).toString('base64'),LATTENSPECIALIST_ADMIN_TOKEN:'original-test-code',LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL:'owner@example.test',RESEND_API_KEY:'test-only'};
let messages=[],rejectMail=false;
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');messages.push(JSON.parse(options.body));return new Response('{}',{status:rejectMail?500:200});};
async function call(path,body,source=origin,method='POST'){
  const response=await worker.fetch(new Request('https://worker.test/api/admin/recovery/'+path,{method,headers:{Origin:source,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}),env);
  assert.equal(response.headers.get('Cache-Control'),'no-store');return{status:response.status,data:await response.json()};
}
const request=()=>call('request',{email:'OWNER@example.test',redirect:'https://attacker.test',to:'attacker@example.test'});
const resetRate=()=>db.sql.exec('DELETE FROM admin_recovery_rate');
const latestToken=()=>messages.at(-1).text.match(/#token=([a-f0-9]{64})/)[1];
assert.equal((await call('request',{},'https://attacker.test')).status,403);
assert.equal((await call('request',{},'https://stuiterbaas.nl')).status,403);
assert.equal((await call('request',{},origin,'GET')).status,405);
const unknown=await call('request',{email:'unknown@example.test'});assert.equal(unknown.status,200);assert.equal(messages.length,0);
const sent=await request();assert.equal(sent.status,200);assert.deepEqual(sent.data,unknown.data);assert.equal(messages.length,1);
assert.deepEqual(messages[0].to,['owner@example.test']);assert.ok(!messages[0].text.includes('attacker'));
const first=latestToken();assert.equal(db.sql.prepare('SELECT token_hash FROM admin_recovery_tokens').get().token_hash.includes(first),false);
await request();assert.equal(messages.length,1,'cooldown must persist in database');
assert.equal((await call('complete',{token:first,code:'short'})).status,400);
assert.equal((await call('complete',{token:'a'.repeat(64),code:'new-secure-test-code'})).status,400);
assert.equal((await call('complete',{token:first,code:'new-secure-test-code'})).status,200);
const stored=db.sql.prepare("SELECT setting_value FROM hrm_settings WHERE setting_key='admin_access_hash'").get().setting_value;
assert.ok(await verifyAdminAccessCode('new-secure-test-code',stored,env));assert.equal(await verifyAdminAccessCode(env.LATTENSPECIALIST_ADMIN_TOKEN,stored,env),false);
assert.equal((await call('complete',{token:first,code:'another-secure-code'})).status,400,'no replay');
assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM hrm_audit WHERE action='admin_access_recovered'").get().n,1);
resetRate();await request();const expired=latestToken();db.sql.exec('UPDATE admin_recovery_tokens SET expires_at=0');
assert.equal((await call('complete',{token:expired,code:'another-secure-code'})).status,400);
resetRate();await request();const rotated=latestToken();env.LATTENSPECIALIST_ADMIN_TOKEN='rotated-server-secret';
assert.equal((await call('complete',{token:rotated,code:'another-secure-code'})).status,400,'server rotation revokes links');
resetRate();await request();const prior=latestToken();
const changed=await createAdminAccessHash('manually-changed-code',env);db.sql.prepare("UPDATE hrm_settings SET setting_value=? WHERE setting_key='admin_access_hash'").run(changed);
assert.equal((await call('complete',{token:prior,code:'another-secure-code'})).status,400,'normal code change revokes links');
resetRate();await request();const one=latestToken();resetRate();await request();const two=latestToken();
assert.equal((await call('complete',{token:one,code:'final-secure-test-code'})).status,200);
assert.equal((await call('complete',{token:two,code:'other-secure-test-code'})).status,400,'other outstanding links revoked');
resetRate();rejectMail=true;assert.equal((await request()).status,503);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM admin_recovery_tokens').get().n,0,'failed delivery leaves no active link');
rejectMail=false;resetRate();for(let i=0;i<9;i++){db.sql.exec('UPDATE admin_recovery_rate SET requested_at=0');await request();}
assert.equal(db.sql.prepare('SELECT attempts FROM admin_recovery_rate').get().attempts,8,'daily limit');
assert.equal((await call('complete',{token:first,code:'x'.repeat(3000)})).status,413);
console.log('Admin recovery: fixed recipient, generic responses, persisted cooldown/day limit, expiry, one-use links, code/server rotation, outstanding-link revocation, delivery failure and audit passed.');
