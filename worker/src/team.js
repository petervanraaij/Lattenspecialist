// Personal access keys are random, stored only as hashes, and never included in app builds.
export class TeamError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const now = () => new Date().toISOString();
const bearer = request => (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,'0')).join('');
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
const dbFor = env => { if(!env.LATTENSPECIALIST_TEAM_DB) throw new TeamError('Medewerkerstoegang is nog niet geactiveerd.',503); return env.LATTENSPECIALIST_TEAM_DB; };
const fromRow = row => row ? {...JSON.parse(row.payload), revision:row.revision, assignedTo:row.assigned_to || ''} : null;
export const teamRecord = async (reference,env) => env.LATTENSPECIALIST_TEAM_DB ? fromRow(await env.LATTENSPECIALIST_TEAM_DB.prepare('SELECT * FROM records WHERE reference=?').bind(reference).first()) : null;
export const teamStatusRecord = async (code,env) => env.LATTENSPECIALIST_TEAM_DB ? fromRow(await env.LATTENSPECIALIST_TEAM_DB.prepare("SELECT * FROM records WHERE json_extract(payload,'$.serviceCode')=?").bind(code).first()) : null;
export async function mergeTeamRecords(records,env) {
 if(!env.LATTENSPECIALIST_TEAM_DB) return records;
 const saved=await env.LATTENSPECIALIST_TEAM_DB.prepare('SELECT * FROM records').all();
 const combined=new Map(records.map(r=>[r.reference,{...r,revision:0,assignedTo:''}]));
 for(const row of saved.results) combined.set(row.reference,fromRow(row));
 return [...combined.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function ensureTeamRecord(record,env) {
 const db=dbFor(env);
 const {revision,assignedTo,...payload}=record;
 await db.prepare('INSERT OR IGNORE INTO records(reference,payload,updated_at) VALUES(?,?,?)').bind(record.reference,JSON.stringify(payload),now()).run();
 return teamRecord(record.reference,env);
}
export async function saveOwnerRecord(record,raw,env) {
 const db=dbFor(env);
 if(!Number.isInteger(raw.revision)) throw new TeamError('Vernieuw de beheerapp voordat je deze aanvraag opslaat.',409);
 const {revision,assignedTo,...payload}=record;
 const assigned=Object.hasOwn(raw,'assignedTo') ? String(raw.assignedTo || '') : (assignedTo || '');
 const result=await db.prepare(`UPDATE records SET payload=?1,revision=revision+1,assigned_to=?2,actor='owner',updated_at=?3
 WHERE reference=?4 AND revision=?5 AND (?2 IS NULL OR EXISTS(SELECT 1 FROM members WHERE id=?2 AND active=1)) RETURNING *`)
 .bind(JSON.stringify(payload),assigned || null,now(),record.reference,raw.revision).first();
 if(!result) throw new TeamError('De aanvraag of toewijzing is gewijzigd. Vernieuw en probeer opnieuw.',409);
 return fromRow(result);
}
async function readBody(request) {
 const reader=request.body?.getReader(); if(!reader) return {};
 let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new TeamError('Te veel gegevens.',413);}chunks.push(value);}
 const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
 try {const data=JSON.parse(new TextDecoder().decode(buffer));if(!data || Array.isArray(data) || typeof data!=='object')throw 0;return data;} catch {throw new TeamError('Ongeldige gegevens.');}
}
async function identity(request,db) {
 const token=bearer(request); if(!/^[a-f0-9]{64}$/.test(token)) throw new TeamError('Log opnieuw in.',401);
 const tokenHash=await hash(token),time=Date.now();
 const user=await db.prepare(`SELECT m.id,m.name,m.login,s.expires_at FROM members m JOIN sessions s ON s.member_id=m.id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1`).bind(tokenHash,time).first();
 if(!user)throw new TeamError('Je toegang is verlopen of ingetrokken. Log opnieuw in.',401);
 return {...user,tokenHash};
}
export const staffView = record => ({reference:record.reference,revision:record.revision,customerName:String(record.name || '').split(' ')[0],material:record.material,amount:record.amount,package:record.package,pickupDate:record.pickupDate,expectedReady:record.expectedReady,conditions:record.conditions,currentStep:record.currentStep,status:record.status,waxType:record.waxType || 'Nog te bepalen',workNote:record.workNote || '',updatedAt:record.updatedAt});
export async function handleTeam(request,env,{owner,json,origin,steps,waxes,clean}) {
 const path=new URL(request.url).pathname;
 try {
  const db=dbFor(env);
  if(path.startsWith('/api/admin/team')) {
   if(!owner)throw new TeamError('Geen toegang tot beheer.',401);
   if(path==='/api/admin/team/members' && request.method==='GET') return json({members:(await db.prepare('SELECT id,name,login,active,created_at FROM members ORDER BY name').all()).results},200,origin);
   if(path==='/api/admin/team/members' && request.method==='POST') {
    const raw=await readBody(request),name=clean(raw.name,80),login=clean(raw.login,120).toLowerCase();
    if(!name || !/^[a-z0-9][a-z0-9.@_+-]{2,119}$/.test(login))throw new TeamError('Vul een naam en een geldige gebruikersnaam in (minimaal 3 tekens).');
    if(await db.prepare('SELECT id FROM members WHERE login=?').bind(login).first())throw new TeamError('Deze gebruikersnaam bestaat al.',409);
    const key=secret(),id=crypto.randomUUID();
    await db.prepare('INSERT INTO members(id,name,login,key_hash,created_at) VALUES(?,?,?,?,?)').bind(id,name,login,await hash(key),now()).run();
    return json({id,name,login,accessKey:key},201,origin);
   }
   const memberMatch=path.match(/^\/api\/admin\/team\/members\/([a-f0-9-]{36})$/);
   if(memberMatch && request.method==='PATCH') {
    const raw=await readBody(request),id=memberMatch[1];
    if(!['revoke','rotate'].includes(raw.action))throw new TeamError('Kies intrekken of nieuwe toegang.');
    const key=secret();
    const results=await db.batch([
     db.prepare('UPDATE members SET active=?,key_hash=? WHERE id=? RETURNING id,name,login,active').bind(raw.action==='rotate'?1:0,await hash(key),id),
     db.prepare('DELETE FROM sessions WHERE member_id=?').bind(id)
    ]);
    if(!results[0].results.length)throw new TeamError('Medewerker niet gevonden.',404);
    return json({...results[0].results[0],...(raw.action==='rotate'?{accessKey:key}:{})},200,origin);
   }
   if(path==='/api/admin/team/audit' && request.method==='GET') {
    const reference=new URL(request.url).searchParams.get('reference') || '';
    return json({events:(await db.prepare('SELECT * FROM team_audit WHERE reference=? ORDER BY id DESC LIMIT 100').bind(reference).all()).results},200,origin);
   }
   throw new TeamError('Niet gevonden.',404);
  }
  if(path==='/api/team/login' && request.method==='POST') {
   const raw=await readBody(request),time=Date.now(),bucket=await hash(`${request.headers.get('CF-Connecting-IP') || 'unknown'}:${Math.floor(time/900000)}`);
   const limit=await db.prepare('INSERT INTO login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,time+900000).first();
   if(limit.attempts>20)throw new TeamError('Te veel aanmeldpogingen. Probeer over 15 minuten opnieuw.',429);
   const login=clean(raw.login,120).toLowerCase(),key=String(raw.accessKey || '');
   const token=secret(),tokenHash=await hash(token),expiresAt=time+12*3600000;
   const result=await db.prepare(`INSERT INTO sessions(token_hash,member_id,expires_at) SELECT ?,id,? FROM members WHERE login=? AND key_hash=? AND active=1 RETURNING member_id`).bind(tokenHash,expiresAt,login,await hash(key)).first();
   if(!result)throw new TeamError('Gebruikersnaam of toegangssleutel onjuist.',401);
   await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(time),db.prepare('DELETE FROM login_limits WHERE expires_at<=?').bind(time)]);
   return json({token,expiresAt},200,origin);
  }
  const user=await identity(request,db);
  if(path==='/api/team/session' && request.method==='GET')return json({user:{id:user.id,name:user.name},expiresAt:user.expires_at},200,origin);
  if(path==='/api/team/logout' && request.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.tokenHash).run();return json({ok:true},200,origin);}
  if(path==='/api/team/tasks' && request.method==='GET') {
   const rows=await db.prepare(`SELECT r.* FROM records r JOIN members m ON r.assigned_to=m.id JOIN sessions s ON s.member_id=m.id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1 AND json_extract(r.payload,'$.closedAt') IS NULL ORDER BY r.updated_at DESC`).bind(user.tokenHash,Date.now()).all();
   return json({records:rows.results.map(r=>staffView(fromRow(r))),steps,waxes},200,origin);
  }
  const match=path.match(/^\/api\/team\/tasks\/(LS-\d{4}-[A-Z2-9]{6})$/);
  if(match && request.method==='PATCH') {
   const raw=await readBody(request);
   if(Object.keys(raw).some(k=>!['revision','currentStep','waxType','workNote'].includes(k)))throw new TeamError('Deze velden mag je niet wijzigen.',403);
   const row=await db.prepare('SELECT * FROM records WHERE reference=? AND assigned_to=?').bind(match[1],user.id).first();
   if(!row)throw new TeamError('Werkopdracht niet gevonden.',404);
   const record=fromRow(row),step=raw.currentStep;
   if(record.closedAt)throw new TeamError('Deze aanvraag is afgemeld.',409);
   if(!Number.isInteger(raw.revision) || !Number.isInteger(step) || step<3 || step>8 || step<record.currentStep || step>Math.max(3,record.currentStep+1))throw new TeamError('Kies de huidige of eerstvolgende onderhoudsstap.');
   if(!waxes.includes(raw.waxType))throw new TeamError('Kies een geldige waxsoort.');
   if(typeof raw.workNote!=='string' || raw.workNote.length>1000)throw new TeamError('De werknotitie mag maximaal 1000 tekens bevatten.');
   const {revision,assignedTo,...payload}=record;
   Object.assign(payload,{currentStep:step,status:steps[step-1],waxType:raw.waxType,workNote:clean(raw.workNote,1000),updatedAt:now()});
   const saved=await db.prepare(`UPDATE records SET payload=?1,revision=revision+1,actor=?2,updated_at=?3 WHERE reference=?4 AND revision=?5 AND assigned_to=?2 AND EXISTS(SELECT 1 FROM sessions s JOIN members m ON s.member_id=m.id WHERE s.token_hash=?6 AND s.member_id=?2 AND s.expires_at>?7 AND m.active=1) RETURNING *`).bind(JSON.stringify(payload),user.id,now(),record.reference,raw.revision,user.tokenHash,Date.now()).first();
   if(!saved)throw new TeamError('De opdracht of je toegang is gewijzigd. Vernieuw het overzicht.',409);
   return json({record:staffView(fromRow(saved))},200,origin);
  }
  throw new TeamError('Niet gevonden.',404);
 } catch(error) {return json({message:error instanceof TeamError?error.message:'Medewerkerstoegang tijdelijk niet beschikbaar.'},error instanceof TeamError?error.status:503,origin);}
}
