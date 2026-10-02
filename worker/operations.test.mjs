import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';

class D1 {
  constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(readFileSync(new URL('./team-migrations/0001_team.sql',import.meta.url),'utf8'));this.sql.exec(readFileSync(new URL('./team-migrations/0002_operations.sql',import.meta.url),'utf8'));this.sql.exec(readFileSync(new URL('./team-migrations/0003_availability_times.sql',import.meta.url),'utf8'));}
  prepare(query){const sql=this.sql;let values=[];const statement={bind(...args){values=args;return statement;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:sql.prepare(query).run(...values)};},exec(){const s=sql.prepare(query);return s.columns().length?{results:s.all(...values)}:{results:[],meta:s.run(...values)};}};return statement;}
  async batch(statements){this.sql.exec('BEGIN');try{const result=statements.map(statement=>statement.exec());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
class KV {values=new Map();async put(key,value){this.values.set(key,String(value));}async get(key,type){const value=this.values.get(key);return value===undefined?null:type==='json'?JSON.parse(value):value;}async list({prefix=''}){return {keys:[...this.values.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};}}

const origin='https://lattenspecialist.nl',owner='owner-secret',db=new D1(),kv=new KV();
const env={LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_RESERVATIONS_KV:kv,LATTENSPECIALIST_ADMIN_TOKEN:owner,LATTENSPECIALIST_ORIGINS:origin,HRM_DATA_KEY:Buffer.alloc(32,7).toString('base64')};
const reference='LS-2609-OPS234',record={reference,name:'Test Klant',email:'klant@example.test',phone:'0612345678',address:'Hollenhof 13, 6659 BB Wamel',postcode:'6659 BB',houseNumber:'13',material:'Ski',amount:'2',service:'Onderhoud',package:'Goud',conditions:'Koud',currentStep:2,status:'Afspraak bevestigd',waxType:'Premium koudweerwax',serviceCode:'LS-OPS234',createdAt:new Date().toISOString()};
db.sql.prepare('INSERT INTO records(reference,payload,updated_at) VALUES(?,?,?)').run(reference,JSON.stringify(record),new Date().toISOString());

async function call(path,method='GET',value,token=owner,extra={}){
  const response=await worker.fetch(new Request('https://worker.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},...(value===undefined?{}:{body:JSON.stringify(value)})}),env);
  return {status:response.status,data:await response.json()};
}

const created=await call('/api/admin/team/members','POST',{name:'Robin Test',login:'robin'});
assert.equal(created.status,201);
const signedIn=await call('/api/team/login','POST',{login:'robin',accessKey:created.data.accessKey},'');
assert.equal(signedIn.status,200);const staffToken=signedIn.data.token;
await db.prepare('UPDATE records SET assigned_to=? WHERE reference=?').bind(created.data.id,reference).run();

const labels=await call('/api/admin/operations/materials','POST',{reference});
assert.equal(labels.status,201);assert.equal(labels.data.materials.length,2);assert.match(labels.data.materials[0].displayCode,/^LSM-[A-F0-9]{6}$/);assert.doesNotMatch(labels.data.materials[0].qrValue,/Test|Klant|Hollenhof/);
const material=labels.data.materials[0];
const scan=await call('/api/team/operations/scan/'+material.token,'GET',undefined,staffToken);
assert.equal(scan.status,200);assert.equal(scan.data.work.package,'Goud');
assert.equal((await call('/api/team/operations/scan/'+material.displayCode,'GET',undefined,staffToken)).data.material.id,material.id);
assert.equal((await call(`/api/team/operations/materials/${material.id}/action`,'POST',{action:'receive'},staffToken)).data.material.customerStatus,'Materiaal ontvangen');
assert.equal((await call(`/api/team/operations/materials/${material.id}/action`,'POST',{action:'work_start'},staffToken)).status,200);
const activeDashboard=await call('/api/admin/operations/dashboard');
assert.equal(activeDashboard.data.activeWork.length,1);assert.equal(activeDashboard.data.activeWork[0].display_code,material.displayCode);assert.equal(activeDashboard.data.activeWork[0].planned_seconds,3600);
assert.equal((await call(`/api/team/operations/materials/${material.id}/action`,'POST',{action:'work_complete'},staffToken)).data.material.customerStatus,'Klaar om opgehaald te worden');
assert.equal(db.sql.prepare("SELECT json_extract(payload,'$.customerStatus') status FROM records WHERE reference=?").get(reference).status,'Klaar om opgehaald te worden');

assert.equal((await call('/api/team/operations/availability','PATCH',{dates:[{date:'2099-12-01',preference:'preferred',startTime:'10:00',endTime:'16:30',note:'Overdag'}]},staffToken)).status,200);
const availability=await call('/api/team/operations/availability','GET',undefined,staffToken);assert.equal(availability.data.dates.length,1);assert.equal(availability.data.dates[0].start_time,'10:00');assert.equal(availability.data.dates[0].end_time,'16:30');

assert.equal((await call('/api/team/hrm/setup','POST',{pin:'2468'},staffToken)).status,200);
assert.equal((await call('/api/team/hrm','PATCH',{profile:{email:'robin@example.test',iban:'NL91ABNA0417164300'}},staffToken,{'X-HRM-PIN':'2468'})).status,200);
assert.equal((await call('/api/admin/hrm/setup','POST',{pin:'8642'})).status,200);
assert.equal((await call('/api/admin/hrm/status')).data.configured,true);
assert.equal((await call('/api/admin/hrm/change-pin','POST',{newPin:'9753'},owner,{'X-HRM-PIN':'0000'})).status,403);
assert.equal((await call('/api/admin/hrm/change-pin','POST',{newPin:'9753'},owner,{'X-HRM-PIN':'8642'})).status,200);
assert.equal((await call('/api/admin/hrm/members','GET',undefined,owner,{'X-HRM-PIN':'8642'})).status,403);
assert.equal((await call('/api/admin/hrm/change-pin','POST',{newPin:'8642'},owner,{'X-HRM-PIN':'9753'})).status,200);
assert.equal((await call(`/api/admin/hrm/members/${created.data.id}`,'PATCH',{terms:{payType:'hourly',hourlyRate:18.5,contract:'Testcontract'}},owner,{'X-HRM-PIN':'8642'})).status,200);
const ownHrm=await call('/api/team/hrm','GET',undefined,staffToken,{'X-HRM-PIN':'2468'});
assert.equal(ownHrm.data.profile.iban,'NL91ABNA0417164300');assert.equal(ownHrm.data.terms.hourlyRate,18.5);
assert.ok(ownHrm.data.totals.earnings>=0);assert.ok(ownHrm.data.totals.monthEarnings>=0);
const adminHrm=await call('/api/admin/hrm/members','GET',undefined,owner,{'X-HRM-PIN':'8642'});
assert.equal(adminHrm.status,200);assert.equal(adminHrm.data.members[0].totals.items,1);assert.ok(adminHrm.data.members[0].totals.seconds>=1);assert.ok(adminHrm.data.members[0].totals.monthEarnings>=0);

assert.equal((await call('/api/admin/settings/access-code','POST',{currentCode:owner,newCode:'nieuwe-beheercode'},owner)).status,200);
assert.equal((await call('/api/admin/operations/dashboard','GET',undefined,owner)).status,401);
assert.equal((await call('/api/admin/operations/dashboard','GET',undefined,'nieuwe-beheercode')).status,200);
assert.equal((await call('/api/admin/settings/access-code','POST',{currentCode:'nieuwe-beheercode',newCode:owner},'nieuwe-beheercode')).status,200);

assert.equal((await call('/api/feedback/LS-OPS234','POST',{overall:5,quality:5,communication:4,pickup:5,speed:4,comment:'Prima'},'')).status,201);
const dashboard=await call('/api/admin/operations/dashboard');
assert.equal(dashboard.status,200);assert.equal(dashboard.data.materials.total,2);assert.equal(dashboard.data.feedback.responses,1);

console.log('Operations checks passed: opaque QR labels, scanning, customer status, timers, availability, encrypted HRM, earnings and feedback.');
