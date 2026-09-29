// Local-only preview with synthetic records. Never reads real credentials or real reservations.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from './src/index.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),origin='http://127.0.0.1:8897';
const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('./team-migrations/0001_team.sql',import.meta.url),'utf8'));
const db={prepare(q){let v=[];const s={bind(...args){v=args;return s;},async first(){return sql.prepare(q).get(...v)||null;},async all(){return {results:sql.prepare(q).all(...v)};},async run(){return {meta:sql.prepare(q).run(...v)};},execute(){const p=sql.prepare(q);return p.columns().length?{results:p.all(...v)}:{results:[],meta:p.run(...v)};}};return s;},async batch(ss){sql.exec('BEGIN');try{const out=ss.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const values=new Map(),kv={async get(k,type){const value=values.get(k);return value===undefined?null:type==='json'?JSON.parse(value):value;},async put(k,v){values.set(k,v);},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}};
const member='00000000-0000-4000-8000-000000000001',keyHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('demo-werkplaats'))),b=>b.toString(16).padStart(2,'0')).join('');
sql.prepare('INSERT INTO members VALUES(?,?,?,?,1,?)').run(member,'Robin (demo)','demo',keyHash,new Date().toISOString());
for(const [reference,name,material,currentStep] of [['LS-2609-ABCDEF','Sanne (voorbeeld)','Ski',4],['LS-2609-GHJKLM','Daan (voorbeeld)','Snowboard',5]]) {
 const record={reference,name,material,amount:'1',service:'Onderhoud',package:'Goud',currentStep,status:currentStep===4?'Inspectie uitgevoerd':'Onderhoud gestart',conditions:'Wisselende sneeuw',expectedReady:'2026-10-04',waxType:'Premium universele wax',workNote:'Kanten gecontroleerd. Klaar voor de volgende stap.',closedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await kv.put('reservation:'+reference,JSON.stringify(record));sql.prepare('INSERT INTO records(reference,payload,assigned_to,updated_at) VALUES(?,?,?,?)').run(reference,JSON.stringify(record),member,new Date().toISOString());
}
const env={LATTENSPECIALIST_TEAM_DB:db,LATTENSPECIALIST_RESERVATIONS_KV:kv,LATTENSPECIALIST_ADMIN_TOKEN:'demo-beheer',LATTENSPECIALIST_ORIGINS:origin};
const files=new Set(['medewerkers.html','medewerkers.js','medewerkers.css','beheer.html','beheer.js','admin-team.js','team.css','admin-metrics.css','styles.css','images/badge.webp','images/logo-main.webp','images/app-icon-192.png','images/app-icon-512.png']);
createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);
 if(url.pathname.startsWith('/api/')){let body='';for await(const data of req){body+=data;if(body.length>20000)throw new Error('Too large');}const response=await worker.fetch(new Request(url,{method:req.method,headers:{...req.headers,origin},...(['GET','HEAD'].includes(req.method)?{}:{body})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
 if(url.pathname==='/booking-config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('window.LATTENSPECIALIST_BOOKING={endpoint:'+JSON.stringify(origin)+'};');return;}
 const name=url.pathname==='/'?'medewerkers.html':url.pathname.slice(1);if(!files.has(name)){res.writeHead(404);res.end();return;}
 let data=await readFile(resolve(root,name));const ext=name.split('.').pop();if(ext==='html')data=data.toString().replace('<main>','<main><p>Testomgeving — fictieve gegevens</p>');res.writeHead(200,{'Content-Type':({html:'text/html',css:'text/css',js:'text/javascript',webp:'image/webp',png:'image/png'})[ext],'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(500);res.end('Previewfout');}}).listen(8897,'127.0.0.1',()=>console.log('Synthetic team preview: '+origin+' · demo / demo-werkplaats · beheer: demo-beheer'));
