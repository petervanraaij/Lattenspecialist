import assert from 'node:assert/strict';
import {maintenanceFixture} from './maintenance-fixture.mjs';
const f=await maintenanceFixture(),original=globalThis.fetch;Object.assign(f.env,{LATTENSPECIALIST_ADMIN_SECURITY_ENABLED:'true'});
const base='/api/admin/operations/workplace/',id=f.member.id,date='2099-12-01';
try{
 const workorders=()=>f.call(base+'workorders?memberId='+id);
 assert.deepEqual((await workorders()).data.workorders,[]);
 assert.equal((await f.call(base+'workorders','GET',undefined,f.staff)).status,401);
 const material=f.materials[0];
 f.env.LATTENSPECIALIST_ADMIN_SECURITY_ENABLED='false';
 const scanned=await f.call('/api/admin/operations/materials/intake','POST',{
  reference:'LS-2610-GUIDEX',materialId:material.id,label:'LS-2601-0001'
 });
 f.env.LATTENSPECIALIST_ADMIN_SECURITY_ENABLED='true';
 assert.equal(scanned.status,200,JSON.stringify(scanned.data));
 const open=await workorders();
 assert.deepEqual(open.data.workorders.map(order=>order.code),['LS-2601-0001']);
 assert.equal(open.data.workorders[0].material,material.kind);
 assert.equal('scanToken' in open.data.workorders[0],false);
 f.sql.prepare("UPDATE materials SET internal_status='ready' WHERE id=?").run(material.id);
 assert.deepEqual((await workorders()).data.workorders,[]);
 assert.equal((await f.call(base+'availability','PATCH',{executionMemberId:id,dates:[{date,preference:'preferred',startTime:'10:00',endTime:'16:30'}]})).status,200);
 const staff=await f.call('/api/team/operations/availability','GET',undefined,f.staff);assert.equal(staff.data.dates[0].start_time,'10:00');
 f.sql.prepare('UPDATE member_availability SET note=? WHERE member_id=?').run('PRIVATE HRM NOTE',id);
 const all=await f.call(base+'availability');assert.equal(all.status,200);assert.equal(all.data.availability[0].name,'Fictieve onderhoudsmedewerker');assert.equal(JSON.stringify(all.data).includes('PRIVATE'),false);
 const own=await f.call(base+'availability?memberId='+id);assert.equal(own.data.dates[0].preference,'preferred');assert.equal('note' in own.data.dates[0],false);
 const save=dates=>f.call(base+'availability','PATCH',{executionMemberId:id,dates});
 assert.equal((await save([{date,preference:'available',startTime:'12:00',endTime:'18:00'}])).status,200);assert.equal(f.sql.prepare('SELECT note FROM member_availability WHERE member_id=?').get(id).note,'PRIVATE HRM NOTE');
 for(const dates of [[{date,preference:'available',startTime:'18:00',endTime:'12:00'}],[{date:'2099-02-31',preference:'available'}],[{date,preference:'available'},{date,preference:'preferred'}]])assert.equal((await save(dates)).status,400);
 assert.equal(f.sql.prepare('SELECT start_time FROM member_availability WHERE member_id=?').get(id).start_time,'12:00');
 assert.equal((await f.call(base+'availability?memberId=invalid')).status,400);assert.equal((await f.call(base+'availability','GET',undefined,'')).status,401);
 assert.equal((await f.call('/api/admin/hrm/members')).status,403);assert.equal((await f.call('/api/admin/operations/availability')).status,403);
 Object.assign(f.env,{HRM_CENTRAL_ENABLED:'true',HRM_CONNECTOR_SECRET:'x'.repeat(64)});let operations=[];
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://app.pierfinity.nl/api/hrm/connector');const raw=JSON.parse(options.body);operations.push(raw);if(raw.operation==='planning')return Response.json({items:[{id:'fixture-task',title:'Onderhoud plannen',startDate:date,endDate:date,status:'planned',version:4,canChangeStatus:true,profile:{iban:'PRIVATE'},cost:900}]});if(raw.operation==='planningStatus'){assert.equal(raw.version,4);return Response.json({ok:true,profile:{phone:'PRIVATE'}});}return new Response(null,{status:503});};
 const plan=await f.call(base+'planning?memberId='+id);assert.equal(plan.status,200);assert.equal(plan.data.items[0].title,'Onderhoud plannen');assert.equal('profile' in plan.data.items[0],false);assert.equal('cost' in plan.data.items[0],false);
 const changed=await f.call(base+'planning','PATCH',{executionMemberId:id,id:'fixture-task',status:'done',version:4});assert.deepEqual(changed.data,{ok:true});assert.equal(operations[1].memberId,id);
 const synced=await save([{date,preference:'unavailable'}]);assert.equal(synced.status,200);assert.equal(synced.data.centralSynced,false);assert.equal(f.sql.prepare('SELECT preference FROM member_availability WHERE member_id=?').get(id).preference,'unavailable');
 globalThis.fetch=async()=>new Response(null,{status:503});assert.equal((await f.call(base+'planning?memberId='+id)).status,503);
 assert.equal((await save([])).status,200);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM member_availability WHERE member_id=?').get(id).n,0);
 console.log('PASS unified planning: shared-code auth, active employee validation, hidden HRM, saved availability visible to staff, private notes preserved, atomic validation, central task projection/status/version and resilient availability sync.');
}finally{globalThis.fetch=original;f.close();}
