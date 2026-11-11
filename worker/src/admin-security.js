const encode=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(value))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const reply=(value,status,origin)=>Response.json(value,{status,headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export const securityEnabled=env=>env.LATTENSPECIALIST_ADMIN_SECURITY_ENABLED==='true';
const schemas=new WeakMap();
async function schema(db){if(schemas.has(db))return schemas.get(db);const ready=db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS admin_security_config(id INTEGER PRIMARY KEY CHECK(id=1),password_hash TEXT NOT NULL,version TEXT NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS admin_security_sessions(token_hash TEXT PRIMARY KEY,version TEXT NOT NULL,owner_epoch TEXT NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS admin_security_links(token_hash TEXT PRIMARY KEY,owner_epoch TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER)'),
 db.prepare('CREATE TABLE IF NOT EXISTS admin_security_rate(id TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0)')
]).catch(error=>{schemas.delete(db);throw error;});schemas.set(db,ready);return ready;}
async function epoch(env){const stored=await env.LATTENSPECIALIST_TEAM_DB.prepare("SELECT setting_value FROM hrm_settings WHERE setting_key='admin_access_hash'").first();return hash(JSON.stringify([env.LATTENSPECIALIST_ADMIN_TOKEN||'',stored?.setting_value||'']));}
async function derive(password,salt){const key=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode.encode(salt),iterations:100000},key,256)));}
const equal=(a,b)=>{if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;};
async function body(request){if(Number(request.headers.get('Content-Length'))>2048)throw Error('size');const reader=request.body?.getReader();let size=0,text='';const decoder=new TextDecoder();if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('size');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text||'{}');}
export async function adminSession(request,env){
 if(!securityEnabled(env))return {enabled:false,unlocked:true};
 const db=env.LATTENSPECIALIST_TEAM_DB;if(!db)return{enabled:true,unlocked:false,configured:false};await schema(db);
 const config=await db.prepare('SELECT * FROM admin_security_config WHERE id=1').first();
 const token=request.headers.get('X-Admin-Unlock')||'';
 if(!config||!/^[a-f0-9]{64}$/.test(token))return{enabled:true,unlocked:false,configured:Boolean(config)};
 const row=await db.prepare('SELECT * FROM admin_security_sessions WHERE token_hash=? AND version=? AND expires_at>? AND last_seen>?').bind(await hash(token),config.version,Date.now(),Date.now()-600000).first();
 if(!row||row.owner_epoch!==await epoch(env))return{enabled:true,unlocked:false,configured:true};
 if(row.last_seen<Date.now()-30000)await db.prepare('UPDATE admin_security_sessions SET last_seen=? WHERE token_hash=?').bind(Date.now(),row.token_hash).run();
 return{enabled:true,unlocked:true,configured:true};
}
export async function handleAdminSecurity(request,env,owner,origin){
 const path=new URL(request.url).pathname,db=env.LATTENSPECIALIST_TEAM_DB;
 if(path!=='/api/admin/security/complete'&&!owner)return reply({message:'Log in met de beheercode.'},401,origin);
 if(path==='/api/admin/security/status'&&request.method==='GET')return reply(await adminSession(request,env),200,origin);
 if(!securityEnabled(env)||!db)return reply({message:'Extra beheerbeveiliging is niet beschikbaar.'},503,origin);
 if(request.method!=='POST')return reply({message:'Niet toegestaan.'},405,origin);
 try{
  await schema(db);const raw=await body(request),now=Date.now();
  if(path==='/api/admin/security/request'){
   const generic={ok:true,message:'De instellink wordt naar het vaste herstelmailadres gestuurd. Controleer je e-mail. Een nieuwe link aanvragen kan na twee minuten.'};
   if(!env.RESEND_API_KEY||!env.LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL)return reply({message:'De eigenaar moet eerst de herstelmail instellen.'},503,origin);
   const limited=await db.prepare("INSERT INTO admin_security_rate(id,failures,blocked_until) VALUES('mail',1,?) ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN blocked_until<? THEN 1 ELSE failures+1 END,blocked_until=? WHERE blocked_until<=?").bind(now+120000,now-3600000,now+120000,now).run();
   if(!limited.meta.changes)return reply(generic,200,origin);
   // Consume only one request per cooldown; the next line also bounds daily mail volume.
   const recent=await db.prepare('SELECT COUNT(*) n FROM admin_security_links WHERE expires_at>?').bind(now-86400000).first();if(Number(recent.n)>=8)return reply(generic,200,origin);
   const token=random();await db.prepare('INSERT INTO admin_security_links(token_hash,owner_epoch,expires_at) VALUES(?,?,?)').bind(await hash(token),await epoch(env),now+1200000).run();
   const link='https://lattenspecialist.nl/beheer-beveiligen.html#token='+token;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.LATTENSPECIALIST_FROM_EMAIL,to:[env.LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL],subject:'Extra beheerwachtwoord instellen · De Lattenspecialist',text:'Stel zelf je extra beheerwachtwoord in via:\n'+link+'\n\nDeze link is 20 minuten geldig en werkt één keer. Dit wijzigt de gedeelde werkplaatscode niet. Oude beheerontgrendelingen worden ingetrokken. Heb je dit niet aangevraagd? Negeer deze e-mail.'})});
   if(!response.ok){await db.prepare('UPDATE admin_security_links SET consumed_at=? WHERE token_hash=?').bind(now,await hash(token)).run();return reply({message:'De instellink kon niet worden verstuurd. Probeer later opnieuw.'},503,origin);}return reply(generic,200,origin);
  }
  if(path==='/api/admin/security/complete'){
   const password=String(raw.password||''),token=String(raw.token||'');
   if(password.length<12||password.length>128||password!==password.trim())return reply({message:'Gebruik 12 tot 128 tekens, zonder spaties aan het begin of einde.'},400,origin);
   if(!/^[a-f0-9]{64}$/.test(token))return reply({message:'Deze instellink is ongeldig of verlopen.'},400,origin);
   const tokenHash=await hash(token),link=await db.prepare('SELECT * FROM admin_security_links WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').bind(tokenHash,now).first();
   if(!link||link.owner_epoch!==await epoch(env))return reply({message:'Deze instellink is ongeldig of verlopen.'},400,origin);
   const salt=random(),passwordHash=salt+':'+await derive(password,salt),version=random();
   const result=await db.batch([
    db.prepare('INSERT INTO admin_security_config(id,password_hash,version) SELECT 1,?,? WHERE EXISTS(SELECT 1 FROM admin_security_links WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=excluded.version').bind(passwordHash,version,tokenHash,now),
    db.prepare('UPDATE admin_security_links SET consumed_at=? WHERE consumed_at IS NULL AND EXISTS(SELECT 1 FROM admin_security_config WHERE version=?)').bind(now,version),
    db.prepare('DELETE FROM admin_security_sessions WHERE EXISTS(SELECT 1 FROM admin_security_config WHERE version=?)').bind(version),
    db.prepare("INSERT INTO admin_security_rate(id,failures,blocked_until) VALUES('unlock',0,0) ON CONFLICT(id) DO UPDATE SET failures=0,blocked_until=0 WHERE EXISTS(SELECT 1 FROM admin_security_config WHERE version=?)").bind(version)
   ]);
   if(!result[0].meta.changes)return reply({message:'Deze instellink is al gebruikt.'},400,origin);
   await db.prepare("INSERT INTO hrm_audit(member_id,actor,action,created_at) VALUES(NULL,'owner-security','admin_password_set',?)").bind(new Date(now).toISOString()).run();
   return reply({ok:true,message:'Het extra beheerwachtwoord is ingesteld. Open Beheer en ontgrendel met je nieuwe wachtwoord. De werkplaatscode blijft gelijk.'},200,origin);
  }
  if(path==='/api/admin/security/unlock'){
   const rate=await db.prepare("SELECT * FROM admin_security_rate WHERE id='unlock'").first();if(rate?.blocked_until>now)return reply({message:'Te veel pogingen. Probeer het over tien minuten opnieuw.'},429,origin);
   const config=await db.prepare('SELECT * FROM admin_security_config WHERE id=1').first();if(!config)return reply({message:'Stel het extra beheerwachtwoord eerst via je herstelmail in.'},403,origin);
   const reserved=await db.prepare("INSERT INTO admin_security_rate(id,failures,blocked_until) VALUES('unlock',1,0) ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN blocked_until>0 AND blocked_until<=? THEN 1 ELSE failures+1 END,blocked_until=CASE WHEN failures>=4 THEN ? ELSE 0 END WHERE blocked_until<=?").bind(now,now+600000,now).run();if(!reserved.meta.changes)return reply({message:'Probeer later opnieuw.'},429,origin);
   const [salt,expected]=config.password_hash.split(':'),password=String(raw.password||'');
   if(password.length>128||!equal(await derive(password,salt),expected))return reply({message:'Het extra beheerwachtwoord is niet juist.'},401,origin);
   await db.prepare("UPDATE admin_security_rate SET failures=0,blocked_until=0 WHERE id='unlock'").run();
   await db.prepare('DELETE FROM admin_security_sessions WHERE expires_at<? OR last_seen<?').bind(now,now-600000).run();
   const token=random();await db.prepare('INSERT INTO admin_security_sessions(token_hash,version,owner_epoch,last_seen,expires_at) VALUES(?,?,?,?,?)').bind(await hash(token),config.version,await epoch(env),now,now+28800000).run();
   await db.prepare("INSERT INTO hrm_audit(member_id,actor,action,created_at) VALUES(NULL,'owner-security','admin_unlocked',?)").bind(new Date(now).toISOString()).run();
   return reply({ok:true,token,idleSeconds:600},200,origin);
  }
  if(path==='/api/admin/security/lock'){await db.prepare('DELETE FROM admin_security_sessions WHERE token_hash=?').bind(await hash(request.headers.get('X-Admin-Unlock')||'')).run();return reply({ok:true},200,origin);}
  return reply({message:'Niet gevonden.'},404,origin);
 }catch{return reply({message:'Beheerbeveiliging is tijdelijk niet beschikbaar.'},503,origin);}
}
const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object||{},key)).map(key=>[key,object[key]]));
export const workspaceRecord=record=>({...pick(record,['reference','revision','service','material','amount','package','waxstickCount','currentStep','status','expectedReady','plannedMinutes','assignedTo','createdAt','updatedAt','closedAt','workOrderNumber','workOrderCreatedAt','waxType','workNote']),name:'Werkorder '+(record.workOrderNumber||record.reference||''),workspaceOnly:true});
function stripCosts(value){if(Array.isArray(value))return value.map(stripCosts);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/cost|price|profit|revenue|margin|payment|salary|wage|iban|email|phone|address|postcode|customerName|login/i.test(key)).map(([key,v])=>[key,stripCosts(v)]));return value;}
export function workspaceAllowed(path,method){
 if(['/api/admin/operations/workplace/planning','/api/admin/operations/workplace/availability'].includes(path)&&['GET','PATCH'].includes(method))return true;
 if(['/api/admin/workplace/warehouse','/api/admin/workplace/practice'].includes(path)&&method==='GET')return true;
 if(['/api/admin/workplace/practice','/api/admin/workplace/warehouse/pick'].includes(path)&&method==='POST')return true;
 if(method==='POST'&&['/api/admin/push/register','/api/admin/push/unregister','/api/admin/push/received'].includes(path))return true;
 if(method==='GET'&&['/api/admin/reservations','/api/admin/team/members','/api/admin/availability','/api/admin/inventory/guides'].includes(path))return true;
 if(path==='/api/admin/operations/materials'&&['GET','POST'].includes(method))return true;
 if(method==='GET'&&/^\/api\/admin\/operations\/scan\/(?:[a-f0-9]{48}|LSM-[A-F0-9]{6})$/i.test(path))return true;
 if(/^\/api\/admin\/operations\/materials\/[a-f0-9-]{36}\/(workflow|photos(?:\/[a-f0-9-]{36})?)$/.test(path)&&['GET','POST'].includes(method))return true;
 return method==='POST'&&/^\/api\/admin\/operations\/steps\/[a-f0-9-]{36}\/(start|pause|finish)$/.test(path);
}
export async function workspaceResponse(response,path){
 if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json')||path.startsWith('/api/admin/push/'))return response;
 const value=await response.json();
 if(path==='/api/admin/reservations')value.records=(value.records||[]).filter(record=>!record.deletedAt).map(workspaceRecord);
 if(path==='/api/admin/team/members')value.members=(value.members||[]).map(member=>pick(member,['id','name','active']));
 if(value.record)value.record=workspaceRecord(value.record);
 if(path==='/api/team/tasks')value.records=(value.records||[]).map(workspaceRecord);
 if(value.work)value.work={package:value.work.package,waxType:value.work.waxType};
 const headers=new Headers(response.headers);headers.delete('Content-Length');headers.set('Cache-Control','private, no-store');headers.set('X-Admin-Mode','workspace');headers.set('Access-Control-Expose-Headers','X-Admin-Mode');
 const clean=stripCosts(value);if(path.startsWith('/api/team/')){if(clean.work)clean.work.customerName='Materiaal '+(clean.material?.displayCode||'');if(clean.records)clean.records=clean.records.map(record=>({...record,customerName:'Opdracht '+record.reference}));if(clean.record)clean.record.customerName='Opdracht '+clean.record.reference;}
 return new Response(JSON.stringify(clean),{status:response.status,headers});
}
