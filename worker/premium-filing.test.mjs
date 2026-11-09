import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {maintenanceFixture} from './maintenance-fixture.mjs';import {materialPlans,getWorkflow,validMaintenanceSelection} from './src/inventory.js';import {maintenancePriceQuote} from './src/maintenance-pricing.js';
const ctx={window:{},Intl};vm.runInNewContext(readFileSync(new URL('../maintenance-selection.js',import.meta.url),'utf8'),ctx);const m=ctx.window.LATTEN_SELECTION;
for(const id of ['slijpen','zilver','goud','platinum'])for(const [s,b]of [[1,0],[0,1],[2,1]]){const value={p:{[id]:{s,b,w:id==='slijpen'?'none':'beta',d:0,u:false,f:true}},e:{},u:false};assert.equal(validMaintenanceSelection(value),true);assert.equal(m.normalize(value).p[id].f,true);const plain=structuredClone(value);delete plain.p[id].f;assert.equal(maintenancePriceQuote(value).knownTotalCents-maintenancePriceQuote(plain).knownTotalCents,(['goud','platinum'].includes(id)?0:(s+b)*750));assert.equal(Math.round(m.estimate(value).total*100),maintenancePriceQuote(value).knownTotalCents);assert.ok(materialPlans({maintenanceSelection:JSON.stringify(value)}).every(p=>p.options.premiumFiling));assert.match(['goud','platinum'].includes(id)?m.describe(value).join(' '):m.notes(value),/premium/);}
for(const f of ['true',1,null]){const v={p:{zilver:{s:1,b:0,w:'beta',u:false,f}},e:{},u:false};assert.equal(validMaintenanceSelection(v),false);assert.equal(m.normalize(v),null);}
assert.equal(validMaintenanceSelection({p:{brons:{s:1,b:0,w:'beta',u:false,f:true}},e:{},u:false}),false);
for(const id of ['goud','platinum'])for(const f of [false,true]){
 const v={p:{[id]:{s:1,b:1,w:'beta',u:false,f}},e:{},u:false};
 assert.equal(maintenancePriceQuote(v).knownTotalCents,id==='goud'?8990:10490);
 assert.equal(m.estimate(v).total,id==='goud'?89.9:104.9);
 assert.ok(materialPlans({maintenanceSelection:v}).every(p=>p.options.premiumFiling&&p.options.premiumIncluded));
 assert.equal(materialPlans({package:id==='goud'?'Goud':'Platinum',material:'Ski',amount:1})[0].options.premiumIncluded,true);
}
const f=await maintenanceFixture();try{
 const old=JSON.parse(f.sql.prepare('SELECT payload FROM records LIMIT 1').get().payload);
 const record={...old,reference:'LS-2611-GOLDXX',amount:'1',maintenanceSelection:JSON.stringify({p:{goud:{s:1,b:0,w:'beta',u:false}},e:{},u:false})};
 f.sql.prepare('INSERT INTO records(reference,payload,assigned_to,updated_at) VALUES(?,?,?,?)').run(record.reference,JSON.stringify(record),f.member.id,record.updatedAt);
 const created=await f.call('/api/admin/operations/materials','POST',{reference:record.reference});assert.equal(created.status,201);
 const work=await f.call('/api/team/operations/materials/'+created.data.materials[0].id+'/workflow','GET',undefined,f.staff);
 assert.equal(work.data.material.premiumIncluded,true);
 const goldCodes=work.data.workflow.steps.map(s=>s.code);assert.ok(goldCodes.indexOf('filing')<goldCodes.indexOf('premium_diamond'));assert.ok(goldCodes.indexOf('premium_diamond')<goldCodes.indexOf('premium_file'));assert.ok(!goldCodes.includes('structure'));
const res=await f.call('/api/team/practice','POST',{kind:'ski',activity:'filing',premiumFiling:true},f.staff);assert.equal(res.status,201);const codes=res.data.workflow.steps.map(s=>s.code);assert.deepEqual(codes,['practice_filing','premium_diamond','premium_file']);const diamond=res.data.workflow.steps[1];assert.ok(diamond.requiredItems.some(x=>x.sku==='20551'));assert.ok(!diamond.requiredItems.some(x=>x.sku==='24684'));assert.match(diamond.guide.steps.join(' '),/24483/);assert.equal((await f.call('/api/team/operations/steps/'+diamond.id+'/start','POST',{guideVersion:diamond.guide.version},f.staff)).status,409);const repair=await f.call('/api/team/practice','POST',{kind:'ski',activity:'repair'},f.staff);assert.equal(repair.status,201);assert.equal(repair.data.workflow.steps[0].code,'practice_repair');console.log('PASS premium scope, strict booleans, price parity, material propagation, ordered practice steps, real kit, and small repairs');}finally{f.close();}
