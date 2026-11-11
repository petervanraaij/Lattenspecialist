import {ensureTeamRecord} from './src/team.js';
import assert from 'node:assert/strict';import {maintenanceFixture} from './maintenance-fixture.mjs';import {readFileSync} from 'node:fs';
const f=await maintenanceFixture();try{
 const base='/api/admin/operations/customers';assert.equal((await f.call(base,'GET',undefined,'')).status,401);assert.equal((await f.call(base,'GET',undefined,f.staff)).status,401);
 const c=await f.call(base,'POST',{name:'Test klant',email:'a@example.test',phone:'0612345678'});assert.equal(c.status,201,JSON.stringify(c));const same=await f.call(base,'POST',{name:'Test klant',email:'a@example.test'});assert.notEqual(c.data.id,same.data.id);
 const save=(suffix,phone,extra={})=>ensureTeamRecord({reference:'LS-2611-'+suffix,service:'Onderhoud',name:'Synthetic request',phone,...extra},f.env);
 await save('PHONEA','+31 (0)6-1234 5678');
 assert.deepEqual((await f.call(base+'/'+c.data.id)).data.requests.map(r=>r.reference),['LS-2611-PHONEA']);
 await Promise.all([save('PHONEB','06-8765 4321'),save('PHONEC','0031 6 8765 4321')]);
 const found=(await f.call(base+'?q='+encodeURIComponent('+31687654321'))).data.customers;
 assert.equal(found.length,1);
 const requests=()=>f.call(base+'/'+found[0].id);
 assert.deepEqual((await requests()).data.requests.map(r=>r.reference).sort(),['LS-2611-PHONEB','LS-2611-PHONEC']);
 await save('PHONEB','06-8765 4321');
 await save('PHONED','0201234567');
 await save('PHONEE','0687654321',{service:'Dakkoffer'});
 assert.equal((await requests()).data.requests.length,2);
 assert.equal((await f.call(base+'?q=0201234567')).data.customers.length,0);
 await f.call(base,'POST',{name:'Existing duplicate',phone:'06 1234 5678'});
 await save('PHONEF','0612345678');
 assert.equal((await f.call(base+'/'+c.data.id)).data.requests.length,1);
 const a=await f.call(base+'/'+c.data.id+'/assets','POST',{kind:'Ski',brand:'Testmerk',model:'Blauw',serial:'TEST-01'});assert.equal(a.status,201,JSON.stringify(a));const m=f.materials[0],path='/api/admin/operations/materials/'+m.id+'/dossier';assert.equal((await f.call(path,'PUT',{assetId:a.data.id})).status,200);
 const wrong=await f.call('/api/admin/operations/materials/'+f.materials[1].id+'/dossier','PUT',{assetId:a.data.id});assert.equal(wrong.status,400);
 const p=await f.call('/api/admin/operations/materials/'+m.id+'/photos','POST',{stage:'delivery',note:'Later toegevoegd',requestId:crypto.randomUUID(),image:readFileSync(new URL('./fixtures/material-photo.jpg',import.meta.url)).toString('base64')});assert.equal(p.status,201,JSON.stringify(p));const d=await f.call(base+'/'+c.data.id);assert.equal(d.data.assets[0].history.length,1);assert.equal(d.data.assets[0].history[0].photos[0].note,'Later toegevoegd');assert.equal((await f.call(base+'/'+same.data.id)).data.assets.length,0);
 const work=await f.call('/api/team/operations/materials/'+m.id+'/workflow','GET',undefined,f.staff),step=work.data.workflow.steps[0];assert.equal((await f.call('/api/team/operations/steps/'+step.id+'/start','POST',{guideVersion:step.guide.version},f.staff)).status,200);const practice=await f.call('/api/team/practice','POST',{kind:'ski',activity:'repair'},f.staff);const blocked=await f.call('/api/team/operations/steps/'+practice.data.workflow.steps[0].id+'/start','POST',{},f.staff);assert.equal(blocked.status,409);assert.equal(blocked.data.activeWork.displayCode,m.displayCode);assert.ok(blocked.data.activeWork.stepTitle);
 console.log('PASS admin-only customer/asset dossiers, explicit identities, type-safe links, history and later owner photos; active work conflict identifies own material');
}finally{f.close();}
