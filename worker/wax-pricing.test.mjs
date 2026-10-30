import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {maintenancePriceQuote} from './src/maintenance-pricing.js';
import {maintenanceFixture} from './maintenance-fixture.mjs';import {getWorkflow} from './src/inventory.js';
const context={window:{},Intl};vm.runInNewContext(readFileSync(new URL('../maintenance-selection.js',import.meta.url),'utf8'),context);
for(const w of ['beta','alpha','ultra','performance'])for(const c of [0,1]){const value={p:{zilver:{s:1,b:1,d:0,w,u:false,c}},e:{},u:false};assert.equal(Math.round(context.window.LATTEN_SELECTION.estimate(value).total*100),maintenancePriceQuote(value).knownTotalCents);}
const f=await maintenanceFixture();try{
 const ski=f.materials.find(m=>m.kind==='Ski'),row=()=>f.sql.prepare('SELECT * FROM materials WHERE id=?').get(ski.id);
 let flow=await getWorkflow(f.db,row());assert.ok(flow.steps.find(s=>s.code==='base_wax').order<flow.steps.find(s=>s.code==='wax').order);
 const oldBase=flow.steps.find(s=>s.code==='base_wax');f.sql.prepare('DELETE FROM maintenance_steps WHERE id=?').run(oldBase.id);f.sql.prepare('UPDATE maintenance_steps SET step_order=step_order-1 WHERE material_id=? AND step_order>?').run(ski.id,oldBase.order);flow=await getWorkflow(f.db,row());assert.equal(flow.steps.filter(s=>s.code==='base_wax').length,1);const ids=flow.steps.map(s=>s.id);assert.deepEqual((await getWorkflow(f.db,row())).steps.map(s=>s.id),ids);
 const yellow=flow.steps.find(s=>s.code==='deep_clean'),base=flow.steps.find(s=>s.code==='base_wax'),final=flow.steps.find(s=>s.code==='wax');
 const initial=sku=>Number(f.sql.prepare('SELECT on_hand FROM inventory_items WHERE sku=?').get(sku).on_hand),red=initial('24057'),gold=initial('24101');
 for(const [step,before,after]of [[yellow,150,148],[base,180,176],[final,148,145]]){
  f.sql.prepare("UPDATE maintenance_steps SET status='completed' WHERE material_id=? AND step_order<?").run(ski.id,step.order);
  const start=await f.call('/api/team/operations/steps/'+step.id+'/start','POST',{startWeight:before,guideVersion:step.guide.version},f.staff);assert.equal(start.status,200,JSON.stringify(start));
  const result=await f.call('/api/team/operations/steps/'+step.id+'/finish','POST',{endWeight:after,toolSkus:[],guideChecks:{version:step.guide.version,checkedIds:step.guide.checks.map(c=>c.id)}},f.staff);assert.equal(result.status,200,JSON.stringify(result));
 }
 assert.equal(initial('24057'),red-4);assert.equal(initial('24101'),gold-5);
 const usage=f.sql.prepare('SELECT step_id,sku,quantity FROM maintenance_usage WHERE material_id=?').all(ski.id);assert.ok(usage.some(x=>x.step_id===yellow.id&&x.quantity===2));assert.ok(usage.some(x=>x.step_id===final.id&&x.quantity===3));
 console.log('PASS shared prices red/extra yellow/blue/purple, optional cleaning; red base, cleaning yellow and final yellow recorded separately');
}finally{f.close();}
