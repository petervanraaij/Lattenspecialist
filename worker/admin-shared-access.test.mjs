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
 console.log('PASS shared Beheer: one valid code grants full customer, stock, finance, HRM and workplace access; anonymous and wrong-code access stay denied.');
}finally{f.close();}
