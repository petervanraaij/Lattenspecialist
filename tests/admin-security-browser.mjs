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
  const url=new URL(req.url,origin);
  if(url.pathname==='/api/admin/reservations'&&failReservations){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Testverbinding tijdelijk onderbroken'}));return;}
  if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req){body+=chunk;if(body.length>1100000)throw Error('Too large');}const response=await worker.fetch(new Request(url,{method:req.method,headers:{...req.headers,origin},...(['GET','HEAD'].includes(req.method)?{}:{body})}),fixture.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(response.headers.get('Content-Type')?.startsWith('image/')?Buffer.from(await response.arrayBuffer()):await response.text());return;}
  if(url.pathname==='/booking-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.LATTENSPECIALIST_BOOKING={endpoint:'+JSON.stringify(origin)+',extraAdminPassword:true};');return;}
  const name=url.pathname==='/'?'medewerkers.html':decodeURIComponent(url.pathname.slice(1)),file=resolve(root,name);
  if(!file.startsWith(resolve(root)+'/')&&!file.startsWith(resolve(root)+'\\'))throw Error('Outside fixture');
  if(!/^(?:[a-z0-9-]+\.(?:html|css|js|webmanifest)|(?:images(?:\/tools)?|vendor|downloads)\/[a-z0-9._-]+\.(?:webp|png|jpg|js|pdf))$/i.test(name)){res.writeHead(404);res.end();return;}
  let body=await readFile(file);if(extname(file)==='.html')body=Buffer.from(body.toString().replace('connect-src ','connect-src '+origin+' '));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.pdf':'application/pdf'})[extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end('Synthetic fixture file unavailable');}
});
async function scenario(name,run){await run();passed++;console.log('PASS '+name);}
async function fits(){const dimensions=await page.evaluate(()=>[innerWidth,document.body.scrollWidth,document.documentElement.scrollWidth]);assert.ok(dimensions.slice(1).every(width=>width<=dimensions[0]+1),JSON.stringify(dimensions));}
async function openMaterial(material){if(!await page.locator('#manualScan input').isVisible())await page.locator('#workplaceScanTools > summary').click();await page.locator('#manualScan input').fill(material.displayCode);await page.locator('#manualScan button').click();await page.locator('.workflow-shell[data-material-id="'+material.id+'"] .workflow-step').first().waitFor();}


const originalFetch=globalThis.fetch;let mailToken='',mailCount=0;
let planningStatus='planned';
globalThis.fetch=async(url,options)=>{if(String(url)==='https://app.pierfinity.nl/api/hrm/connector'){const raw=JSON.parse(options.body);if(raw.operation==='planningStatus'){planningStatus=raw.status;return Response.json({ok:true});}return Response.json({items:[{id:'test-plan',title:'Fictieve werkplaatstaken',startDate:new Date().toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10),status:planningStatus,version:1,canChangeStatus:true}]});}assert.equal(String(url),'https://api.resend.com/emails');mailCount++;const mail=JSON.parse(options.body);assert.deepEqual(mail.to,['owner@example.test']);mailToken=mail.text.match(/#token=([a-f0-9]{64})/)[1];return Response.json({id:'synthetic-security-mail'});};
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fixture=await maintenanceFixture(origin);Object.assign(fixture.env,{LATTENSPECIALIST_ADMIN_SECURITY_ENABLED:'true',LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL:'owner@example.test',RESEND_API_KEY:'synthetic-mail-only',LATTENSPECIALIST_FROM_EMAIL:'test@example.test'});
 const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';browser=await chromium.launch({headless:true,...(existsSync(chrome)?{executablePath:chrome}:{channel:'chrome'})});page=await browser.newPage({viewport:{width:390,height:844},locale:'nl-NL'});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.goto(origin+'/beheer.html');await page.locator('#adminLoginForm [name=token]').fill(fixture.owner);await page.locator('#adminLoginForm [type=submit]').click();
 await scenario('Shared code opens only workshop; full contact data never enters its DOM',async()=>{await page.locator('.admin-record').waitFor();assert.equal(await page.locator('.admin-security-dialog').isVisible(),false);assert.equal(await page.locator('#adminTabs [data-tab=orders]').getAttribute('class'),'active');assert.equal(await page.locator('body').textContent().then(text=>text.includes('Fictieve ski-eigenaar')),false);assert.equal(await page.locator('input[value="fixture@example.test"]').count(),0);await fits();await page.locator('#adminTabs [data-tab=inventory]').click();await page.getByRole('heading',{name:'Beheer ontgrendelen',exact:true}).waitFor();assert.equal(await page.locator('[data-unlock-form]').isVisible(),false);});
 await scenario('Shared-code workplace includes real practice, photo tool manual and warehouse picks',async()=>{
  await page.locator('.admin-security-dialog button').filter({hasText:'Sluiten'}).click();
  await page.locator('#adminTabs [data-tab=workplace]').click();
  await page.locator('#practiceForm [name=executionMemberId]').selectOption(fixture.member.id);
  await page.locator('#practiceForm [name=activity]').selectOption('repair');
  await page.locator('#practiceForm [type=submit]').click();
  await page.locator('#practiceResult .workflow-step').first().waitFor();
  assert.equal(fixture.sql.prepare('SELECT COUNT(*) n FROM materials WHERE is_training=1').get().n,1);
  await page.locator('#practiceResult [data-workflow-action=start] button[type=submit]').click();
  await page.locator('#practiceResult [data-workflow-action=finish]').waitFor();
  await page.locator('#practiceResult [name=repairStrips]').fill('1');
  for(const checkbox of await page.locator('#practiceResult [data-workflow-action=finish] input[type=checkbox]').all())await checkbox.check();
  await page.locator('#practiceResult [data-workflow-action=finish] button[type=submit]').click();
  await page.locator('#practiceResult .workflow-step.is-completed').waitFor();
  await page.locator('[data-refresh-practice]').click();await page.locator('[data-resume-practice]').first().click();await page.locator('#practiceResult .workflow-step').waitFor();

  await page.locator('[data-admin-subnav=workplace] [data-tab=instructions]').click();await page.locator('[data-library-materials]').click();await page.locator('.tool-photo-card').first().waitFor();
  assert.ok(await page.locator('.tool-photo-card img').count()>0);
  await page.locator('[data-admin-subnav=workplace] [data-tab=warehouse]').click();await page.locator('[data-warehouse-item]').first().waitFor();
  await page.locator('[data-warehouse-member]').selectOption(fixture.member.id);
  const item=page.locator('[data-warehouse-item="24101"]');await item.locator('[name=quantity]').fill('10');await item.locator('[type=submit]').click();
  await page.getByText('Laatst uit reserve gepakt',{exact:true}).waitFor();
  await page.locator('[data-warehouse-item="24101"]').getByText(/Werkbank: 10/).waitFor();
  assert.equal(fixture.sql.prepare("SELECT SUM(quantity) n FROM warehouse_issues WHERE sku='24101'").get().n,10);
  assert.equal(await page.locator('[data-warehouse-host]').textContent().then(t=>t.includes('unitCost')),false);await fits();
  await mkdir(resolve(root,'output/workplace-review'),{recursive:true});await page.locator('[data-admin-subnav=workplace]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'output/workplace-review/phone.png')});
  await page.locator('#adminTabs [data-tab=inventory]').click();
 });
 await scenario('Workshop availability calendar saves real shifts and central planning updates without a staff login',async()=>{
  await page.locator('.admin-security-dialog button').filter({hasText:'Sluiten'}).click();await page.locator('#adminTabs [data-tab=workplace]').click();
  await page.locator('[data-admin-subnav=workplace] [data-tab=availability]').click();const host=page.locator('[data-workplace-content=availability]');
  await host.locator('[data-planning-member]').selectOption(fixture.member.id);await host.locator('.availability-day:not([disabled])').first().waitFor();
  const date=await host.locator('.availability-day:not([disabled])').first().getAttribute('data-date');await host.locator('[data-date="'+date+'"]').click();await host.locator('#availabilityStart').fill('10:00');await host.locator('#availabilityEnd').fill('15:30');
  await host.getByRole('button',{name:'Beschikbaarheid opslaan',exact:true}).click();await host.getByText('Beschikbaarheid en werktijden opgeslagen.',{exact:true}).waitFor();
  assert.equal(fixture.sql.prepare('SELECT start_time FROM member_availability WHERE member_id=? AND work_date=?').get(fixture.member.id,date).start_time,'10:00');await fits();
  await mkdir(resolve(root,'output/workplace-planning-review'),{recursive:true});await host.locator('#availabilityMonthLabel').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'output/workplace-planning-review/availability-phone.png')});
  Object.assign(fixture.env,{HRM_CENTRAL_ENABLED:'true',HRM_CONNECTOR_SECRET:'x'.repeat(64)});
  await page.locator('[data-admin-subnav=workplace] [data-tab=planning-work]').click();const plan=page.locator('[data-workplace-content=planning]');await plan.locator('[data-planning-member]').selectOption(fixture.member.id);await plan.getByText('Fictieve werkplaatstaken',{exact:true}).waitFor();
  assert.ok(await plan.locator('[data-planning-week]').textContent().then(t=>t.includes('10:00')));await plan.locator('[data-task-status]').selectOption('done');await plan.locator('[data-task-status] option:checked').filter({hasText:'Afgerond'}).waitFor({state:'attached'});assert.equal(planningStatus,'done');
  await fits();await plan.locator('[data-planning-summary]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'output/workplace-planning-review/planning-phone.png')});await page.setViewportSize({width:1024,height:900});await fits();await page.screenshot({path:resolve(root,'output/workplace-planning-review/planning-tablet.png')});await page.setViewportSize({width:390,height:844});
  fixture.env.HRM_CENTRAL_ENABLED='false';await page.locator('#adminTabs [data-tab=inventory]').click();
 });
 await scenario('Owner receives fixed-recipient setup link and sets password personally',async()=>{await page.getByRole('button',{name:'Wachtwoord instellen of vergeten',exact:true}).click();await page.getByText(/De instellink wordt naar het vaste/).waitFor();assert.equal(mailCount,1);assert.match(mailToken,/^[a-f0-9]{64}$/);await page.goto(origin+'/beheer-beveiligen.html#token='+mailToken);assert.equal(await page.evaluate(()=>location.hash),'');await page.locator('#secureAdminForm [name=password]').fill('Synthetic admin password 2026!');await page.locator('#secureAdminForm [name=confirm]').fill('Synthetic admin password 2026!');await page.getByRole('button',{name:'Beheerwachtwoord instellen',exact:true}).click();await page.getByText(/Het extra beheerwachtwoord is ingesteld/).waitFor();await page.goto(origin+'/beheer.html');await page.locator('.admin-record').waitFor();});
 await scenario('Unlock reveals contact data, and explicit lock removes it from memory-backed screens',async()=>{await page.getByRole('button',{name:'Beheer ontgrendelen',exact:true}).first().click();const form=page.locator('[data-unlock-form]');await form.locator('[name=password]').fill('Synthetic admin password 2026!');await form.getByRole('button',{name:'Ontgrendelen',exact:true}).click();await page.locator('.admin-open-request strong').filter({hasText:'Fictieve ski-eigenaar'}).waitFor();assert.equal(await page.locator('input[value="fixture@example.test"]').count(),1);const values=await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)]);assert.equal(values.some(value=>value==='Synthetic admin password 2026!'||/^[a-f0-9]{64}$/.test(value)),false);await page.getByRole('button',{name:'Beheer vergrendelen',exact:true}).click();await page.locator('.admin-record').waitFor();assert.equal(await page.locator('input[value="fixture@example.test"]').count(),0);assert.equal(await page.locator('body').textContent().then(text=>text.includes('Fictieve ski-eigenaar')),false);});

 await scenario('Server revocation clears private drafts instead of preserving stale contact fields',async()=>{await page.getByRole('button',{name:'Beheer ontgrendelen',exact:true}).first().click();await page.locator('[data-unlock-form] [name=password]').fill('Synthetic admin password 2026!');await page.locator('[data-unlock-form] button').click();const card=page.locator('.admin-record');await card.locator('.admin-record-details>summary').click();await card.locator('[name=phone]').fill('PRIVATE DRAFT');fixture.sql.prepare('DELETE FROM admin_security_sessions').run();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('.admin-security-panel').getByText('Werkplaats geopend · beheer vergrendeld',{exact:true}).waitFor();assert.equal(await page.locator('input[value="fixture@example.test"]').count(),0);assert.equal(await page.locator('#adminList [name=phone]').count(),0);});
 await scenario('Idle timeout relocks automatically; workshop stays usable on phone and tablet',async()=>{await page.getByRole('button',{name:'Beheer ontgrendelen',exact:true}).first().click();await page.locator('[data-unlock-form] [name=password]').fill('Synthetic admin password 2026!');await page.locator('[data-unlock-form] button').click();await page.locator('input[value="fixture@example.test"]').waitFor({state:'attached'});await page.clock.fastForward(601000);await page.locator('.admin-security-panel').getByText('Werkplaats geopend · beheer vergrendeld',{exact:true}).waitFor();assert.equal(await page.locator('input[value="fixture@example.test"]').count(),0);await fits();await mkdir(resolve(root,'output/admin-security-review'),{recursive:true});await page.locator('.admin-security-panel').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'output/admin-security-review/locked-phone.png')});await page.setViewportSize({width:1024,height:900});await fits();await page.screenshot({path:resolve(root,'output/admin-security-review/locked-tablet.png')});});
 assert.deepEqual(errors,[]);console.log(`${passed} security browser scenarios passed. Synthetic data, no real emails.`);
}finally{globalThis.fetch=originalFetch;await browser?.close();await new Promise(resolve=>server.close(resolve));fixture?.close();}
