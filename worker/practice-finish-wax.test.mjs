import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
const f=await maintenanceFixture();
try {
 for(const [finishWax,sku]of [['none',''],['alpha','24101'],['ultra','24121'],['performance','27933']]){
  const result=await f.call('/api/team/practice','POST',{kind:'Ski',activity:'wax',waxSku:'24057',waxProtocol:'yellow-red',finishWax},f.staff);assert.equal(result.status,201);const steps=result.data.workflow.steps;assert.deepEqual(steps.map(s=>s.code),sku?['practice_clean','practice_wax','practice_finish_wax']:['practice_clean','practice_wax']);const stocks=new Map(['24101','24057','24121','27933'].map(s=>[s,Number(f.sql.prepare('SELECT on_hand FROM inventory_items WHERE sku=?').get(s).on_hand)]));
  if(sku){assert.equal(steps[2].waxDetails.sku,sku);assert.equal(steps[2].needsStartWeight,true);assert.equal((await f.call('/api/team/operations/steps/'+steps[2].id+'/start','POST',{startWeight:150},f.staff)).status,409);}
  for(const [index,step]of steps.entries()){
   const base='/api/team/operations/steps/'+step.id;
   if(index===2)assert.equal((await f.call(base+'/start','POST',{startWeight:200,waxSku:'24057'},f.staff)).status,400);
   assert.equal((await f.call(base+'/start','POST',{startWeight:200,guideVersion:step.guide.version},f.staff)).status,200);
   const body={endWeight:199-index,toolSkus:[],guideChecks:{version:step.guide.version,checkedIds:step.guide.checks.map(c=>c.id)}};
   assert.equal((await f.call(base+'/finish','POST',body,f.staff)).status,200);
   assert.equal((await f.call(base+'/finish','POST',body,f.staff)).status,409);
  }
  assert.equal(Number(f.sql.prepare("SELECT on_hand FROM inventory_items WHERE sku='24057'").get().on_hand),stocks.get('24057')-2);
  assert.equal(Number(f.sql.prepare("SELECT on_hand FROM inventory_items WHERE sku='24101'").get().on_hand),stocks.get('24101')-1-(sku==='24101'?3:0));
  if(sku&&sku!=='24101')assert.equal(Number(f.sql.prepare('SELECT on_hand FROM inventory_items WHERE sku=?').get(sku).on_hand),stocks.get(sku)-3);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM maintenance_measurements WHERE material_id=?').get(result.data.material.id).n,steps.length*2);
  assert.ok(f.sql.prepare('SELECT is_training FROM maintenance_usage WHERE material_id=?').all(result.data.material.id).every(x=>x.is_training===1));
 }
 for(const raw of [{kind:'Ski',activity:'wax',waxProtocol:'yellow-red',finishWax:'other'},{kind:'Ski',activity:'filing',finishWax:'alpha'},{kind:'Ski',activity:'wax',finishWax:'alpha'},{kind:'Ski',activity:'filing',premiumFiling:'true'}])assert.equal((await f.call('/api/team/practice','POST',raw,f.staff)).status,400);
 console.log('PASS standard red and optional yellow/blue/purple practice sequence, assigned wax validation, independent weights and stock, idempotency, and training exclusion');
} finally { f.close(); }
