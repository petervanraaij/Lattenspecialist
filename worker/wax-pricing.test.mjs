import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {maintenancePriceQuote} from './src/maintenance-pricing.js';
import {maintenanceFixture} from './maintenance-fixture.mjs';import {getWorkflow,materialPlans,validMaintenanceSelection} from './src/inventory.js';
import {readAndValidateLattenspecialist} from './src/index.js';
const context={window:{},Intl};vm.runInNewContext(readFileSync(new URL('../maintenance-selection.js',import.meta.url),'utf8'),context);
for(const w of ['beta','alpha','ultra','performance'])for(const c of [0,1]){const value={p:{zilver:{s:1,b:1,d:0,w,u:false,c}},e:{},u:false};assert.equal(Math.round(context.window.LATTEN_SELECTION.estimate(value).total*100),maintenancePriceQuote(value).knownTotalCents);}
const model=context.window.LATTEN_SELECTION;
const mixed={p:{zilver:{s:1,b:1,d:0,w:'alpha',u:false,c:2,cs:1,cb:1}},e:{},u:false};
assert.equal(model.estimate(mixed).total,94.9);
assert.equal(maintenancePriceQuote(mixed).knownTotalCents,9490);
assert.equal(maintenancePriceQuote(mixed,{firstWaxCount:2,firstWaxSkiCount:1,firstWaxSnowboardCount:1}).knownTotalCents,9490,'Top-level cleaning is not charged twice');
for(const w of ['alpha','ultra','performance'])assert.equal(model.estimate({...mixed,p:{zilver:{...mixed.p.zilver,w}}}).total,94.9);
const onlyBoard={...mixed,p:{zilver:{...mixed.p.zilver,c:1,cs:0,cb:1}}};
assert.equal(model.estimate(onlyBoard).total,92.4);
assert.deepEqual(materialPlans({maintenanceSelection:onlyBoard,firstWaxCount:1,firstWaxSkiCount:0,firstWaxSnowboardCount:1}).map(p=>[p.kind,p.options.extraCleaning]),[['Ski',false],['Snowboard',true]]);
const legacy={p:{zilver:{s:1,b:1,w:'beta',u:false,c:1}},e:{},u:false};
assert.equal(model.normalize(legacy).p.zilver.cs,1);assert.equal(model.normalize(legacy).p.zilver.cb,0);
assert.equal(maintenancePriceQuote(legacy).knownTotalCents,7740);
assert.equal(model.cleaningCount(legacy),1);
assert.equal(Object.hasOwn(model.withoutCleaning(legacy).p.zilver,'cs'),false);
// Legacy top-level cleaning follows package order, even when a snowboard comes first.
// A package-local c remains an independent selection and must not absorb that first item.
for(const c of [0,1]){
 const boardFirst={p:{brons:{s:0,b:1,w:'beta',u:false},zilver:{s:1,b:0,w:'beta',u:false,c}},e:{},u:false};
 const record={maintenanceSelection:JSON.stringify(boardFirst),firstWaxCount:1};
 assert.deepEqual(materialPlans(record).map(p=>[p.kind,p.options.extraCleaning]),[['Snowboard',true],['Ski',Boolean(c)]]);
 assert.equal(maintenancePriceQuote(boardFirst,{firstWaxCount:1}).knownTotalCents,6490+c*250);
}
const genericLegacy={material:'Meerdere / combinatie',amount:'3',package:'Zilver',firstWaxCount:2};
assert.deepEqual(materialPlans(genericLegacy).map(p=>[p.kind,p.options.extraCleaning]),[['Meerdere / combinatie',true],['Meerdere / combinatie',true],['Meerdere / combinatie',false]]);
for(const patch of [{c:2,cs:0,cb:1},{c:2,cs:2,cb:0},{c:1,cs:'1',cb:0},{c:1,cs:-1,cb:2}]){
 const v={...mixed,p:{zilver:{...mixed.p.zilver,...patch}}};assert.equal(model.normalize(v),null);assert.equal(validMaintenanceSelection(v),false);
}
const request={service:'Onderhoud',name:'Prijscontrole',phone:'0612345678',material:'Meerdere / combinatie',amount:'2',package:'Zilver',pickupDate:'In overleg',maintenanceSelection:JSON.stringify(mixed),firstWaxCount:2,firstWaxSkiCount:1,firstWaxSnowboardCount:1};
assert.equal(readAndValidateLattenspecialist(request,true).data.priceQuote.knownTotalCents,9490);
assert.throws(()=>readAndValidateLattenspecialist({...request,firstWaxCount:3,firstWaxSnowboardCount:2},true),/waxreinigingen/);
assert.throws(()=>readAndValidateLattenspecialist({...request,firstWaxCount:1},true),/verdeling/);
assert.throws(()=>readAndValidateLattenspecialist({...request,firstWaxCount:1,firstWaxSkiCount:0},true),/verdeling/);
const storage={p:{},e:{storageSki:{q:2,m:'ski'},storageSnowboard:{q:1,m:'snowboard'}},u:false};
assert.equal(validMaintenanceSelection(storage),true);assert.equal(model.estimate(storage).total,25);assert.equal(model.estimate(storage).amount,3);
assert.equal(model.estimate(storage).needsAssessment,false);assert.equal(model.legacy(storage).amount,'3');
assert.equal(maintenancePriceQuote(storage).knownTotalCents,2500);assert.equal(maintenancePriceQuote(storage).needsAssessment,false);
assert.match(model.notes(storage),/niet afschrapen/);
assert.ok(materialPlans({maintenanceSelection:storage}).every(p=>p.packageCode==='storage_wax'&&p.options.storageWax&&p.waxSku==='24057'&&!p.options.extraCleaning));
const wrongStorage={p:{},e:{storageSki:{q:1,m:'snowboard'}},u:false};assert.equal(model.normalize(wrongStorage),null);assert.equal(validMaintenanceSelection(wrongStorage),false);
const tooMany={p:{brons:{s:20,b:0,w:'beta',u:false}},e:{storageSnowboard:{q:1,m:'snowboard'}},u:false};assert.equal(model.normalize(tooMany),null);assert.equal(validMaintenanceSelection(tooMany),false);
assert.equal(model.estimate({p:{slijpen:{s:1,b:1,w:'none',u:false}},e:{},u:false}).total,49.9);
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
 const storedRecord=JSON.parse(f.sql.prepare('SELECT payload FROM records LIMIT 1').get().payload);
 const storageRecord={...storedRecord,reference:'LS-2611-STOREX',amount:'3',material:'Meerdere / combinatie',package:'Opslagwax',firstWaxCount:0,maintenanceSelection:JSON.stringify(storage)};
 f.sql.prepare('INSERT INTO records(reference,payload,assigned_to,updated_at) VALUES(?,?,?,?)').run(storageRecord.reference,JSON.stringify(storageRecord),f.member.id,storageRecord.updatedAt);
 const created=await f.call('/api/admin/operations/materials','POST',{reference:storageRecord.reference});assert.equal(created.status,201);
 const workflow=await f.call('/api/team/operations/materials/'+created.data.materials[0].id+'/workflow','GET',undefined,f.staff);
 assert.equal(workflow.data.material.storageWax,true);
 const storageFlow=workflow.data.workflow.steps,codes=storageFlow.map(s=>s.code);
 assert.ok(codes.includes('wax')&&codes.includes('storage_cool'));
 assert.ok(!codes.includes('scrape')&&!codes.includes('brush')&&!codes.includes('base_wax'));
 assert.match(storageFlow.find(s=>s.code==='wax').guide.goal,/zonder afschrapen/);
 assert.match(storageFlow.find(s=>s.code==='storage_cool').guide.steps.join(' '),/Niet afschrapen/);
 const beforeIds=storageFlow.map(s=>s.id);
 const same=await f.call('/api/team/operations/materials/'+created.data.materials[0].id+'/workflow','GET',undefined,f.staff);
 assert.deepEqual(same.data.workflow.steps.map(s=>s.id),beforeIds,'Existing workflow remains intact on reread');
 console.log('PASS shared prices red/extra yellow/blue/purple, optional cleaning; red base, cleaning yellow and final yellow recorded separately');
}finally{f.close();}
