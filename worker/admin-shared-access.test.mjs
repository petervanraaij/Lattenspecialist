import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
const f=await maintenanceFixture();Object.assign(f.env,{LATTENSPECIALIST_ADMIN_SECURITY_ENABLED:'false',HRM_DATA_KEY:Buffer.alloc(32,6).toString('base64')});
try{
 const state=await f.call('/api/admin/security/status');assert.deepEqual(state.data,{enabled:false,unlocked:true});
 const record=(await f.call('/api/admin/reservations')).data.records[0];assert.equal(record.email,'fixture@example.test');assert.equal(record.workspaceOnly,undefined);
 for(const path of ['/api/admin/inventory/overview','/api/admin/operations/customers','/api/admin/inventory/guides','/api/admin/accounting/overview','/api/admin/hrm/members','/api/admin/operations/workplace/availability']){
  const result=await f.call(path);assert.equal(result.status,200,path+' '+JSON.stringify(result.data));
  assert.equal((await f.call(path,'GET',undefined,'')).status,401,path+' still requires shared code');
 }
 const access=await f.call('/api/admin/operations/materials/'+f.materials[0].id+'/workflow');assert.equal(access.status,200);assert.equal(typeof access.data.workflow.summary.totalCost,'number');
 assert.equal((await f.call('/api/admin/reservations','GET',undefined,'wrong')).status,401);
 const practice='/api/admin/workplace/practice';
 const created=await f.call(practice,'POST',{executionMemberId:f.member.id,kind:'Ski',activity:'filing'});
 assert.equal(created.status,201);
 const id=created.data.material.id,remove=practice+'/'+id+'/remove';
 const step=f.sql.prepare('SELECT id FROM maintenance_steps WHERE material_id=? ORDER BY step_order').get(id).id;
 const start='/api/admin/operations/steps/'+step+'/start';
 assert.equal((await f.call(remove,'POST',{},'wrong')).status,401);
 assert.equal((await f.call(practice+'/'+f.materials[0].id+'/remove','POST',{})).status,404);
 assert.equal((await f.call(start,'POST',{executionMemberId:f.member.id})).status,200);
 assert.equal((await f.call(remove,'POST',{})).status,409);
 assert.equal((await f.call('/api/admin/operations/steps/'+step+'/pause','POST',{executionMemberId:f.member.id})).status,200);
 assert.equal((await f.call(remove,'POST',{})).status,200);
 assert.equal((await f.call(practice)).data.sessions.some(item=>item.id===id),false);
 assert.equal((await f.call(start,'POST',{executionMemberId:f.member.id})).status,404);
 assert.ok(f.sql.prepare('SELECT duration_seconds FROM maintenance_step_sessions WHERE material_id=?').get(id).duration_seconds>0);
 const completed=await f.call(practice,'POST',{executionMemberId:f.member.id,kind:'Ski',activity:'filing'});
 f.sql.prepare("UPDATE materials SET internal_status='ready' WHERE id=?").run(completed.data.material.id);
 assert.equal((await f.call(practice+'/'+completed.data.material.id+'/remove','POST',{})).status,409);
 console.log('PASS shared Beheer: one valid code grants full customer, stock, finance, HRM and workplace access; anonymous and wrong-code access stay denied.');
}finally{f.close();}
