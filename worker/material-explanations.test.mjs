import assert from 'node:assert/strict';
import {toolInstruction,documentedToolSkus} from './src/tool-instructions.js';
import {explainedMaterialSkus} from './src/material-explanations.js';
import {maintenanceFixture} from './maintenance-fixture.mjs';
assert.deepEqual([...explainedMaterialSkus].sort(),[...documentedToolSkus].sort());
for(const sku of documentedToolSkus){const guide=toolInstruction(sku);assert.ok(guide.what.length>40,sku);assert.ok(guide.goal&&guide.steps.length>=2);}
assert.equal(toolInstruction('24121').settings.find(s=>s.label==='Waxijzer').value,'135-145 °C');
assert.equal(toolInstruction('24057').settings.find(s=>s.label==='Sneeuwtemperatuur').value,'-4 tot -14 °C');
assert.match(toolInstruction('25018').settings.find(s=>s.label==='Waxijzer').value,/Geen/);
assert.equal(toolInstruction('20687set').variants.length,4);assert.equal(toolInstruction('24684').variants.length,3);
const f=await maintenanceFixture();
try{
 const stock=()=>f.sql.prepare('SELECT sku,on_hand,on_order FROM inventory_items ORDER BY sku').all();const before=stock();
 const catalog=await f.call('/api/admin/inventory/guides'),item=catalog.data.tools.find(t=>t.sku==='24684');
 const guide={title:item.guide.title,goal:item.guide.goal,what:'Een door de eigenaar aangevulde beschrijving van deze diamantsteen.',supplies:item.guide.supplies,steps:item.guide.steps,stop:item.guide.stop,checks:item.guide.checks.map(c=>c.label),videos:[]};
 const saved=await f.call('/api/admin/inventory/guides/'+item.code,'PATCH',{revision:item.revision,guide});assert.equal(saved.status,200);assert.equal(saved.data.guide.what,guide.what);assert.equal(saved.data.guide.variants.length,3);
 const staff=await f.call('/api/team/guides','GET',undefined,f.staff);assert.equal(staff.status,200);assert.equal(staff.data.tools.find(t=>t.sku==='24684').guide.what,guide.what);
 assert.equal((await f.call('/api/admin/inventory/guides/'+item.code,'PATCH',{revision:1,guide:{...guide,what:''}})).status,400);assert.deepEqual(stock(),before);
 console.log('PASS alle 23 materiaaluitleggen, gecontroleerde waxwaarden, borstel-/vijlverschillen, centrale bewerkbare uitleg, medewerkersrechten en ongewijzigde voorraad');
}finally{f.close();}
