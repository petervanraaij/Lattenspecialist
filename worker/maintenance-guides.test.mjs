import assert from 'node:assert/strict';
import {maintenanceGuide,guideConfirmation,GUIDE_VERSION} from './src/maintenance-guides.js';
import {materialPlans} from './src/inventory.js';
import {maintenanceFixture} from './maintenance-fixture.mjs';

const codes=['inspection','setup','bindings_off','repair','filing','structure','clean','deep_clean','wax','scrape','brush','bindings_on','waxstick','finish','practice_wax','practice_filing'];
for(const code of codes){const guide=maintenanceGuide(code,{kind:'Ski',package_name:'Zilver'});assert.ok(guide.steps.length>=2,code);assert.ok(guide.supplies.length,code);assert.ok(guide.checks.length>=2,code);assert.equal(new Set(guide.checks.map(item=>item.id)).size,guide.checks.length);for(const link of [...guide.videos,...guide.sources])assert.equal(new URL(link.url).protocol,'https:');assert.deepEqual(guideConfirmation(code,{}, {version:GUIDE_VERSION,checkedIds:maintenanceGuide(code).checks.map(item=>item.id)}).checks,maintenanceGuide(code).checks);}
assert.equal(guideConfirmation('wax',{},undefined),null,'older installed clients remain compatible without inventing a confirmation');
for(const invalid of [null,{}, {version:'old',checkedIds:[]},{version:GUIDE_VERSION,checkedIds:['product','product','weight']},{version:GUIDE_VERSION,checkedIds:['product','heat']},{version:GUIDE_VERSION,checkedIds:['product','heat','weight','extra']}])assert.throws(()=>guideConfirmation('wax',{},invalid));
const complex=maintenanceGuide('repair',{selected_options:JSON.stringify({complexRepair:true})});assert.match(complex.title,/Complexe/);assert.equal(complex.videos.length,0);assert.ok(complex.steps[0].includes('pauzeer'));assert.doesNotMatch(complex.steps.join(' '),/vul.*strip/i);
assert.match(maintenanceGuide('structure').stop.join(' '),/geen nieuwe/);assert.match(maintenanceGuide('filing').stop.join(' '),/geen willekeurige/);assert.match(maintenanceGuide('wax').stop.join(' '),/sneeuwtemperatuur/);
for(const id of ['slijpen','brons','zilver','goud','platinum']){const [plan]=materialPlans({maintenanceSelection:JSON.stringify({p:{[id]:{s:1,b:0,w:id==='slijpen'?'none':'beta',u:false}},e:{},u:false})});assert.ok(plan.packageCode);assert.equal(plan.kind,'Ski');}
for(const id of ['edges','repair','complex','bindings']){const [plan]=materialPlans({maintenanceSelection:JSON.stringify({p:{},e:{[id]:{q:1,m:id==='bindings'?'snowboard':'ski'}},u:false})});assert.ok(plan);assert.equal(Boolean(plan.options.complexRepair),id==='complex');}
console.log('PASS All packages, sixteen instruction variants, complex repair, product settings and confirmation validation');

const f=await maintenanceFixture();
try{
 const listed=await f.call('/api/team/operations/materials?reference=LS-2610-GUIDEX','GET',undefined,f.staff);assert.equal(listed.status,200);assert.equal(listed.data.materials.length,2);
 const ski=f.materials.find(item=>item.kind==='Ski'),board=f.materials.find(item=>item.kind==='Snowboard');assert.ok(ski&&board);
 const own=await f.call('/api/admin/operations/materials/'+ski.id+'/workflow');assert.equal(own.status,200);const steps=own.data.workflow.steps;assert.ok(steps.some(step=>step.code==='repair'));assert.ok(steps.some(step=>step.code==='deep_clean'));assert.ok(!steps.some(step=>step.code==='bindings_off'));assert.equal(steps.find(step=>step.code==='wax').guide.waxType,'AlphaMix Yellow');assert.ok(steps.every(step=>step.guide.version===GUIDE_VERSION));
 const boardWorkflow=await f.call('/api/team/operations/materials/'+board.id+'/workflow','GET',undefined,f.staff);assert.ok(boardWorkflow.data.workflow.steps.some(step=>step.code==='bindings_off'));assert.ok(boardWorkflow.data.workflow.steps.some(step=>step.code==='bindings_on'));assert.ok(boardWorkflow.data.workflow.steps.some(step=>step.code==='structure'));
 assert.equal((await f.call('/api/admin/operations/materials/'+ski.id+'/workflow','GET',undefined,f.staff)).status,401);assert.equal((await f.call('/api/team/operations/materials/'+ski.id+'/workflow','GET',undefined,'')).status,401);
 const second=await f.call('/api/admin/team/members','POST',{name:'Andere medewerker',login:'other.fixture'}),other=await f.call('/api/team/login','POST',{login:'other.fixture',accessKey:second.data.accessKey},'');assert.equal((await f.call('/api/team/operations/materials/'+ski.id+'/workflow','GET',undefined,other.data.token)).status,403);assert.equal((await f.call('/api/team/operations/materials?reference=LS-2610-GUIDEX','GET',undefined,other.data.token)).status,404);
 assert.equal((await f.call('/api/team/operations/steps/'+steps[1].id+'/start','POST',{},f.staff)).status,409,'a later step cannot start');
 const first=steps[0];assert.equal((await f.call('/api/team/operations/steps/'+first.id+'/start','POST',{},f.staff)).status,200);
 const before=f.sql.prepare('SELECT COUNT(*) amount FROM material_events').get().amount;
 assert.equal((await f.call('/api/team/operations/steps/'+first.id+'/finish','POST',{toolSkus:[],guideChecks:{version:GUIDE_VERSION,checkedIds:[]}},f.staff)).status,400);assert.equal(f.sql.prepare('SELECT status FROM maintenance_steps WHERE id=?').get(first.id).status,'in_progress');assert.equal(f.sql.prepare('SELECT COUNT(*) amount FROM material_events').get().amount,before,'incomplete checks do not create evidence');
 const checks={version:GUIDE_VERSION,checkedIds:first.guide.checks.map(item=>item.id)},done=await f.call('/api/team/operations/steps/'+first.id+'/finish','POST',{toolSkus:[],guideChecks:checks},f.staff);assert.equal(done.status,200);const confirmed=done.data.workflow.steps[0].guideConfirmation;assert.equal(confirmed.guideVersion,GUIDE_VERSION);assert.deepEqual(confirmed.checks,first.guide.checks);assert.ok(confirmed.confirmedAt);
 assert.equal((await f.call('/api/team/operations/steps/'+first.id+'/finish','POST',{guideChecks:checks},f.staff)).status,409);assert.equal(f.sql.prepare("SELECT COUNT(*) amount FROM material_events WHERE event_type='step_checks'").get().amount,1);
 const reload=await f.call('/api/team/operations/materials/'+ski.id+'/workflow','GET',undefined,f.staff);assert.deepEqual(reload.data.workflow.steps[0].guideConfirmation,confirmed);
 assert.notEqual(f.sql.prepare("SELECT json_extract(payload,'$.currentStep') step FROM records WHERE reference=?").get(ski.reference).step,8);
 console.log('PASS Per-material choices, owner-read-only preview, assignment, sequential work, invalid checks, durable confirmation and retry protection');
}finally{f.close();}
