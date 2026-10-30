import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
import {getWorkflow} from './src/inventory.js';
const f=await maintenanceFixture();
try{
 const catalog=await f.call('/api/admin/inventory/guides');assert.equal(catalog.status,200);assert.ok(catalog.data.guides.length===17);assert.ok(catalog.data.guides.every(item=>!item.code.startsWith('practice_')));
 assert.equal(catalog.data.tools.length,23);assert.ok(catalog.data.tools.every(tool=>tool.guide.documented));assert.ok(catalog.data.tools.every(tool=>!('averageCostPerBase' in tool)&&!('iban' in tool)));
 const item=catalog.data.guides.find(item=>item.code==='repair'),guide={...item.guide,steps:['Controleer samen de oppervlakkige beschadiging.','Voer het afgesproken kleine herstel uit.'],checks:['Controleer het resultaat.'],videos:[]};
 const body=revision=>({revision,guide});
 assert.equal((await f.call('/api/admin/inventory/guides/repair','PATCH',body(0),f.staff)).status,401);
 assert.equal((await f.call('/api/admin/inventory/guides/repair','PATCH',{...body(0),guide:{...guide,videos:['https://example.test/film']}})).status,400);
 const saved=await f.call('/api/admin/inventory/guides/repair','PATCH',body(0));assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 assert.equal((await f.call('/api/admin/inventory/guides/repair','PATCH',body(0))).status,409);
 const practice=await f.call('/api/team/practice','POST',{kind:'Ski',activity:'repair'},f.staff),step=practice.data.workflow.steps[0];assert.ok(step.guide.steps.includes(guide.steps[0]));assert.match(step.guide.stop.join(' '),/zichtbare kern/);assert.ok(step.guide.checks.some(item=>item.id==='practice'));
 assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/start','POST',{},f.staff)).status,409);
 assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/start','POST',{guideVersion:step.guide.version},f.staff)).status,200);
 guide.steps=['Nieuwere instructie voor nieuwe opdrachten.','Controleer dit resultaat apart.'];assert.equal((await f.call('/api/admin/inventory/guides/repair','PATCH',body(1))).status,200);
 const material=f.sql.prepare('SELECT * FROM materials WHERE id=?').get(practice.data.material.id),held=await getWorkflow(f.db,material);assert.equal(held.steps[0].guide.version,step.guide.version);assert.ok(held.steps[0].guide.steps.includes('Controleer samen de oppervlakkige beschadiging.'));
 assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/finish','POST',{repairStrips:1,repairColor:'transparent',toolSkus:[]},f.staff)).status,400);
 assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/finish','POST',{repairStrips:1,repairColor:'transparent',toolSkus:[],guideChecks:{version:step.guide.version,checkedIds:step.guide.checks.map(item=>item.id)}},f.staff)).status,200);
 const ski=f.sql.prepare('SELECT * FROM materials WHERE id=?').get(f.materials[0].id);await getWorkflow(f.db,ski);
 let selects=0;const original=f.db.prepare.bind(f.db);f.db.prepare=query=>{if(/^SELECT/i.test(query))selects++;return original(query);};const workflow=await getWorkflow(f.db,ski);assert.ok(workflow.steps.length>6);assert.ok(selects<=13,`Workflow caused ${selects} SELECT statements`);
 console.log('PASS gedeelde bewerkbare instructies, veilige oefenaanvulling, versiebevestiging, onveranderlijke startversie, rechten en maximaal 12 workflow-selecties');
}finally{f.close();}

