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
let browser,fixture,page,origin,passed=0;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)throw Error('Too large');}const response=await worker.fetch(new Request(url,{method:req.method,headers:{...req.headers,origin},...(['GET','HEAD'].includes(req.method)?{}:{body})}),fixture.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
  if(url.pathname==='/booking-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.LATTENSPECIALIST_BOOKING={endpoint:'+JSON.stringify(origin)+'};');return;}
  const name=url.pathname==='/'?'medewerkers.html':decodeURIComponent(url.pathname.slice(1)),file=resolve(root,name);
  if(!file.startsWith(resolve(root)+'/')&&!file.startsWith(resolve(root)+'\\'))throw Error('Outside fixture');
  if(!/^(?:[a-z0-9-]+\.(?:html|css|js|webmanifest)|(?:images|vendor)\/[a-z0-9._-]+\.(?:webp|png|jpg|js))$/i.test(name)){res.writeHead(404);res.end();return;}
  const body=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end('Synthetic fixture file unavailable');}
});
async function scenario(name,run){await run();passed++;console.log('PASS '+name);}
async function fits(){const dimensions=await page.evaluate(()=>[innerWidth,document.body.scrollWidth,document.documentElement.scrollWidth]);assert.ok(dimensions.slice(1).every(width=>width<=dimensions[0]+1),JSON.stringify(dimensions));}
async function openMaterial(material){await page.locator('#manualScan input').fill(material.displayCode);await page.locator('#manualScan button').click();await page.locator('.workflow-shell[data-material-id="'+material.id+'"] .workflow-step').first().waitFor();}
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fixture=await maintenanceFixture(origin);
 const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:existsSync(chrome)?{executablePath:chrome}:{channel:'chrome'})});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'nl-NL'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));await page.goto(origin);
 await page.getByLabel('Gebruikersnaam',{exact:true}).fill('guide.fixture');await page.getByLabel('Persoonlijke toegangssleutel',{exact:true}).fill(fixture.member.accessKey);await page.getByRole('button',{name:'Open mijn werk',exact:true}).click();await page.locator('#dashboard').waitFor();
 const ski=fixture.materials.find(material=>material.kind==='Ski'),board=fixture.materials.find(material=>material.kind==='Snowboard');
 await scenario('Een aangenomen opdracht opent afzonderlijke werkplannen zonder camera of eigenaarssleutel',async()=>{
  await page.getByRole('button',{name:'Open onderhoudsplan per materiaal',exact:true}).click();const options=page.locator('[data-open-material]');await options.first().waitFor();assert.equal(await options.count(),2);await options.filter({hasText:ski.displayCode}).click();await page.locator('.workflow-step').first().waitFor();assert.equal(await page.locator('.workflow-shell').count(),1);assert.equal(await page.locator('.guide-preparation').count(),1);assert.match(await page.locator('.guide-preparation').innerText(),/AlphaMix Yellow/);assert.equal(requests.filter(url=>url.includes('/workflow')).length,0,'initial workflow reuses scan response');await fits();
 });
 await scenario('Per stap zijn uitvoering, benodigdheden, actuele voorraad en passende videolinks zichtbaar',async()=>{
  const cards=page.locator('.workflow-step');assert.ok(await cards.count()>6);for(const card of await cards.all())assert.equal(await card.locator('.maintenance-guide details').count(),1);const wax=page.locator('.maintenance-guide').filter({has:page.locator('a[href*="IAMnWugdISc"]')});await wax.locator('summary').click();assert.match(await wax.innerText(),/etikettemperatuur|waxetiket/);assert.equal(await page.locator('a[href="https://www.youtube.com/watch?v=sWby1KRJahw"]').count()>0,true);assert.equal(requests.some(url=>/youtube(?:-nocookie)?\.com/.test(url)),false,'no automatic video or thumbnail traffic');assert.equal(await page.locator('.workflow-step.is-next [data-workflow-action=start]').count(),1);assert.equal(await page.locator('.workflow-step.is-locked [data-workflow-action=start]').count(),0);
 });
 await scenario('Afronden vraagt alle controlepunten en bewaart de bevestiging na herladen',async()=>{
  const first=page.locator('.workflow-step').first();await first.getByRole('button',{name:'Start stap & timer',exact:true}).click();await first.locator('[data-workflow-action=finish]').waitFor();const form=first.locator('[data-workflow-action=finish]');await form.getByRole('button',{name:'Stap afronden',exact:true}).click();assert.equal(fixture.sql.prepare("SELECT COUNT(*) amount FROM material_events WHERE event_type='step_checks'").get().amount,0);
  for(const checkbox of await form.locator('[name=guideChecks]').all())await checkbox.check();await form.getByRole('button',{name:'Stap afronden',exact:true}).click();await first.locator('.guide-confirmed').waitFor();assert.equal(fixture.sql.prepare("SELECT COUNT(*) amount FROM material_events WHERE event_type='step_checks'").get().amount,1);await page.reload();await page.locator('#dashboard').waitFor();await openMaterial(ski);await page.locator('.workflow-step').first().locator('.guide-confirmed').waitFor();
 });
 await scenario('Een snowboard heeft zijn eigen bindingenwerk; mobiele instructies passen binnen390pixels',async()=>{
  await openMaterial(board);await page.getByRole('heading',{name:'Snowboardbindingen demonteren',exact:true}).waitFor();assert.equal(await page.locator('.guide-confirmed').count(),0);await page.setViewportSize({width:390,height:844});await fits();await page.locator('.guide-preparation').scrollIntoViewIfNeeded();await mkdir(resolve(root,'docs/screenshots'),{recursive:true});await page.screenshot({path:resolve(root,'docs/screenshots/maintenance-guide-mobile.png'),fullPage:false});const edge=page.locator('.workflow-step').filter({has:page.getByRole('heading',{name:'Kanten vijlen, slijpen en controleren',exact:true})});await edge.locator('.maintenance-guide summary').click();await edge.evaluate(element=>element.scrollIntoView({block:'start'}));await fits();await page.screenshot({path:resolve(root,'docs/screenshots/maintenance-instruction-mobile.png'),fullPage:false});await page.setViewportSize({width:1440,height:1000});await page.locator('.workflow-step').first().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'docs/screenshots/maintenance-guide-desktop.png'),fullPage:false});
 });
 await scenario('Uitloggen wist het geopende materiaal en een laat antwoord vult geen ander werkplan',async()=>{
  let release,complete;const delivered=new Promise(resolve=>complete=resolve),gate=new Promise(resolve=>release=resolve);await page.route('**/api/team/operations/scan/'+ski.displayCode,async route=>{const response=await route.fetch();await gate;await route.fulfill({response});complete();});await page.locator('#manualScan input').fill(ski.displayCode);await page.locator('#manualScan button').click();await openMaterial(board);release();await delivered;await page.unroute('**/api/team/operations/scan/'+ski.displayCode);await page.waitForTimeout(150);assert.equal(await page.locator('.workflow-shell').getAttribute('data-material-id'),board.id);await page.getByRole('button',{name:'Uitloggen',exact:true}).click();await page.locator('#login').waitFor();assert.equal(await page.locator('.workflow-shell').count(),0);
 });
 await scenario('Beheer bekijkt hetzelfde materiaalplan zonder medewerkeracties of automatische klantberichten',async()=>{
  await page.goto(origin+'/beheer.html');await page.getByLabel('Beheercode',{exact:true}).fill(fixture.owner);await page.getByRole('button',{name:'Open beheer',exact:true}).click();await page.locator('#adminDashboard').waitFor();await page.getByRole('button',{name:'Aanvragen & status',exact:true}).click();await page.locator('.admin-record-details > summary').click();await page.getByRole('button',{name:'Maak / bekijk QR-stickers',exact:true}).click();await page.locator('[data-owner-workplan]').first().click();await page.locator('.guide-owner-preview').waitFor();assert.equal(await page.locator('.guide-owner-preview [data-workflow-action]').count(),0);assert.ok(await page.locator('.guide-owner-preview .maintenance-guide').count()>6);await page.screenshot({path:resolve(root,'docs/screenshots/maintenance-guide-owner.png'),fullPage:false});await fits();
 });
 assert.deepEqual(errors,[]);console.log(passed+' maintenance-guide browser scenarios passed. Synthetic in-memory data; no live messages or stock changes.');
}catch(error){console.error(error.stack||error);console.error(errors);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fixture?.close();}
