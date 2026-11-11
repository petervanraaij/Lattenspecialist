import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import worker from '../worker/src/index.js';
import {maintenanceFixture} from '../worker/maintenance-fixture.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),errors=[],requests=[];
let browser,fixture,page,origin,passed=0,failReservations=false;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/admin/security/'))throw Error('The shared-code app must not need the secondary unlock service');
  if(url.pathname==='/api/admin/reservations'&&failReservations){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Testverbinding tijdelijk onderbroken'}));return;}
  if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req){body+=chunk;if(body.length>1100000)throw Error('Too large');}const response=await worker.fetch(new Request(url,{method:req.method,headers:{...req.headers,origin},...(['GET','HEAD'].includes(req.method)?{}:{body})}),fixture.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(response.headers.get('Content-Type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.text());return;}
  if(url.pathname==='/booking-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.LATTENSPECIALIST_BOOKING={endpoint:'+JSON.stringify(origin)+'};');return;}
  const name=url.pathname==='/'?'medewerkers.html':decodeURIComponent(url.pathname.slice(1)),file=resolve(root,name);
  if(!file.startsWith(resolve(root)+'/')&&!file.startsWith(resolve(root)+'\\'))throw Error('Outside fixture');
  if(!/^(?:[a-z0-9-]+\.(?:html|css|js|webmanifest)|(?:images(?:\/tools)?|vendor|downloads)\/[a-z0-9._-]+\.(?:webp|png|jpg|js|pdf))$/i.test(name)){res.writeHead(404);res.end();return;}
  const body=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.pdf':'application/pdf'})[extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end('Synthetic fixture file unavailable');}
});
async function scenario(name,run){await run();passed++;console.log('PASS '+name);}
async function fits(){const dimensions=await page.evaluate(()=>[innerWidth,document.body.scrollWidth,document.documentElement.scrollWidth]);assert.ok(dimensions.slice(1).every(width=>width<=dimensions[0]+1),JSON.stringify(dimensions));}
async function openMaterial(material){if(!await page.locator('#manualScan input').isVisible())await page.locator('#workplaceScanTools > summary').click();await page.locator('#manualScan input').fill(material.displayCode);await page.locator('#manualScan button').click();await page.locator('.workflow-shell[data-material-id="'+material.id+'"] .workflow-step').first().waitFor();}

try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fixture=await maintenanceFixture(origin);fixture.env.LATTENSPECIALIST_ADMIN_SECURITY_ENABLED='false';const binary=new Map(),kv=fixture.env.LATTENSPECIALIST_RESERVATIONS_KV,put=kv.put.bind(kv),get=kv.get.bind(kv);kv.put=async(k,v)=>v instanceof Uint8Array?binary.set(k,v.slice()):put(k,v);kv.get=async(k,t)=>t==='arrayBuffer'?binary.get(k)?.buffer||null:get(k,t);kv.delete=async k=>binary.delete(k);
 function add(reference,step,closed=false){const record={reference,name:'Test '+reference,service:'Onderhoud',material:'Ski',amount:1,package:'Koper',currentStep:step,status:['Aanvraag ontvangen','Gepland','Materiaal ontvangen'][step-1]||'Gereed',createdAt:new Date().toISOString(),closedAt:closed?new Date().toISOString():null};fixture.sql.prepare('INSERT INTO records(reference,payload,updated_at) VALUES(?,?,?)').run(reference,JSON.stringify(record),record.createdAt);}
 add('LS-2611-NEW234',1);add('LS-2611-PLAN23',2);add('LS-2611-READY2',8);add('LS-2611-CLOSED',8,true);
 const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';browser=await chromium.launch({headless:true,...(existsSync(chrome)?{executablePath:chrome}:{channel:'chrome'})});page=await browser.newPage({viewport:{width:390,height:844},locale:'nl-NL'});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/beheer.html');await page.locator('#adminLoginForm [name=token]').fill(fixture.owner);await page.locator('#adminLoginForm [type=submit]').click();await page.locator('#adminTabs [data-tab=orders]').click();
 await scenario('One shared code opens customer data, stock and instructions without a second sign-in',async()=>{
  assert.equal(await page.locator('.admin-security-dialog').count(),0);assert.equal(await page.locator('.admin-security-panel').count(),0);
  assert.deepEqual(await page.locator('.site-header #adminTabs button').allTextContents(),['Aanvragen en statussen','Werkplaats','Beheer']);
  await page.locator('#adminTabs [data-tab=inventory]').click();await page.locator('#inventoryPanel').getByText('Voorraad, verbruik en kostprijs',{exact:true}).waitFor();
  await page.locator('[data-admin-subnav=inventory] [data-tab=customers]').click();await page.locator('[data-admin-panel=customers]').getByText('Klanten en materiaalgeschiedenis',{exact:true}).waitFor();
  await page.locator('#adminTabs [data-tab=workplace]').click();
  await page.locator('[data-admin-subnav=workplace] [data-tab=instructions]').click();await page.locator('[data-admin-panel=instructions] [data-edit-guide]').waitFor();
  await page.locator('#adminTabs [data-tab=orders]').click();
 });
 await scenario('Cancel deletion, move an application to the trash and restore its original status',async()=>{
  const card=page.locator('[data-reference="LS-2611-NEW234"]');
  const remove=card.getByRole('button',{name:'Aanvraag verwijderen'});
  await remove.click();
  const dialog=page.getByRole('dialog',{name:'Aanvraag verwijderen?'});
  await dialog.getByRole('button',{name:'Annuleren'}).click();
  assert.equal(await card.getAttribute('data-stage'),'new');
  await remove.click();
  await dialog.getByRole('button',{name:'Naar prullenbak'}).click();
  await page.getByText('Aanvraag verplaatst naar de prullenbak.',{exact:true}).waitFor();
  assert.equal(await card.isVisible(),false);
  assert.equal((await fixture.call('/api/admin/reservations')).data.records.some(r=>r.reference==='LS-2611-NEW234'),false);
  await page.locator('[data-order-filter=trash]').click();
  await card.getByRole('button',{name:'Terugzetten'}).click();
  await page.getByText('Aanvraag teruggezet.',{exact:true}).waitFor();
  assert.equal(await card.getAttribute('data-stage'),'new');
  await page.locator('[data-order-filter=new]').click();
 });
 await scenario('Enter a customer service code and replace it without leaving an old working link',async()=>{
  const reference='LS-2611-NEW234';
  const card=page.locator('[data-reference="'+reference+'"]');
  await card.locator('.admin-open-request').click();
  await card.locator('[name=serviceCode]').fill('pqr234');
  await card.locator('.save-record[data-action=save]').click();
  await card.locator('input.customer-status-link[value$="LS-PQR234"]').waitFor();
  const oldStatus=await fixture.call('/api/status/LS-PQR234');
  assert.equal(oldStatus.status,200);
  await card.locator('[name=serviceCode]').fill('LS-PQR235');
  await card.locator('.save-record[data-action=save]').click();
  await card.locator('input.customer-status-link[value$="LS-PQR235"]').waitFor();
  assert.equal((await fixture.call('/api/status/LS-PQR234')).status,404);
  assert.equal((await fixture.call('/api/status/LS-PQR235')).status,200);
  const other=(await fixture.call('/api/admin/reservations')).data.records.find(r=>r.reference==='LS-2611-PLAN23');
  assert.equal((await fixture.call('/api/admin/reservations/'+other.reference,'PATCH',{serviceCode:'LS-PQR235',revision:other.revision})).status,400);
  await card.locator('.admin-open-request').click();
 });
 await scenario('Filters show only open orders; completed orders remain available',async()=>{assert.equal(await page.locator('.admin-record:visible').count(),2);await page.getByRole('button',{name:'Nieuwe aanvragen · 2',exact:true}).click();assert.equal(await page.locator('.admin-record:visible').count(),2);await page.getByRole('button',{name:'Afgerond · 1',exact:true}).click();assert.equal(await page.locator('.admin-record:visible').count(),1);assert.equal(await page.locator('.admin-record:visible').getAttribute('data-reference'),'LS-2611-CLOSED');});
 await scenario('Dirty values and expanded order survive refresh and incoming requests',async()=>{await page.getByRole('button',{name:'Nieuwe aanvragen · 2',exact:true}).click();const card=page.locator('[data-reference="LS-2611-NEW234"]');await card.locator('.admin-record-details>summary').click();await card.locator('[name=note]').fill('Niet verliezen na verlaten veld');await page.locator('#adminSearch').focus();add('LS-2611-NEW567',1);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('button',{name:'Nieuwe aanvragen · 3',exact:true}).waitFor();assert.equal(await card.locator('[name=note]').inputValue(),'Niet verliezen na verlaten veld');assert.equal(await card.locator('.admin-record-details').getAttribute('open'),'');await page.locator('#refreshAdmin').click();await page.getByRole('button',{name:'Nieuwe aanvragen · 3',exact:true}).waitFor();assert.equal(await card.locator('[name=note]').inputValue(),'Niet verliezen na verlaten veld');});
 await scenario('Failed refresh preserves input and another request can open',async()=>{failReservations=true;await page.locator('#refreshAdmin').click();await page.getByText(/Bijwerken mislukt: Testverbinding/).waitFor();assert.equal(await page.locator('[data-reference="LS-2611-NEW234"] [name=note]').inputValue(),'Niet verliezen na verlaten veld');failReservations=false;await page.locator('[data-reference="LS-2611-NEW567"] .admin-open-request').click();assert.equal(await page.locator('[data-reference="LS-2611-NEW567"] .admin-record-details').getAttribute('open'),'');assert.equal(await page.locator('[data-reference="LS-2611-NEW234"] [name=note]').inputValue(),'Niet verliezen na verlaten veld');});

 await scenario('Click request, complete customer details, create one linked work order and preserve another draft',async()=>{const card=page.locator('[data-reference="LS-2611-NEW567"]');await card.locator('.admin-open-request').click();assert.equal(await card.locator('.admin-record-details').getAttribute('open'),null);await card.locator('.admin-open-request').click();await card.locator('[name=name]').fill('Fictieve werkorderklant');await card.locator('[name=notes]').fill('Aanvullende afspraak: uitsluitend testmateriaal.');await card.getByRole('button',{name:'Omzetten naar werkorder',exact:true}).click();await card.getByText('Werkorder aangemaakt. De aanvraag, materialen en historie blijven gekoppeld.').waitFor();const row=fixture.sql.prepare('SELECT payload,revision FROM records WHERE reference=?').get('LS-2611-NEW567'),saved=JSON.parse(row.payload);assert.equal(saved.workOrderNumber,'WO-2611-NEW567');assert.equal(saved.name,'Fictieve werkorderklant');assert.equal(saved.notes,'Aanvullende afspraak: uitsluitend testmateriaal.');assert.equal(saved.currentStep,2);assert.equal(saved.customerStatus,'Onderhoud in voorbereiding');assert.match(saved.serviceCode,/^LS-[A-Z2-9]{6}$/);assert.equal(await card.getByRole('button',{name:'Omzetten naar werkorder',exact:true}).count(),0);assert.equal(await page.locator('[data-reference="LS-2611-NEW234"] [name=note]').inputValue(),'Niet verliezen na verlaten veld');const retry=await fixture.call('/api/admin/reservations/LS-2611-NEW567','PATCH',{convertToWorkOrder:true,revision:row.revision});assert.equal(retry.status,200);assert.equal(retry.data.record.workOrderNumber,saved.workOrderNumber);assert.equal(retry.data.record.workOrderCreatedAt,saved.workOrderCreatedAt);assert.equal((await fixture.call('/api/admin/reservations/LS-2611-NEW567','PATCH',{convertToWorkOrder:true,revision:row.revision})).status,409);assert.equal((await fixture.call('/api/admin/reservations/LS-2611-CLOSED','PATCH',{convertToWorkOrder:true,revision:0})).status,400);assert.equal((await fixture.call('/api/admin/reservations/LS-2611-NEW567','PATCH',{convertToWorkOrder:true,revision:0},'wrong-owner')).status,401);});


 await scenario('Owner executes shared work steps and stores both photo stages on the correct material',async()=>{
  const card=page.locator('[data-reference="LS-2611-NEW567"]');await card.getByRole('button',{name:'Werkzaamheden en foto’s openen',exact:true}).click();const workspace=card.locator('.workorder-workspace');await workspace.getByRole('heading',{name:'Wie voert dit uit?',exact:true}).waitFor();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await workspace.locator('.workorder-executor-dialog').isVisible(),true);await workspace.locator('[data-workorder-member]').selectOption(fixture.member.id);await workspace.getByRole('button',{name:'Open werkzaamheden',exact:true}).click();await workspace.locator('.workflow-step').first().waitFor();const first=workspace.locator('.workflow-step').first();const materialId=await workspace.locator('.workflow-shell').getAttribute('data-material-id');assert.ok(materialId);const stepId=await first.getAttribute('data-step-id');assert.equal((await fixture.call('/api/admin/operations/steps/'+stepId+'/start','POST',{executionMemberId:fixture.member.id},'not-owner')).status,401);assert.equal((await fixture.call('/api/admin/operations/steps/'+stepId+'/start','POST',{})).status,400);
  if(await first.locator('[name=startWeight]').count())await first.locator('[name=startWeight]').fill('500');await page.locator('#refreshAdmin').click();await first.waitFor();if(await first.locator('[name=startWeight]').count())assert.equal(await first.locator('[name=startWeight]').inputValue(),'500');await first.locator('[data-workflow-start]').click();await first.locator('[data-workflow-action=finish]').waitFor();assert.equal(fixture.sql.prepare('SELECT member_id FROM maintenance_step_sessions WHERE step_id=? AND ended_at IS NULL').get(stepId).member_id,fixture.member.id);
  if(await first.locator('[name=endWeight]').count())await first.locator('[name=endWeight]').fill('495');for(const check of await first.locator('[name=guideChecks]').all())await check.check();await first.locator('[data-workflow-complete]').click();await first.locator('.guide-confirmed').waitFor();assert.equal(await first.locator('[data-workflow-complete]').isChecked(),true);assert.equal(fixture.sql.prepare("SELECT COUNT(*) n FROM material_events WHERE material_id=? AND actor='owner' AND event_type='owner_step_finish'").get(materialId).n,1);
  const disclosure=workspace.locator('.material-photo-disclosure');await disclosure.locator('summary').click();for(const stage of ['intake','delivery']){await workspace.locator('[data-photo-upload] [name=stage]').selectOption(stage);await workspace.locator('[data-photo-files]').setInputFiles(resolve(root,'images/badge.webp'));await workspace.locator('[data-photo-upload] [type=submit]').click();await workspace.locator('[data-photo-list="'+stage+'"] [data-photo-open]').click();await workspace.locator('[data-photo-list="'+stage+'"] img').waitFor();}assert.equal(fixture.sql.prepare('SELECT COUNT(*) n FROM material_photos WHERE material_id=?').get(materialId).n,2);assert.equal(fixture.sql.prepare('SELECT COUNT(DISTINCT stage) n FROM material_photos WHERE material_id=?').get(materialId).n,2);
 });
 await scenario('Explicit discard restores server data without silently keeping a stale revision',async()=>{await page.getByRole('button',{name:'Nieuwe aanvragen · 2',exact:true}).click();const card=page.locator('[data-reference="LS-2611-NEW234"]');await card.getByRole('button',{name:'Wijzigingen verwerpen en herladen',exact:true}).click();await page.getByText('Aanvraag herladen; lokale wijzigingen zijn verworpen.').waitFor();assert.equal(await card.locator('[name=note]').inputValue(),'');assert.equal(await card.getByRole('button',{name:'Wijzigingen verwerpen en herladen',exact:true}).isVisible(),false);});
 await scenario('Mobile and desktop layout fit; filters stay inside orders tab',async()=>{await fits();await page.getByRole('button',{name:'Nieuwe aanvragen · 2',exact:true}).click();await mkdir(resolve(root,'output/admin-queue-review'),{recursive:true});await page.locator('.admin-order-filters').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'output/admin-queue-review/mobile.png')});await page.setViewportSize({width:1440,height:1000});await fits();await page.screenshot({path:resolve(root,'output/admin-queue-review/desktop.png')});await page.locator('#adminTabs [data-tab=workplace]').click();await page.locator('[data-admin-subnav=workplace] [data-tab=overview]').click();assert.equal(await page.locator('.admin-order-filters').isVisible(),false);});
 await scenario('Emptying trash requires confirmation and cannot remove open requests',async()=>{
  await page.locator('#adminTabs [data-tab=orders]').click();
  await page.locator('[data-order-filter=new]').click();
  const ref='LS-2611-NEW234';
  const card=page.locator('[data-reference="'+ref+'"]');
  await card.getByRole('button',{name:'Aanvraag verwijderen'}).click();
  await page.getByRole('button',{name:'Naar prullenbak'}).click();
  await page.getByText('Aanvraag verplaatst naar de prullenbak.',{exact:true}).waitFor();
  await page.locator('[data-order-filter=trash]').click();
  const empty=page.getByRole('button',{name:'Prullenbak legen',exact:true});
  const dialog=page.getByRole('dialog',{name:'Prullenbak definitief legen?'});
  await empty.click();
  await dialog.getByRole('button',{name:'Annuleren'}).click();
  assert.equal(await card.isVisible(),true);
  const visible=(await fixture.call('/api/admin/reservations?includeTrash=1')).data.records;
  const active=visible.find(r=>!r.deletedAt);
  const entry={reference:active.reference,revision:active.revision};
  assert.equal((await fixture.call('/api/admin/reservations/trash','POST',{entries:[entry]},'wrong-owner')).status,401);
  assert.deepEqual((await fixture.call('/api/admin/reservations/trash','POST',{entries:[entry]})).data.references,[]);
  await empty.click();
  await dialog.getByRole('button',{name:'Definitief legen'}).click();
  await page.getByText('Prullenbak geleegd.',{exact:true}).waitFor();
  assert.equal(await card.count(),0);
  assert.equal((await fixture.call('/api/admin/reservations/'+ref,'PATCH',{trashAction:'restore',revision:0})).status,404);
  assert.equal((await fixture.call('/api/status/LS-PQR235')).status,404);
 });
 await scenario('Handmatige aanvraag bewaart gemengde pakketten en extra werk zonder haal- en brengservice',async()=>{await page.locator('#newAdminRequest').click();const form=page.locator('#manualRequestForm');await form.waitFor();await form.getByLabel('Naam',{exact:true}).fill('Fictieve gemengde aanvraag');await form.getByLabel('Telefoonnummer',{exact:true}).fill('0612345678');const prefix=await form.locator('#manualServicePrefix').textContent();assert.match(prefix,/^LS-\d{4}-$/);await form.locator('[name=serviceCodeSuffix]').fill('ab0123');assert.equal(await form.locator('[name=serviceCodeSuffix]').inputValue(),'AB0123');const gold=form.locator('[data-manual-package=goud]');if(!await gold.locator('[data-count=s]').isVisible())await gold.locator('summary').click();await gold.locator('[data-count=s]').fill('1');await gold.locator('[data-count=b]').fill('1');await gold.locator('[data-count=d]').fill('1');await gold.locator('[data-count=u]').check();const extra=form.locator('[data-manual-extra=repair]');await extra.locator('input').fill('1');assert.equal(await form.locator('[name=logistics] option').count(),1);assert.equal(await form.locator('[name=logistics]').inputValue(), 'Zelf brengen en zelf ophalen');await page.setViewportSize({width:390,height:844});await fits();await form.getByRole('button',{name:'Aanvraag opslaan',exact:true}).click();await form.waitFor({state:'hidden'});const row=fixture.sql.prepare("SELECT payload FROM records WHERE json_extract(payload,'$.name')=?").get('Fictieve gemengde aanvraag'),record=JSON.parse(row.payload),choice=JSON.parse(record.maintenanceSelection);assert.equal(record.serviceCode,prefix+'AB0123');assert.equal((await fixture.call('/api/status/'+record.serviceCode)).status,200);assert.equal(choice.p.goud.s,1);assert.equal(choice.p.goud.b,1);assert.equal(choice.p.goud.d,1);assert.equal(choice.p.goud.u,true);assert.equal(choice.e.repair.q,1);assert.equal(record.logistics,'Zelf brengen en zelf ophalen');assert.match(record.urgent,/Ja/);await page.locator('#newAdminRequest').click();await form.getByLabel('Naam',{exact:true}).fill('Fictieve dubbele code');await form.getByLabel('Telefoonnummer',{exact:true}).fill('0612345678');await form.locator('[name=serviceCodeSuffix]').fill('AB0123');if(!await gold.locator('[data-count=s]').isVisible())await gold.locator('summary').click();await gold.locator('[data-count=s]').fill('1');await form.getByRole('button',{name:'Aanvraag opslaan',exact:true}).click();await form.getByText('Deze servicecode is al in gebruik.',{exact:true}).waitFor();assert.equal(fixture.sql.prepare("SELECT count(*) AS n FROM records WHERE json_extract(payload,'$.name')=?").get('Fictieve dubbele code').n,0);await form.locator('.manual-request-cancel').click();});
 await scenario('Single-ski warm cleaning opens a training work order and can be removed with confirmation',async()=>{
  await page.locator('#adminTabs [data-tab=workplace]').click();
  const form=page.locator('#practiceForm');
  await form.locator('[name=executionMemberId]').selectOption(fixture.member.id);
  await form.locator('[name=kind]').selectOption('single-ski');
  await page.getByRole('button',{name:'Warm reinigen oefenen',exact:true}).click();
  await form.locator('button[type=submit]').click();
  await page.getByRole('heading',{name:/Oefenopdracht OEF-/}).waitFor();
  assert.equal(await page.locator('#practiceResult .workflow-step').count(),1);
  const bench=page.locator('#practiceResult .workflow-shell');
  assert.match(await bench.textContent(),/Ski \(één\)/);
  const id=await bench.getAttribute('data-material-id');
  const record=fixture.sql.prepare('SELECT kind,is_training FROM materials WHERE id=?').get(id);
  assert.equal(record.kind,'Ski (één)');
  assert.equal(record.is_training,1);
  assert.match(fixture.sql.prepare('SELECT required_items FROM maintenance_steps WHERE material_id=?').get(id).required_items,/24101/);
  await page.locator('[data-practice-history] > summary').click();
  const remove=page.locator('[data-remove-practice="'+id+'"]');
  await remove.click();
  const dialog=page.getByRole('dialog',{name:'Oefening verwijderen?'});
  await dialog.getByRole('button',{name:'Annuleren'}).click();
  assert.equal(await remove.isVisible(),true);
  await remove.click();
  await dialog.getByRole('button',{name:'Verwijderen',exact:true}).click();
  await page.getByText('Oefening verwijderd.',{exact:true}).waitFor();
  assert.equal(await remove.count(),0);
  assert.equal(await bench.count(),0);
 });
 await scenario('Complete practice order requires both photos and stays a training order',async()=>{
  const form=page.locator('#practiceForm');
  await form.locator('[name=executionMemberId]').selectOption(fixture.member.id);
  await page.getByRole('button',{name:'Hele onderhoudsopdracht oefenen'}).click();
  await form.locator('[name=practicePackage]').selectOption('zilver');
  await form.locator('[name=practiceCleaning]').check();
  await form.locator('button[type=submit]').click();
  const bench=page.locator('#practiceResult .workflow-shell');
  await bench.getByRole('heading',{name:/Oefenopdracht OEF-/}).waitFor();
  const id=await bench.getAttribute('data-material-id');
  const workflowPath='/api/admin/operations/materials/'+id+'/workflow';
  const photoPath='/api/admin/operations/materials/'+id+'/photos';
  const work=(await fixture.call(workflowPath)).data;
  assert.equal(work.material.isTraining,true);
  assert.equal(work.material.fullPractice,true);
  assert.deepEqual(work.workflow.steps.map(step=>step.code),['inspection','setup','filing','deep_clean','wax','scrape','brush','finish','practice_delivery']);
  const disclosure=bench.locator('.material-photo-disclosure');
  await disclosure.locator('summary').click();
  for(const step of work.workflow.steps){
   const base='/api/admin/operations/steps/'+step.id;
   const values={executionMemberId:fixture.member.id,guideVersion:step.guide.version};
   if(step.needsStartWeight)values.startWeight=100;
   const started=await fixture.call(base+'/start','POST',values);
   assert.equal(started.status,200,JSON.stringify(started.data));
   const finish={...values,endWeight:99,guideChecks:{version:step.guide.version,checkedIds:step.guide.checks.map(check=>check.id)},toolSkus:[]};
   const stage={inspection:'intake',practice_delivery:'delivery'}[step.code];
   if(stage){
    assert.equal((await fixture.call(base+'/finish','POST',finish)).status,409);
    await disclosure.locator('[data-photo-upload] [name=stage]').selectOption(stage);
    await disclosure.locator('[data-photo-files]').setInputFiles(resolve(root,'images/badge.webp'));
    await disclosure.locator('[data-photo-upload] [type=submit]').click();
    await disclosure.locator('[data-photo-list="'+stage+'"] [data-photo-open]').click();
    await disclosure.locator('[data-photo-list="'+stage+'"] img').waitFor();
   }
   const finished=await fixture.call(base+'/finish','POST',finish);
   assert.equal(finished.status,200,JSON.stringify(finished.data));
  }
  assert.equal((await fixture.call(workflowPath)).data.material.internalStatus,'ready');
  assert.deepEqual((await fixture.call(photoPath)).data.photos.map(photo=>photo.stage),['intake','delivery']);
  assert.equal(fixture.sql.prepare('SELECT COUNT(*) AS n FROM records WHERE reference=?').get(work.material.reference).n,0);
 });
 await scenario('A full Brons practice uses the selected snowboard extras and omits wax',async()=>{
  const form=page.locator('#practiceForm');
  await form.locator('[name=kind]').selectOption('Snowboard');
  await form.locator('[name=practicePackage]').selectOption('slijpen');
  assert.equal(await form.locator('[name=practiceEndWax]').isVisible(),false);
  assert.equal(await form.locator('[name=practiceCleaning]').isVisible(),false);
  await form.locator('[name=practicePremium]').check();
  await form.locator('[name=practiceBindings]').check();
  await form.locator('[name=practiceRepairs]').fill('1');
  await form.locator('button[type=submit]').click();
  const bench=page.locator('#practiceResult .workflow-shell');
  await bench.getByRole('heading',{name:'Oefenklant · Brons',exact:true}).waitFor();
  const id=await bench.getAttribute('data-material-id');
  const {data}=await fixture.call('/api/admin/operations/materials/'+id+'/workflow');
  assert.deepEqual(data.workflow.steps.map(step=>step.code),['inspection','setup','bindings_off','repair','filing','premium_file','premium_diamond','bindings_on','finish','practice_delivery']);
 });
 await scenario('Two selected employees can run separate exercises at the same time',async()=>{
  const added=await fixture.call('/api/admin/team/members','POST',{name:'Tweede oefenmedewerker',login:'oefen.twee'});
  assert.equal(added.status,201);
  await page.reload();
  await page.locator('#adminTabs [data-tab=workplace]').click();
  const form=page.locator('#practiceForm');
  await form.locator('[name=activity]').selectOption('filing');
  for(const member of [fixture.member,added.data]){
   await form.locator('[name=executionMemberId]').selectOption(member.id);
   await form.locator('button[type=submit]').click();
   const panel=page.locator('[data-practice-member="'+member.id+'"]');
   await panel.getByRole('heading',{name:'Uitvoerder: '+member.name}).waitFor();
   const id=await panel.locator('.workflow-shell').getAttribute('data-material-id');
   const {data}=await fixture.call('/api/admin/operations/materials/'+id+'/workflow');
   const step=data.workflow.steps[0];
   const started=await fixture.call('/api/admin/operations/steps/'+step.id+'/start','POST',{executionMemberId:member.id,guideVersion:step.guide.version});
   assert.equal(started.status,200);
  }
  assert.equal(await page.locator('#practiceResult [data-practice-member]').count(),2);
  assert.equal(fixture.sql.prepare('SELECT COUNT(DISTINCT member_id) AS n FROM maintenance_step_sessions WHERE ended_at IS NULL AND is_training=1').get().n,2);
  await page.locator('[data-practice-history] > summary').click();
  await page.getByRole('button',{name:'Oefeningen vernieuwen'}).click();
  const overview=page.locator('[data-active-practice]');
  await overview.getByRole('button',{name:/Tweede oefenmedewerker.*Stap 1 van 1/}).waitFor();
  assert.equal(await overview.locator('time').count(),2);
  const timer=overview.locator('time').first();
  const initial=await timer.textContent();
  await page.waitForFunction(before=>document.querySelector('[data-active-practice] time')?.textContent!==before,initial);
  const active=fixture.sql.prepare('SELECT step_id FROM maintenance_step_sessions WHERE member_id=? AND ended_at IS NULL').get(added.data.id);
  assert.equal((await fixture.call('/api/admin/operations/steps/'+active.step_id+'/pause','POST',{executionMemberId:added.data.id})).status,200);
  await overview.getByRole('button',{name:/Tweede oefenmedewerker/}).waitFor({state:'detached'});
  assert.equal(await overview.locator('time').count(),1);
 });
 assert.deepEqual(errors,[]);console.log(`${passed} queue scenarios passed.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fixture?.close();}
