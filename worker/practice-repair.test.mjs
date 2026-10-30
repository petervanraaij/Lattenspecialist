import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
const f=await maintenanceFixture();
try{
 const result=await f.call('/api/team/practice','POST',{kind:'Ski',activity:'repair'},f.staff);assert.equal(result.status,201);assert.equal(result.data.material.isTraining,true);
 const step=result.data.workflow.steps[0];assert.equal(step.code,'practice_repair');assert.match(step.guide.title,/kleine belagreparaties/i);assert.match(step.guide.stop.join(' '),/zichtbare kern/);assert.ok(step.requiredItems.some(i=>i.sku==='24408'));
 assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/start','POST',{},f.staff)).status,200);
 const before=f.sql.prepare("SELECT on_hand FROM inventory_items WHERE sku='24408'").get().on_hand;
 const finish=await f.call('/api/team/operations/steps/'+step.id+'/finish','POST',{repairStrips:1,repairColor:'transparent',toolSkus:[],guideChecks:{version:step.guide.version,checkedIds:step.guide.checks.map(i=>i.id)}},f.staff);assert.equal(finish.status,200);assert.equal(finish.data.workflow.steps[0].status,'completed');assert.equal(f.sql.prepare("SELECT on_hand FROM inventory_items WHERE sku='24408'").get().on_hand,before-1);
 assert.equal(f.sql.prepare('SELECT is_training FROM maintenance_step_sessions WHERE step_id=?').get(step.id).is_training,1);
 assert.equal(f.sql.prepare('SELECT is_training FROM maintenance_usage WHERE step_id=? AND sku=?').get(step.id,'24408').is_training,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM records WHERE reference=?').get(result.data.material.reference).n,0);
 assert.equal((await f.call('/api/team/practice','POST',{kind:'Ski',activity:'structural_repair'},f.staff)).status,400);
 console.log('PASS kleine reparaties: stappen, bevestiging, werkelijk verbruik en scheiding van klantwerk/productie');
}finally{f.close();}

