const now = () => new Date().toISOString();
const bearer = request => (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

class OperationsError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function body(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 20000) throw new OperationsError('Te veel gegevens.', 413);
  try {
    const value = await request.json();
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new OperationsError('Ongeldige gegevens.'); }
}

async function memberIdentity(request, db) {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new OperationsError('Log opnieuw in.', 401);
  const tokenHash = await hash(token);
  const member = await db.prepare(`SELECT m.id,m.name,m.login,s.expires_at FROM members m JOIN sessions s ON s.member_id=m.id
    WHERE s.token_hash=? AND s.expires_at>? AND m.active=1`).bind(tokenHash, Date.now()).first();
  if (!member) throw new OperationsError('Je toegang is verlopen. Log opnieuw in.', 401);
  return {...member, tokenHash};
}

const recordFromRow = row => row ? {...JSON.parse(row.payload), revision: row.revision, assignedTo: row.assigned_to || ''} : null;

async function pinValue(pin) {
  const value = clean(pin, 20);
  if (!/^\d{4,12}$/.test(value)) throw new OperationsError('Gebruik een pincode van 4 tot 12 cijfers.');
  return value;
}

async function pinSigningKey(env) {
  const encoded = String(env.HRM_DATA_KEY || '');
  if (!encoded) throw new OperationsError('HRM-versleuteling is nog niet geactiveerd.', 503);
  const raw = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  if (raw.length !== 32) throw new OperationsError('HRM-versleuteling is verkeerd ingesteld.', 503);
  return crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
}

async function createPinHash(pin, env) {
  const salt = randomHex(16);
  const message = new TextEncoder().encode(`lattenspecialist-hrm-pin:${salt}:${await pinValue(pin)}`);
  const signature = await crypto.subtle.sign('HMAC', await pinSigningKey(env), message);
  return `hmac1:${salt}:${hex(new Uint8Array(signature))}`;
}

async function verifyPin(pin, stored, env) {
  const [version,salt,expected] = String(stored || '').split(':');
  if (version !== 'hmac1' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(expected || '')) return false;
  const message = new TextEncoder().encode(`lattenspecialist-hrm-pin:${salt}:${clean(pin,20)}`);
  const signature = await crypto.subtle.sign('HMAC', await pinSigningKey(env), message);
  const actual = hex(new Uint8Array(signature));
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i=0;i<actual.length;i+=1) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

async function encryptionKey(env) {
  const encoded = String(env.HRM_DATA_KEY || '');
  if (!encoded) throw new OperationsError('HRM-versleuteling is nog niet geactiveerd.', 503);
  const raw = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  if (raw.length !== 32) throw new OperationsError('HRM-versleuteling is verkeerd ingesteld.', 503);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}

async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, await encryptionKey(env), new TextEncoder().encode(JSON.stringify(value)));
  const bytes = new Uint8Array(iv.length + encrypted.byteLength); bytes.set(iv); bytes.set(new Uint8Array(encrypted),iv.length);
  return btoa(String.fromCharCode(...bytes));
}

async function open(ciphertext, env, fallback = {}) {
  if (!ciphertext) return fallback;
  try {
    const bytes = Uint8Array.from(atob(ciphertext), character => character.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)}, await encryptionKey(env), bytes.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new OperationsError('De beveiligde HRM-gegevens konden niet worden geopend.', 503); }
}

const materialPublicStatus = action => ({
  pickup_depart:'Onderweg om op te halen', receive:'Materiaal ontvangen',
  work_complete:'Klaar om opgehaald te worden', ready:'Klaar om opgehaald te worden',
  delivery_depart:'Onderweg terugbrengen', delivered:'Afgeleverd/afgerond'
}[action] || null);

const internalStatus = action => ({
  pickup_depart:'pickup_underway',receive:'received',work_start:'maintenance',work_pause:'paused',
  work_complete:'ready',ready:'ready',delivery_depart:'delivery_underway',delivered:'delivered'
}[action]);

async function syncRecordCustomerStatus(db, reference, status, timestamp) {
  if (!status) return;
  const step = status === 'Onderweg om op te halen' ? 2 : status === 'Materiaal ontvangen' ? 3 : status.startsWith('Klaar') ? 8 : status === 'Onderweg terugbrengen' ? 8 : status === 'Afgeleverd/afgerond' ? 8 : 1;
  await db.prepare(`UPDATE records SET payload=json_set(payload,'$.customerStatus',?1,'$.status',?1,'$.currentStep',?2,'$.updatedAt',?3),actor='operations',updated_at=?3 WHERE reference=?4`)
    .bind(status,step,timestamp,reference).run();
}

const whatsAppPhone=value=>{let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.startsWith('0'))digits=`31${digits.slice(1)}`;return /^\d{8,15}$/.test(digits)?digits:'';};
async function notifyCustomer(record,status,env){
  const token=env.WHATSAPP_ACCESS_TOKEN,phoneId=env.WHATSAPP_PHONE_NUMBER_ID,template=env.LATTENSPECIALIST_WHATSAPP_STATUS_TEMPLATE,destination=whatsAppPhone(record?.phone);
  if(!status||!record?.whatsappConsent||!token||!phoneId||!template||!destination)return {sent:false};
  const firstName=String(record.name||'').split(/\s+/)[0],code=record.serviceCode||record.reference,url=record.serviceCode?`https://lattenspecialist.nl/app.html#status=${encodeURIComponent(record.serviceCode)}`:'https://lattenspecialist.nl/app.html#onderhoud';
  try{const response=await fetch(`https://graph.facebook.com/${clean(env.WHATSAPP_GRAPH_VERSION||'v23.0',12)}/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:destination,type:'template',template:{name:template,language:{code:'nl'},components:[{type:'body',parameters:[firstName,status,code,url].map(text=>({type:'text',text:String(text)}))}]}})});return {sent:response.ok};}catch{return {sent:false};}
}

const materialView = row => ({
  id:row.id, token:row.scan_token, displayCode:row.display_code, reference:row.reference, itemNumber:row.item_number,
  kind:row.kind, package:row.package_name || '', waxType:row.wax_type || '', assignedTo:row.assigned_to || '',
  internalStatus:row.internal_status, customerStatus:row.customer_status, createdAt:row.created_at,
  updatedAt:row.updated_at, receivedAt:row.received_at, readyAt:row.ready_at, deliveredAt:row.delivered_at,
  qrValue:`https://lattenspecialist.nl/medewerkers.html#scan=${encodeURIComponent(row.scan_token)}`
});

async function createMaterials(db, reference) {
  const row = await db.prepare('SELECT * FROM records WHERE reference=?').bind(reference).first();
  if (!row) throw new OperationsError('Aanvraag niet gevonden.',404);
  const record = recordFromRow(row), amount = Math.max(1,Math.min(20,Number(record.amount) || 1));
  await syncRecordCustomerStatus(db,reference,'Afspraak bevestigd',now());
  const existing = await db.prepare('SELECT * FROM materials WHERE reference=? ORDER BY item_number').bind(reference).all();
  for (let number=existing.results.length+1;number<=amount;number+=1) {
    const created=now(),id=crypto.randomUUID(),token=randomHex(24),display=`LSM-${randomHex(3).toUpperCase()}`;
    await db.batch([
      db.prepare(`INSERT INTO materials(id,scan_token,display_code,reference,item_number,kind,package_name,wax_type,assigned_to,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,token,display,reference,number,clean(record.material || record.rentaltype || 'Materiaal',80),clean(record.package || 'Onderhoud',100),clean(record.waxType || 'Nog te bepalen',100),record.assignedTo || null,created,created),
      db.prepare('INSERT INTO material_events(material_id,actor,event_type,created_at) VALUES(?,?,?,?)').bind(id,'owner','label_created',created)
    ]);
  }
  return (await db.prepare('SELECT * FROM materials WHERE reference=? ORDER BY item_number').bind(reference).all()).results.map(materialView);
}

async function workAction(db, material, action, actor) {
  const timestamp=now(),status=internalStatus(action),customer=materialPublicStatus(action);
  if (!status) throw new OperationsError('Onbekende scanactie.');
  if (action==='work_start') {
    const openSession=await db.prepare("SELECT id FROM work_sessions WHERE material_id=? AND member_id=? AND activity='maintenance' AND ended_at IS NULL").bind(material.id,actor.id).first();
    if (!openSession) await db.prepare('INSERT INTO work_sessions(id,material_id,member_id,activity,started_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),material.id,actor.id,'maintenance',timestamp).run();
  }
  if (['work_pause','work_complete'].includes(action)) {
    await db.prepare("UPDATE work_sessions SET ended_at=?1,duration_seconds=MAX(1,CAST((julianday(?1)-julianday(started_at))*86400 AS INTEGER)) WHERE material_id=?2 AND member_id=?3 AND activity='maintenance' AND ended_at IS NULL").bind(timestamp,material.id,actor.id).run();
  }
  const received=action==='receive'?timestamp:material.received_at,ready=['ready','work_complete'].includes(action)?timestamp:material.ready_at,delivered=action==='delivered'?timestamp:material.delivered_at;
  const assignee=actor.id==='owner'?null:actor.id;
  await db.batch([
    db.prepare(`UPDATE materials SET assigned_to=COALESCE(assigned_to,?1),internal_status=?2,customer_status=COALESCE(?3,customer_status),updated_at=?4,received_at=?5,ready_at=?6,delivered_at=?7 WHERE id=?8`)
      .bind(assignee,status,customer,timestamp,received,ready,delivered,material.id),
    db.prepare('INSERT INTO material_events(material_id,actor,event_type,created_at) VALUES(?,?,?,?)').bind(material.id,actor.id,action,timestamp)
  ]);
  await syncRecordCustomerStatus(db,material.reference,customer,timestamp);
  if(customer){const record=recordFromRow(await db.prepare('SELECT * FROM records WHERE reference=?').bind(material.reference).first());await notifyCustomer(record,customer,actor.env||{});}
  return materialView(await db.prepare('SELECT * FROM materials WHERE id=?').bind(material.id).first());
}

async function geocode(record) {
  const postcode=clean(record.postcode,12).replace(/\s/g,''),number=clean(record.houseNumber,20);
  if (!postcode || !number) return null;
  try {
    const url=new URL('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free');
    url.searchParams.set('q',`${postcode} ${number}`);url.searchParams.append('fq','type:adres');url.searchParams.set('rows','1');url.searchParams.set('fl','centroide_ll');
    const response=await fetch(url); if(!response.ok)return null; const result=await response.json();
    const point=String(result.response?.docs?.[0]?.centroide_ll || '').match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    return point?{lng:Number(point[1]),lat:Number(point[2])}:null;
  } catch { return null; }
}

const distance=(a,b)=>Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*70);
function optimiseStops(stops) {
  const ordered=[],remaining=[...stops];let current={lat:51.880,lng:5.470};
  while(remaining.length){let best=0;for(let i=1;i<remaining.length;i+=1)if(distance(current,remaining[i])<distance(current,remaining[best]))best=i;const next=remaining.splice(best,1)[0];ordered.push(next);if(Number.isFinite(next.lat))current=next;}
  return ordered;
}

function mapsUrl(stops) {
  if(!stops.length)return '';
  const destination=stops.at(-1).address,waypoints=stops.slice(0,-1).map(stop=>stop.address).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Wamel')}&destination=${encodeURIComponent(destination)}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;
}

async function createRoute(db, raw) {
  const references=[...new Set((Array.isArray(raw.references)?raw.references:[]).map(value=>clean(value,30)))].slice(0,20);
  if(!references.length)throw new OperationsError('Selecteer minimaal één ophaaladres.');
  const member=clean(raw.assignedTo,40),date=clean(raw.date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new OperationsError('Kies een routedatum.');
  const stops=[];
  for(const reference of references){const row=await db.prepare('SELECT * FROM records WHERE reference=?').bind(reference).first();if(!row)continue;const record=recordFromRow(row),coords=await geocode(record);stops.push({reference,customerName:clean(record.name,100),address:clean(record.address,240),itemCount:Math.max(1,Number(record.amount)||1),lat:coords?.lat,lng:coords?.lng});}
  const ordered=optimiseStops(stops),id=crypto.randomUUID(),created=now(),url=mapsUrl(ordered);
  await db.prepare('INSERT INTO routes(id,route_date,assigned_to,maps_url,created_at) VALUES(?,?,?,?,?)').bind(id,date,member||null,url,created).run();
  for(let i=0;i<ordered.length;i+=1){const stop=ordered[i];await db.prepare('INSERT INTO route_stops(id,route_id,reference,stop_order,customer_name,address,latitude,longitude,item_count) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,stop.reference,i+1,stop.customerName,stop.address,stop.lat??null,stop.lng??null,stop.itemCount).run();}
  return routeDetails(db,id);
}

async function routeDetails(db,id){const route=await db.prepare('SELECT * FROM routes WHERE id=?').bind(id).first();if(!route)return null;return {...route,stops:(await db.prepare('SELECT * FROM route_stops WHERE route_id=? ORDER BY stop_order').bind(id).all()).results};}

async function dashboard(db) {
  const [materials,times,feedback,members,routes,recentSessions,delivery,receivedDaily,completedDaily,turnaroundDaily,production,queue,turnaroundComparison,planning,activeWork]=await Promise.all([
    db.prepare(`SELECT COUNT(*) total,SUM(internal_status='ready') ready,SUM(internal_status='delivered') delivered,SUM(internal_status NOT IN ('ready','delivered','label_created')) active FROM materials`).first(),
    db.prepare(`SELECT COUNT(*) sessions,COALESCE(AVG(duration_seconds),0) average_seconds,COALESCE(SUM(duration_seconds),0) total_seconds FROM work_sessions WHERE activity='maintenance' AND ended_at IS NOT NULL`).first(),
    db.prepare(`SELECT COUNT(*) responses,COALESCE(AVG(overall),0) overall,COALESCE(AVG(quality),0) quality,COALESCE(AVG(communication),0) communication,COALESCE(AVG(speed),0) speed FROM customer_feedback`).first(),
    db.prepare(`SELECT m.id,m.name,COUNT(DISTINCT ma.id) items,COALESCE(SUM(ws.duration_seconds),0) seconds FROM members m LEFT JOIN materials ma ON ma.assigned_to=m.id LEFT JOIN work_sessions ws ON ws.member_id=m.id AND ws.ended_at IS NOT NULL WHERE m.active=1 GROUP BY m.id,m.name ORDER BY m.name`).all(),
    db.prepare(`SELECT COUNT(*) completed,COALESCE(AVG((julianday(ended_at)-julianday(started_at))*86400),0) average_seconds,COALESCE(SUM((SELECT SUM(item_count) FROM route_stops s WHERE s.route_id=routes.id)),0) items FROM routes WHERE ended_at IS NOT NULL`).first(),
    db.prepare("SELECT duration_seconds,started_at FROM work_sessions WHERE activity='maintenance' AND ended_at IS NOT NULL AND started_at>=datetime('now','-60 days')").all(),
    db.prepare(`SELECT COUNT(*) ready_count,SUM(CASE WHEN m.ready_at IS NOT NULL AND json_extract(r.payload,'$.expectedReady') IS NOT NULL AND date(m.ready_at)<=date(json_extract(r.payload,'$.expectedReady')) THEN 1 ELSE 0 END) on_time FROM materials m JOIN records r ON r.reference=m.reference WHERE m.ready_at IS NOT NULL`).first(),
    db.prepare(`SELECT date(received_at) day,COUNT(*) count FROM materials WHERE received_at IS NOT NULL AND received_at>=datetime('now','-90 days') GROUP BY date(received_at) ORDER BY day`).all(),
    db.prepare(`SELECT date(ready_at) day,COUNT(*) count FROM materials WHERE ready_at IS NOT NULL AND ready_at>=datetime('now','-90 days') GROUP BY date(ready_at) ORDER BY day`).all(),
    db.prepare(`SELECT date(ready_at) day,AVG((julianday(ready_at)-julianday(received_at))*86400) seconds FROM materials WHERE received_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at>=received_at AND ready_at>=datetime('now','-90 days') GROUP BY date(ready_at) ORDER BY day`).all(),
    db.prepare(`SELECT COUNT(*) completed,COUNT(DISTINCT date(ready_at)) production_days FROM materials WHERE ready_at IS NOT NULL AND ready_at>=datetime('now','-30 days')`).first(),
    db.prepare(`SELECT COUNT(*) backlog FROM materials WHERE internal_status IN ('received','maintenance','paused')`).first(),
    db.prepare(`SELECT AVG(CASE WHEN ready_at>=datetime('now','-30 days') THEN (julianday(ready_at)-julianday(received_at))*86400 END) current_seconds,AVG(CASE WHEN ready_at<datetime('now','-30 days') AND ready_at>=datetime('now','-60 days') THEN (julianday(ready_at)-julianday(received_at))*86400 END) previous_seconds FROM materials WHERE received_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at>=received_at`).first(),
    db.prepare(`SELECT COUNT(*) requests,COALESCE(SUM(COALESCE(CAST(json_extract(payload,'$.plannedMinutes') AS INTEGER),CASE WHEN json_extract(payload,'$.service')='Onderhoud' THEN MAX(1,CAST(COALESCE(json_extract(payload,'$.amount'),1) AS INTEGER))*60 ELSE 0 END)),0) reserved_minutes FROM records WHERE json_extract(payload,'$.closedAt') IS NULL AND COALESCE(CAST(json_extract(payload,'$.currentStep') AS INTEGER),1)<8`).first(),
    db.prepare(`SELECT m.id,m.display_code,m.reference,m.item_number,m.kind,m.package_name,mem.name member_name,ws.started_at,
      COALESCE((SELECT SUM(done.duration_seconds) FROM work_sessions done WHERE done.material_id=m.id AND done.activity='maintenance' AND done.ended_at IS NOT NULL),0) completed_seconds,
      CAST(ROUND(COALESCE(CAST(json_extract(r.payload,'$.plannedMinutes') AS INTEGER),MAX(1,CAST(COALESCE(json_extract(r.payload,'$.amount'),1) AS INTEGER))*60)*60.0/MAX(1,CAST(COALESCE(json_extract(r.payload,'$.amount'),1) AS INTEGER))) AS INTEGER) planned_seconds
      FROM work_sessions ws JOIN materials m ON m.id=ws.material_id JOIN records r ON r.reference=m.reference LEFT JOIN members mem ON mem.id=ws.member_id
      WHERE ws.activity='maintenance' AND ws.ended_at IS NULL ORDER BY ws.started_at`).all()
  ]);
  const cutoff=Date.now()-30*86400000,current=[],previous=[];for(const item of recentSessions.results){(new Date(item.started_at).getTime()>=cutoff?current:previous).push(Number(item.duration_seconds)||0);}
  const average=list=>list.length?list.reduce((sum,value)=>sum+value,0)/list.length:0,median=list=>{if(!list.length)return 0;const sorted=[...list].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
  const currentAverage=average(current),baseline=average(previous),delta=baseline?((currentAverage-baseline)/baseline)*100:0;
  const trend={average_seconds:currentAverage,median_seconds:median(current),baseline_seconds:baseline,delta_percent:Number(delta.toFixed(1)),label:!baseline?'Nog geen vergelijkingsperiode':delta<-5?'Sneller dan normaal':delta>5?'Langzamer dan normaal':'Volgens normaal tempo'};
  const dailyRate=production.production_days?production.completed/production.production_days:0;
  const estimatedDays=dailyRate&&queue.backlog?Math.ceil(queue.backlog/dailyRate):0;
  const currentTurnaround=Number(turnaroundComparison.current_seconds)||0,previousTurnaround=Number(turnaroundComparison.previous_seconds)||0;
  const turnaroundDelta=previousTurnaround?((currentTurnaround-previousTurnaround)/previousTurnaround)*100:0;
  return {materials,times,feedback,routes,trend,onTime:{ready:delivery.ready_count||0,percentage:delivery.ready_count?Math.round((delivery.on_time||0)/delivery.ready_count*100):0},members:members.results,activeWork:activeWork.results,
    flow:{received:receivedDaily.results,completed:completedDaily.results,turnaround:turnaroundDaily.results},
    forecast:{backlog:queue.backlog||0,openRequests:planning.requests||0,reservedMinutes:planning.reserved_minutes||0,dailyRate:Number(dailyRate.toFixed(1)),estimatedProductionDays:estimatedDays,currentTurnaroundSeconds:currentTurnaround,previousTurnaroundSeconds:previousTurnaround,turnaroundDeltaPercent:Number(turnaroundDelta.toFixed(1)),label:!previousTurnaround?'Nog geen vergelijkingsperiode':turnaroundDelta<-5?'Sneller dan de vorige periode':turnaroundDelta>5?'Langzamer dan de vorige periode':'Ongeveer even snel als normaal'}};
}

async function adminHrm(request,env,db,path) {
  const raw=request.method==='GET'?{}:await body(request),pin=request.headers.get('X-HRM-PIN') || raw.pin || '';
  let setting=await db.prepare("SELECT setting_value FROM hrm_settings WHERE setting_key='admin_pin'").first();
  if(path==='/api/admin/hrm/status'&&request.method==='GET')return {configured:Boolean(setting)};
  if(path==='/api/admin/hrm/setup'&&request.method==='POST'){
    if(setting)throw new OperationsError('De HRM-pincode is al ingesteld.',409);const pinHash=await createPinHash(raw.pin,env);
    await db.prepare("INSERT INTO hrm_settings(setting_key,setting_value,updated_at) VALUES('admin_pin',?,?)").bind(pinHash,now()).run();
    return {ok:true};
  }
  if(!setting)throw new OperationsError('Stel eerst een aparte HRM-pincode in.',428);
  if(!await verifyPin(pin,setting.setting_value,env))throw new OperationsError('HRM-pincode onjuist.',403);
  if(path==='/api/admin/hrm/change-pin'&&request.method==='POST'){
    const pinHash=await createPinHash(raw.newPin,env);
    await db.prepare("UPDATE hrm_settings SET setting_value=?,updated_at=? WHERE setting_key='admin_pin'").bind(pinHash,now()).run();
    await db.prepare('INSERT INTO hrm_audit(member_id,actor,action,created_at) VALUES(?,?,?,?)').bind(null,'owner','admin_pin_changed',now()).run();
    return {ok:true};
  }
  if(path==='/api/admin/hrm/members'&&request.method==='GET'){
    const rows=(await db.prepare('SELECT m.id,m.name,m.login,h.profile_ciphertext,h.terms_ciphertext,h.updated_at FROM members m LEFT JOIN member_hrm h ON h.member_id=m.id ORDER BY m.name').all()).results;
    const result=[];for(const row of rows){const terms=await open(row.terms_ciphertext,env,{}),totals=await db.prepare("SELECT COUNT(DISTINCT material_id) items,COALESCE(SUM(duration_seconds),0) seconds,COUNT(DISTINCT CASE WHEN started_at>=date('now','start of month') THEN material_id END) month_items,COALESCE(SUM(CASE WHEN started_at>=date('now','start of month') THEN duration_seconds ELSE 0 END),0) month_seconds FROM work_sessions WHERE member_id=? AND activity='maintenance' AND ended_at IS NOT NULL").bind(row.id).first(),hourly=Number(terms.hourlyRate)||0,itemRate=Number(terms.itemRate)||0,earnings=terms.payType==='item'?totals.items*itemRate:(totals.seconds/3600)*hourly,monthEarnings=terms.payType==='item'?totals.month_items*itemRate:(totals.month_seconds/3600)*hourly;result.push({id:row.id,name:row.name,login:row.login,profile:await open(row.profile_ciphertext,env,{}),terms,totals:{...totals,earnings:Number(earnings.toFixed(2)),monthEarnings:Number(monthEarnings.toFixed(2))},updatedAt:row.updated_at});}return {members:result};
  }
  const match=path.match(/^\/api\/admin\/hrm\/members\/([a-f0-9-]{36})$/);
  if(match&&request.method==='PATCH'){
    const current=await db.prepare('SELECT * FROM member_hrm WHERE member_id=?').bind(match[1]).first();
    const profile=Object.hasOwn(raw,'profile')?raw.profile:await open(current?.profile_ciphertext,env,{}),terms=Object.hasOwn(raw,'terms')?raw.terms:await open(current?.terms_ciphertext,env,{});
    await db.prepare(`INSERT INTO member_hrm(member_id,profile_ciphertext,terms_ciphertext,updated_at) VALUES(?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET profile_ciphertext=excluded.profile_ciphertext,terms_ciphertext=excluded.terms_ciphertext,updated_at=excluded.updated_at`).bind(match[1],await seal(profile,env),await seal(terms,env),now()).run();
    await db.prepare('INSERT INTO hrm_audit(member_id,actor,action,created_at) VALUES(?,?,?,?)').bind(match[1],'owner','hrm_updated',now()).run();return {ok:true};
  }
  throw new OperationsError('Niet gevonden.',404);
}

async function staffHrm(request,env,db,path,member) {
  const raw=request.method==='GET'?{}:await body(request),current=await db.prepare('SELECT * FROM member_hrm WHERE member_id=?').bind(member.id).first();
  if(path==='/api/team/hrm/setup'&&request.method==='POST'){
    if(current?.pin_hash)throw new OperationsError('Je HRM-pincode is al ingesteld.',409);const pinHash=await createPinHash(raw.pin,env);
    await db.prepare(`INSERT INTO member_hrm(member_id,pin_hash,updated_at) VALUES(?,?,?) ON CONFLICT(member_id) DO UPDATE SET pin_hash=excluded.pin_hash,updated_at=excluded.updated_at`).bind(member.id,pinHash,now()).run();return {ok:true};
  }
  const pin=request.headers.get('X-HRM-PIN')||raw.pin||'';if(!current?.pin_hash)throw new OperationsError('Stel eerst je persoonlijke HRM-pincode in.',428);if(!await verifyPin(pin,current.pin_hash,env))throw new OperationsError('HRM-pincode onjuist.',403);
  if(path==='/api/team/hrm'&&request.method==='GET'){
    const profile=await open(current.profile_ciphertext,env,{}),terms=await open(current.terms_ciphertext,env,{});
    const totals=await db.prepare("SELECT COUNT(DISTINCT material_id) items,COALESCE(SUM(duration_seconds),0) seconds,COUNT(DISTINCT CASE WHEN started_at>=date('now','start of month') THEN material_id END) month_items,COALESCE(SUM(CASE WHEN started_at>=date('now','start of month') THEN duration_seconds ELSE 0 END),0) month_seconds FROM work_sessions WHERE member_id=? AND activity='maintenance' AND ended_at IS NOT NULL").bind(member.id).first();
    const hourly=Number(terms.hourlyRate)||0,itemRate=Number(terms.itemRate)||0,earnings=terms.payType==='item'?totals.items*itemRate:(totals.seconds/3600)*hourly,monthEarnings=terms.payType==='item'?totals.month_items*itemRate:(totals.month_seconds/3600)*hourly;
    return {profile,terms,totals:{...totals,earnings:Number(earnings.toFixed(2)),monthEarnings:Number(monthEarnings.toFixed(2))}};
  }
  if(path==='/api/team/hrm'&&request.method==='PATCH'){
    const profile={...(await open(current.profile_ciphertext,env,{})),...(raw.profile||{})};
    const allowed={phone:clean(profile.phone,40),email:clean(profile.email,160),address:clean(profile.address,240),iban:clean(profile.iban,40).toUpperCase()};
    await db.prepare('UPDATE member_hrm SET profile_ciphertext=?,updated_at=? WHERE member_id=?').bind(await seal(allowed,env),now(),member.id).run();
    await db.prepare('INSERT INTO hrm_audit(member_id,actor,action,created_at) VALUES(?,?,?,?)').bind(member.id,member.id,'own_profile_updated',now()).run();return {ok:true};
  }
  throw new OperationsError('Niet gevonden.',404);
}

export async function handleOperations(request,env,{owner,json,origin}) {
  const path=new URL(request.url).pathname,db=env.LATTENSPECIALIST_TEAM_DB;
  try {
    if(!db)throw new OperationsError('Bedrijfsdatabase niet beschikbaar.',503);
    if(path.startsWith('/api/admin/operations')||path.startsWith('/api/admin/hrm')){
      if(!owner)throw new OperationsError('Geen toegang tot beheer.',401);
      if(path.startsWith('/api/admin/hrm'))return json(await adminHrm(request,env,db,path),200,origin);
      if(path==='/api/admin/operations/dashboard'&&request.method==='GET')return json(await dashboard(db),200,origin);
      if(path==='/api/admin/operations/materials'&&request.method==='POST'){const raw=await body(request);return json({materials:await createMaterials(db,clean(raw.reference,30))},201,origin);}
      if(path==='/api/admin/operations/materials'&&request.method==='GET'){const reference=clean(new URL(request.url).searchParams.get('reference'),30);const rows=await db.prepare('SELECT * FROM materials WHERE reference=? ORDER BY item_number').bind(reference).all();return json({materials:rows.results.map(materialView)},200,origin);}
      const adminScan=path.match(/^\/api\/admin\/operations\/scan\/([a-f0-9]{48}|LSM-[A-F0-9]{6})$/i);
      if(adminScan&&request.method==='GET'){const key=adminScan[1],material=await db.prepare('SELECT * FROM materials WHERE scan_token=? OR display_code=?').bind(key.toLowerCase(),key.toUpperCase()).first();if(!material)throw new OperationsError('QR-code niet herkend.',404);const record=recordFromRow(await db.prepare('SELECT * FROM records WHERE reference=?').bind(material.reference).first());return json({material:materialView(material),record},200,origin);}
      const adminAction=path.match(/^\/api\/admin\/operations\/materials\/([a-f0-9-]{36})\/action$/);
      if(adminAction&&request.method==='POST'){const material=await db.prepare('SELECT * FROM materials WHERE id=?').bind(adminAction[1]).first();if(!material)throw new OperationsError('Materiaal niet gevonden.',404);const raw=await body(request),action=clean(raw.action,40);if(!['pickup_depart','receive','ready','delivery_depart','delivered'].includes(action))throw new OperationsError('Gebruik voor onderhoud de medewerkersapp.');return json({material:await workAction(db,material,action,{id:'owner',env})},200,origin);}
      if(path==='/api/admin/operations/routes'&&request.method==='POST')return json({route:await createRoute(db,await body(request))},201,origin);
      if(path==='/api/admin/operations/routes'&&request.method==='GET'){const rows=(await db.prepare('SELECT * FROM routes ORDER BY route_date DESC,created_at DESC LIMIT 50').all()).results;const routes=[];for(const route of rows)routes.push(await routeDetails(db,route.id));return json({routes},200,origin);}
      if(path==='/api/admin/operations/availability'&&request.method==='GET'){const rows=await db.prepare(`SELECT a.member_id,m.name,a.work_date,a.preference,a.start_time,a.end_time,a.note FROM member_availability a JOIN members m ON m.id=a.member_id WHERE a.work_date>=date('now') AND m.active=1 ORDER BY a.work_date,m.name`).all();return json({availability:rows.results},200,origin);}
      throw new OperationsError('Niet gevonden.',404);
    }
    if(path.startsWith('/api/team/operations')||path.startsWith('/api/team/hrm')){
      const member=await memberIdentity(request,db);
      if(path.startsWith('/api/team/hrm'))return json(await staffHrm(request,env,db,path,member),200,origin);
      if(path==='/api/team/operations/availability'&&request.method==='GET'){const rows=await db.prepare('SELECT work_date,preference,start_time,end_time,note FROM member_availability WHERE member_id=? AND work_date>=date(\'now\') ORDER BY work_date LIMIT 180').bind(member.id).all();return json({dates:rows.results},200,origin);}
      if(path==='/api/team/operations/availability'&&request.method==='PATCH'){
        const raw=await body(request),dates=Array.isArray(raw.dates)?raw.dates.slice(0,180):[],valid=[];
        for(const item of dates){
          if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||!['available','preferred','unavailable'].includes(item.preference))continue;
          let start=clean(item.startTime,5),end=clean(item.endTime,5),hasTimes=start||end;
          if(item.preference!=='unavailable'&&!hasTimes){start='09:00';end='17:00';hasTimes=true;}
          if(item.preference!=='unavailable'&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||end<=start))throw new OperationsError(`Controleer de beschikbaarheidstijden voor ${item.date}.`);
          if(item.preference==='unavailable'&&hasTimes&&!(/^([01]\d|2[0-3]):[0-5]\d$/.test(start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(end)&&end>start))throw new OperationsError(`Controleer de tijden voor ${item.date}.`);
          valid.push({...item,start:item.preference==='unavailable'?'':start,end:item.preference==='unavailable'?'':end});
        }
        await db.prepare('DELETE FROM member_availability WHERE member_id=? AND work_date>=date(\'now\')').bind(member.id).run();
        for(const item of valid)await db.prepare('INSERT INTO member_availability(member_id,work_date,preference,start_time,end_time,note,updated_at) VALUES(?,?,?,?,?,?,?)').bind(member.id,item.date,item.preference,item.start||null,item.end||null,clean(item.note,200),now()).run();
        return json({ok:true},200,origin);
      }
      if(path==='/api/team/operations/routes'&&request.method==='GET'){const rows=(await db.prepare('SELECT id FROM routes WHERE assigned_to=? ORDER BY route_date DESC LIMIT 20').bind(member.id).all()).results,routes=[];for(const row of rows)routes.push(await routeDetails(db,row.id));return json({routes},200,origin);}
      const routeAction=path.match(/^\/api\/team\/operations\/routes\/([a-f0-9-]{36})\/action$/);
      if(routeAction&&request.method==='POST'){
        const route=await db.prepare('SELECT * FROM routes WHERE id=? AND assigned_to=?').bind(routeAction[1],member.id).first();if(!route)throw new OperationsError('Route niet gevonden.',404);const raw=await body(request),action=clean(raw.action,30),timestamp=now();
        if(action==='start'){await db.batch([db.prepare("UPDATE routes SET status='active',started_at=COALESCE(started_at,?) WHERE id=?").bind(timestamp,route.id),db.prepare("INSERT INTO work_sessions(id,member_id,activity,started_at) SELECT ?,?,'pickup',? WHERE NOT EXISTS(SELECT 1 FROM work_sessions WHERE member_id=? AND activity='pickup' AND ended_at IS NULL)").bind(crypto.randomUUID(),member.id,timestamp,member.id)]);}
        else if(action==='finish'){await db.batch([db.prepare("UPDATE routes SET status='completed',ended_at=? WHERE id=?").bind(timestamp,route.id),db.prepare("UPDATE work_sessions SET ended_at=?1,duration_seconds=MAX(1,CAST((julianday(?1)-julianday(started_at))*86400 AS INTEGER)) WHERE member_id=?2 AND activity='pickup' AND ended_at IS NULL").bind(timestamp,member.id)]);}
        else if(['arrive','depart'].includes(action)){const stopId=clean(raw.stopId,40),column=action==='arrive'?'arrived_at':'departed_at',status=action==='arrive'?'arrived':'collected';await db.prepare(`UPDATE route_stops SET ${column}=?,status=? WHERE id=? AND route_id=?`).bind(timestamp,status,stopId,route.id).run();}
        else throw new OperationsError('Onbekende routeactie.');return json({route:await routeDetails(db,route.id)},200,origin);
      }
      const scan=path.match(/^\/api\/team\/operations\/scan\/([a-f0-9]{48}|LSM-[A-F0-9]{6})$/i);
      if(scan&&request.method==='GET'){const key=scan[1],material=await db.prepare('SELECT * FROM materials WHERE scan_token=? OR display_code=?').bind(key.toLowerCase(),key.toUpperCase()).first();if(!material)throw new OperationsError('QR-code niet herkend.',404);const record=recordFromRow(await db.prepare('SELECT * FROM records WHERE reference=?').bind(material.reference).first());return json({material:materialView(material),work:{customerName:clean(record?.name,100),address:clean(record?.address,240),conditions:clean(record?.conditions,100),notes:clean(record?.notes,500),package:clean(record?.package,100),waxType:clean(material.wax_type||record?.waxType||'',100)}},200,origin);}
      const action=path.match(/^\/api\/team\/operations\/materials\/([a-f0-9-]{36})\/action$/);
      if(action&&request.method==='POST'){const material=await db.prepare('SELECT * FROM materials WHERE id=?').bind(action[1]).first();if(!material)throw new OperationsError('Materiaal niet gevonden.',404);const raw=await body(request);return json({material:await workAction(db,material,clean(raw.action,40),{...member,env})},200,origin);}
      throw new OperationsError('Niet gevonden.',404);
    }
    const feedback=path.match(/^\/api\/feedback\/(LS-[A-Z2-9]{6})$/);
    if(feedback&&request.method==='POST'){const record=await db.prepare("SELECT reference,payload FROM records WHERE json_extract(payload,'$.serviceCode')=?").bind(feedback[1]).first();if(!record)throw new OperationsError('Onderhoudscode niet gevonden.',404);const raw=await body(request),score=name=>raw[name]==null||raw[name]===''?null:Math.max(1,Math.min(5,Number(raw[name])));if(!Number.isInteger(score('overall')))throw new OperationsError('Geef een beoordeling van 1 tot 5.');await db.prepare(`INSERT INTO customer_feedback(reference,overall,quality,communication,pickup,speed,comment,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(reference) DO UPDATE SET overall=excluded.overall,quality=excluded.quality,communication=excluded.communication,pickup=excluded.pickup,speed=excluded.speed,comment=excluded.comment,created_at=excluded.created_at`).bind(record.reference,score('overall'),score('quality'),score('communication'),score('pickup'),score('speed'),clean(raw.comment,1000),now()).run();return json({ok:true},201,origin);}
    throw new OperationsError('Niet gevonden.',404);
  } catch(error){return json({message:error instanceof OperationsError?error.message:'Deze functie is tijdelijk niet beschikbaar.'},error instanceof OperationsError?error.status:503,origin);}
}
