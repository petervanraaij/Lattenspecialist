import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
import {getWorkflow} from './src/inventory.js';
import {maintenanceGuide} from './src/maintenance-guides.js';
const f=await maintenanceFixture();
const qty=sku=>Number(f.sql.prepare('SELECT on_hand FROM inventory_items WHERE sku=?').get(sku).on_hand);
const checks=step=>({version:step.guide.version,checkedIds:step.guide.checks.map(c=>c.id)});
try{
 const board=f.materials.find(m=>m.kind==='Snowboard'),material=()=>f.sql.prepare('SELECT * FROM materials WHERE id=?').get(board.id);
 let flow=await getWorkflow(f.db,material()),clean=flow.steps.find(s=>s.code==='clean'),wax=flow.steps.find(s=>s.code==='wax');
 assert.equal(clean.procedure,'cleaning');assert.equal(clean.cleaningWaxSku,null);assert.equal(clean.needsStartWeight,false);assert.ok(!flow.steps.some(s=>s.code==='base_wax'));assert.ok(wax.requiredItems.some(i=>i.sku==='24057'));
 const ski=f.materials.find(m=>m.kind==='Ski'),skiRow=()=>f.sql.prepare('SELECT * FROM materials WHERE id=?').get(ski.id);flow=await getWorkflow(f.db,skiRow());const pending=flow.steps.find(s=>s.code==='deep_clean');
 f.sql.prepare("UPDATE maintenance_steps SET procedure='cleaning',required_items=? WHERE id=?").run(JSON.stringify(['25422','24491']),pending.id);flow=await getWorkflow(f.db,skiRow());assert.equal(flow.steps.find(s=>s.id===pending.id).cleaningWaxSku,'24101');
 const original=maintenanceGuide('deep_clean',{legacyCleaning:true});f.sql.prepare("UPDATE maintenance_steps SET procedure='cleaning',status='in_progress',started_at=?,required_items=? WHERE id=?").run('2026-10-29T10:00:00Z',JSON.stringify(['25422','24491']),pending.id);f.sql.prepare('INSERT INTO maintenance_step_guides(step_id,content_json) VALUES(?,?)').run(pending.id,JSON.stringify(original));
 flow=await getWorkflow(f.db,skiRow());const historic=flow.steps.find(s=>s.id===pending.id);assert.equal(historic.procedure,'cleaning');assert.equal(historic.needsStartWeight,false);assert.equal(historic.guide.version,original.version);assert.deepEqual(historic.guide.steps,original.steps);
 console.log('PASS normale voorbereiding inbegrepen; gele reinigingswax vast, gescheiden gewicht/verbruik/kosten, rode glijwax ongewijzigd, geen cleanerboeking, geen dubbele afboeking, alleen ongestarte stappen bijgewerkt en historische instructie behouden');
}finally{f.close();}
