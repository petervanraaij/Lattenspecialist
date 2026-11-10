const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const url64=value=>b64(typeof value==='string'?encoder.encode(value):value).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const pushConfigured=env=>Boolean(env.FCM_PROJECT_ID&&env.FCM_SERVICE_ACCOUNT_JSON&&env.HRM_DATA_KEY);
const epoch=async(env,db)=>hash(JSON.stringify([env.LATTENSPECIALIST_ADMIN_TOKEN||'',(await db.prepare("SELECT setting_value FROM hrm_settings WHERE setting_key='admin_access_hash'").first())?.setting_value||'']));
async function cryptKey(env){const bytes=unb64(env.HRM_DATA_KEY);if(bytes.length!==32)throw new Error('configuration');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
async function seal(token,env){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('lattenspecialist-admin-push')},await cryptKey(env),encoder.encode(token)));return b64(new Uint8Array([...iv,...cipher]));}
async function open(value,env){const bytes=unb64(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:encoder.encode('lattenspecialist-admin-push')},await cryptKey(env),bytes.slice(12)));}
let oauthCache;
async function accessToken(env){
  const account=JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON),stamp=await hash(env.FCM_SERVICE_ACCOUNT_JSON);
  if(account.project_id!==env.FCM_PROJECT_ID||!account.client_email?.endsWith('.iam.gserviceaccount.com'))throw new Error('configuration');
  if(oauthCache?.stamp===stamp&&oauthCache.until>Date.now()+60000)return oauthCache.token;
  const now=Math.floor(Date.now()/1000),head=url64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=url64(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const key=await crypto.subtle.importKey('pkcs8',unb64(account.private_key.replace(/-----[^-]+-----|\s/g,'')),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=url64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(head+'.'+claim)));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+claim+'.'+signature}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('authorization');const value=await response.json();if(!value.access_token)throw new Error('authorization');
  oauthCache={stamp,token:value.access_token,until:Date.now()+Math.min(3600,Number(value.expires_in)||3600)*1000};return oauthCache.token;
}
export async function queueReservationPush(data,reference,env,ctx){
  if(data.service!=='Onderhoud'||!pushConfigured(env)||!env.LATTENSPECIALIST_TEAM_DB)return;
  try{
    const db=env.LATTENSPECIALIST_TEAM_DB,now=Date.now(),current=await epoch(env,db),event='reservation:'+reference;
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO admin_push_events(id,reference,created_at) VALUES(?,?,?)').bind(event,reference,now),
      db.prepare(`INSERT OR IGNORE INTO admin_push_deliveries(event_id,device_id) SELECT ?,id FROM admin_push_devices
        WHERE changes()>0 AND enabled=1 AND credential_version=? AND registered_at>?`).bind(event,current,now-30*86400000)
    ]);
    const send=deliverPushOutbox(env).catch(()=>console.error('Push delivery deferred; reservation remains saved.'));
    if(ctx?.waitUntil)ctx.waitUntil(send);else await send;
  }catch{console.error('Push queue unavailable; reservation remains saved.');}
}
export async function deliverPushOutbox(env){
  if(!pushConfigured(env)||!env.LATTENSPECIALIST_TEAM_DB)return;
  const db=env.LATTENSPECIALIST_TEAM_DB,now=Date.now(),current=await epoch(env,db);
  await db.prepare("UPDATE admin_push_devices SET enabled=0,token_ciphertext='',token_hash='' WHERE enabled=1 AND (credential_version<>? OR registered_at<?)").bind(current,now-30*86400000).run();
  const rows=(await db.prepare(`SELECT d.*,p.token_ciphertext,p.enabled,p.credential_version,p.registered_at,e.reference,e.created_at
    FROM admin_push_deliveries d JOIN admin_push_devices p ON p.id=d.device_id JOIN admin_push_events e ON e.id=d.event_id
    WHERE d.attempts<5 AND ((d.state IN ('pending','retry') AND d.next_at<=?) OR (d.state='sending' AND d.lease_until<?))
    ORDER BY e.created_at LIMIT 20`).bind(now,now).all()).results;
  for(const row of rows){
    if(!row.enabled||row.credential_version!==current||row.registered_at<now-30*86400000||row.created_at<now-86400000){await db.prepare("UPDATE admin_push_deliveries SET state='cancelled' WHERE event_id=? AND device_id=?").bind(row.event_id,row.device_id).run();continue;}
    const claim=await db.prepare(`UPDATE admin_push_deliveries SET state='sending',attempts=attempts+1,lease_until=? WHERE event_id=? AND device_id=? AND
      ((state IN ('pending','retry') AND next_at<=?) OR (state='sending' AND lease_until<?))`).bind(now+60000,row.event_id,row.device_id,now,now).run();
    if(!claim.meta.changes)continue;
    try{
      const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FCM_PROJECT_ID)}/messages:send`,{
        method:'POST',headers:{Authorization:'Bearer '+await accessToken(env),'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
        body:JSON.stringify({message:{token:await open(row.token_ciphertext,env),android:{priority:'HIGH',ttl:'300s',collapse_key:'maintenance_requests'},
          data:{type:'maintenance_request',eventId:row.event_id,reference:row.reference}}})});
      if(response.ok){await db.batch([db.prepare("UPDATE admin_push_deliveries SET state='accepted',accepted_at=? WHERE event_id=? AND device_id=?").bind(Date.now(),row.event_id,row.device_id),db.prepare('UPDATE admin_push_devices SET last_sent_at=? WHERE id=?').bind(Date.now(),row.device_id)]);}
      else{
        let problem={};try{problem=await response.json();}catch{}
        const invalid=problem.error?.details?.some(item=>item.errorCode==='UNREGISTERED');
        if(invalid){await db.batch([db.prepare("UPDATE admin_push_devices SET enabled=0,token_ciphertext='',token_hash='' WHERE id=?").bind(row.device_id),db.prepare("UPDATE admin_push_deliveries SET state='invalid_device' WHERE event_id=? AND device_id=?").bind(row.event_id,row.device_id)]);}
        else throw new Error('provider');
      }
    }catch{await db.prepare("UPDATE admin_push_deliveries SET state=?,next_at=? WHERE event_id=? AND device_id=?").bind(row.attempts>=4?'failed':'retry',Date.now()+Math.min(3600000,60000*2**row.attempts),row.event_id,row.device_id).run();}
  }
  await db.prepare('DELETE FROM admin_push_deliveries WHERE event_id IN (SELECT id FROM admin_push_events WHERE created_at<?)').bind(now-30*86400000).run();
  await db.prepare('DELETE FROM admin_push_events WHERE created_at<?').bind(now-30*86400000).run();
}
export async function handleAdminPush(request,env,{owner,json,origin}){
  if(!owner)return json({message:'Log opnieuw in op Beheer.'},401,origin);
  const db=env.LATTENSPECIALIST_TEAM_DB;if(!db)return json({message:'Pushopslag niet beschikbaar.'},503,origin);
  const path=new URL(request.url).pathname;
  try{
    if(path==='/api/admin/push/status'&&request.method==='GET'){
      const current=await epoch(env,db),devices=(await db.prepare('SELECT id,registered_at,last_received_at,last_sent_at FROM admin_push_devices WHERE enabled=1 AND credential_version=? AND registered_at>?').bind(current,Date.now()-30*86400000).all()).results;
      return json({configured:pushConfigured(env),devices},200,origin);
    }
    if(request.method!=='POST')return json({message:'Niet toegestaan.'},405,origin);
    const text=await request.text();if(encoder.encode(text).length>7000)return json({message:'Te veel gegevens.'},413,origin);
    const raw=JSON.parse(text),id=String(raw.deviceId||'');
    if(!/^[a-f0-9-]{36}$/.test(id))return json({message:'Ongeldig toestel.'},400,origin);
    if(path==='/api/admin/push/unregister'){
      await db.prepare("UPDATE admin_push_devices SET enabled=0,token_ciphertext='',token_hash='' WHERE id=?").bind(id).run();return json({ok:true},200,origin);
    }
    if(path==='/api/admin/push/received'){
      await db.prepare('UPDATE admin_push_devices SET last_received_at=? WHERE id=? AND enabled=1 AND credential_version=?').bind(Date.now(),id,await epoch(env,db)).run();return json({ok:true},200,origin);
    }
    if(path!=='/api/admin/push/register')return json({message:'Niet gevonden.'},404,origin);
    if(!pushConfigured(env))return json({message:'Directe pushmeldingen zijn nog niet geactiveerd.'},503,origin);
    const token=String(raw.token||''),generation=Number(raw.generation);
    if(!/^[A-Za-z0-9:_.-]{20,4096}$/.test(token)||!Number.isSafeInteger(generation)||generation<1)return json({message:'Ongeldige toestelregistratie.'},400,origin);
    const current=await epoch(env,db);
    const count=await db.prepare('SELECT COUNT(*) AS n FROM admin_push_devices WHERE enabled=1 AND credential_version=? AND id<>?').bind(current,id).first();
    if(count.n>=20)return json({message:'Er zijn al twintig toestellen gekoppeld.'},409,origin);
    const tokenHash=await hash(token);
    await db.batch([
      db.prepare(`UPDATE admin_push_devices SET enabled=0 WHERE token_hash=? AND id<>?
        AND NOT EXISTS(SELECT 1 FROM admin_push_devices WHERE id=? AND generation>?)`).bind(tokenHash,id,id,generation),
      db.prepare(`INSERT INTO admin_push_devices(id,token_hash,token_ciphertext,credential_version,generation,registered_at) VALUES(?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,token_ciphertext=excluded.token_ciphertext,credential_version=excluded.credential_version,
       generation=excluded.generation,registered_at=excluded.registered_at,enabled=1 WHERE excluded.generation>=admin_push_devices.generation`)
       .bind(id,tokenHash,await seal(token,env),current,generation,Date.now())
    ]);
    return json({ok:true},200,origin);
  }catch{return json({message:'Pushkoppeling tijdelijk niet beschikbaar.'},503,origin);}
}
