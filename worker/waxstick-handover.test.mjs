import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './src/index.js';
import {ensureWorkflow} from './src/inventory.js';
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');for(const name of ['0001_team.sql','0002_operations.sql','0003_availability_times.sql','0004_inventory_workflow.sql','0005_accounting.sql'])this.sql.exec(readFileSync(new URL('./team-migrations/'+name,import.meta.url),'utf8'));}
 prepare(query){const sql=this.sql;let values=[];const s={bind(...args){values=args;return s;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return{results:sql.prepare(query).all(...values)};},async run(){return{meta:sql.prepare(query).run(...values)};},exec(){const q=sql.prepare(query);return q.columns().length?{results:q.all(...values)}:{results:[],meta:q.run(...values)};}};return s;}
 async batch(statements){this.sql.exec('BEGIN');try{const result=statements.map(s=>s.exec());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
const db=new D1(),origin='https://lattenspecialist.nl',owner='test-owner',stamp=new Date().toISOString(),env={LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_ADMIN_TOKEN:owner,LATTENSPECIALIST_ORIGINS:origin};
async function call(reference,method='GET',value,token=owner){const response=await worker.fetch(new Request('https://worker.test/api/admin/inventory/waxsticks/'+reference,{method,headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},...(value?{body:JSON.stringify(value)}:{})}),env);return{status:response.status,data:await response.json()};}
function order(reference,count){db.sql.prepare('INSERT INTO records(reference,payload,updated_at) VALUES(?,?,?)').run(reference,JSON.stringify({reference,service:'Onderhoud',waxstickCount:count}),stamp);}
const stock=()=>db.sql.prepare("SELECT on_hand FROM inventory_items WHERE sku='25018'").get().on_hand;
db.sql.prepare("UPDATE inventory_items SET on_hand=5,average_cost_per_base=8,updated_at=? WHERE sku='25018'").run(stamp);
const reference='LS-2611-ABC234';order(reference,2);
assert.equal((await call(reference,'GET',null,'wrong')).status,401);
assert.equal((await call('LS-2611-XYZ234')).status,404);
assert.equal((await call(reference)).data.remaining,2);assert.equal(stock(),5,'bekijken boekt niets af');
assert.equal((await call(reference,'POST',{})).status,400);
const attempts=await Promise.all([call(reference,'POST',{confirmed:true}),call(reference,'POST',{confirmed:true})]);
assert.deepEqual(attempts.map(x=>x.status),[200,200]);assert.equal(stock(),3,'gelijktijdig klikken boekt eenmaal af');
assert.equal((await call(reference)).data.remaining,0);assert.ok((await call(reference)).data.handedOverAt);
assert.equal((await call(reference,'POST',{confirmed:true})).data.alreadyHandedOver,true);assert.equal(stock(),3);
assert.equal(db.sql.prepare("SELECT COUNT(*) amount FROM inventory_movements WHERE reference_id=? AND reference_type='reservation_product'").get(reference).amount,1);
order('LS-2611-BCD234',4);assert.equal((await call('LS-2611-BCD234','POST',{confirmed:true})).status,409);assert.equal(stock(),3);
assert.equal(db.sql.prepare("SELECT COUNT(*) amount FROM waxstick_handovers WHERE reference='LS-2611-BCD234'").get().amount,0);
order('LS-2611-CDE234',0);assert.equal((await call('LS-2611-CDE234','POST',{confirmed:true})).status,409);
// Legacy workshop deductions count as handed out and must never be booked again.
const legacy='LS-2611-DEF234';order(legacy,1);
db.sql.prepare('INSERT INTO members(id,name,login,key_hash,created_at) VALUES(?,?,?,?,?)').run('member','Test','test','hash',stamp);
db.sql.prepare('INSERT INTO materials(id,scan_token,display_code,reference,item_number,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run('material','scan','LSM-ABC234',legacy,1,'Ski',stamp,stamp);
db.sql.prepare("INSERT INTO maintenance_steps(id,material_id,step_order,step_code,title,instruction,procedure,status,created_at) VALUES('step','material',1,'waxstick','Waxstick meegeven','Oud','finish','completed',?)").run(stamp);
db.sql.prepare("INSERT INTO maintenance_usage(id,step_id,material_id,sku,quantity,unit,cost_snapshot,is_training,member_id,created_at) VALUES('usage','step','material','25018',1,'stuk',8,0,'member',?)").run(stamp);
assert.equal((await call(legacy)).data.legacyBooked,1);assert.equal((await call(legacy)).data.remaining,1);
assert.equal((await call(legacy,'POST',{confirmed:true})).data.alreadyHandedOver,false);assert.equal(stock(),3,'werkplaatsboeking wordt niet dubbel afgeboekt');
assert.equal((await call(legacy)).data.delivered,1);assert.equal((await call(legacy,'POST',{confirmed:true})).data.alreadyHandedOver,true);
// Preparing a waxstick is a workshop task; its definition promises no stock deduction.
const material={id:'prepare',kind:'Ski',package_code:'file_only',selected_options:JSON.stringify({waxstickCount:2})};
db.sql.prepare('INSERT INTO materials(id,scan_token,display_code,reference,item_number,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run('prepare','scan2','LSM-BCD234',reference,2,'Ski',stamp,stamp);
await ensureWorkflow(db,material);
assert.match(db.sql.prepare("SELECT instruction FROM maintenance_steps WHERE material_id='prepare' AND step_code='waxstick'").get().instruction,/daadwerkelijk meegeven later/);
assert.equal(stock(),3);
order('LS-2611-EFG234',2);order('LS-2611-FGH234',2);
const competing=await Promise.all([call('LS-2611-EFG234','POST',{confirmed:true}),call('LS-2611-FGH234','POST',{confirmed:true})]);
assert.deepEqual(competing.map(result=>result.status).sort(),[200,409]);
assert.equal(stock(),1,'concurrerende opdrachten kunnen geen negatieve voorraad maken');
assert.equal(db.sql.prepare('SELECT COUNT(*) amount FROM waxstick_handovers').get().amount,3,'mislukte afboeking slaat geen overdracht op');
console.log('Waxstickoverdracht: toegang, voorraad, dubbeltellingen, tekort, oudere boekingen en werkplaatsvoorbereiding gecontroleerd.');
