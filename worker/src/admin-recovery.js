import {createAdminAccessHash} from './operations.js';

const generic = 'Als dit het ingestelde hersteladres is, ontvang je een e-mail met een tijdelijke herstellink. Controleer ook je spammap. Een nieuwe link aanvragen kan na twee minuten.';
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2,'0')).join('');
const activeHash = async db => (await db.prepare("SELECT setting_value FROM hrm_settings WHERE setting_key='admin_access_hash'").first())?.setting_value || '';
const version = (stored, env) => digest(JSON.stringify([stored,env.LATTENSPECIALIST_ADMIN_TOKEN || '']));
const reply = (value,status,origin) => Response.json(value,{status,headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});

export async function handleAdminRecovery(request,env,origin) {
  const db=env.LATTENSPECIALIST_TEAM_DB, path=new URL(request.url).pathname;
  if(request.method!=='POST')return reply({message:'Niet toegestaan.'},405,origin);
  if(!db || !env.HRM_DATA_KEY || !env.LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL || !env.RESEND_API_KEY)return reply({message:'Wachtwoordherstel is tijdelijk niet beschikbaar. Neem contact op met de eigenaar.'},503,origin);
  try {
    // Limit streamed/chunked requests as well as requests with Content-Length.
    if(Number(request.headers.get('Content-Length'))>2048)return reply({message:'Te veel gegevens.'},413,origin);
    const text=await request.text();
    if(new TextEncoder().encode(text).length>2048)return reply({message:'Te veel gegevens.'},413,origin);
    let raw;try{raw=JSON.parse(text);}catch{return reply({message:'Ongeldige gegevens.'},400,origin);}
    if(!raw || typeof raw!=='object' || Array.isArray(raw))return reply({message:'Ongeldige gegevens.'},400,origin);
    const now=Date.now();
    if(path==='/api/admin/recovery/request') {
      const email=String(raw.email||'').trim().toLowerCase();
      const destination=String(env.LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL).trim().toLowerCase();
      if(email!==destination)return reply({ok:true,message:generic},200,origin);
      // One fixed, server-configured recipient. Never accept recipient, origin or redirect URLs from the request.
      const day=new Date(now).toISOString().slice(0,10);
      const limited=await db.prepare(`INSERT INTO admin_recovery_rate(id,requested_at,day,attempts) VALUES(1,?,?,1)
        ON CONFLICT(id) DO UPDATE SET requested_at=excluded.requested_at,day=excluded.day,
        attempts=CASE WHEN admin_recovery_rate.day=excluded.day THEN admin_recovery_rate.attempts+1 ELSE 1 END
        WHERE admin_recovery_rate.requested_at<=? AND (admin_recovery_rate.day<>excluded.day OR admin_recovery_rate.attempts<8)`)
        .bind(now,day,now-120000).run();
      if(!limited.meta.changes)return reply({ok:true,message:generic},200,origin);
      const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
      const tokenHash=await digest(token),stored=await activeHash(db);
      await db.prepare('DELETE FROM admin_recovery_tokens WHERE expires_at<? OR consumed_at IS NOT NULL').bind(now).run();
      await db.prepare('INSERT INTO admin_recovery_tokens(token_hash,credential_version,expires_at) VALUES(?,?,?)').bind(tokenHash,await version(stored,env),now+1200000).run();
      // Fragment stays out of HTTP requests, referrers and server access logs.
      const link=`https://lattenspecialist.nl/beheer-herstellen.html#token=${token}`;
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({
        from:env.LATTENSPECIALIST_FROM_EMAIL || 'De Lattenspecialist via Stuiterbaas <reserveringen@stuiterbaas.nl>',to:[destination],subject:'Beheercode herstellen · De Lattenspecialist',
        text:`Er is gevraagd je beheercode te herstellen.\n\nStel zelf een nieuwe code in via:\n${link}\n\nDe link is 20 minuten geldig en kan één keer worden gebruikt. Na de wijziging werkt je oude beheercode niet meer, ook niet in de Beheer-app.\n\nHeb je dit niet aangevraagd? Dan hoef je niets te doen; je bestaande code blijft geldig.\n\nDe Lattenspecialist`
      })});
      if(!response.ok){await db.prepare('DELETE FROM admin_recovery_tokens WHERE token_hash=?').bind(tokenHash).run();throw new Error('delivery');}
      return reply({ok:true,message:generic},200,origin);
    }
    if(path!=='/api/admin/recovery/complete')return reply({message:'Niet gevonden.'},404,origin);
    const token=String(raw.token||''),code=String(raw.code||'');
    if(!/^[a-f0-9]{64}$/.test(token))return reply({message:'Deze herstellink is ongeldig of verlopen. Vraag een nieuwe link aan.'},400,origin);
    if(code!==code.trim() || code.length<12 || code.length>128)return reply({message:'Gebruik 12 tot 128 tekens, zonder spaties aan het begin of einde.'},400,origin);
    const tokenHash=await digest(token),row=await db.prepare('SELECT * FROM admin_recovery_tokens WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').bind(tokenHash,now).first();
    const stored=await activeHash(db);
    if(!row || row.credential_version!==await version(stored,env))return reply({message:'Deze herstellink is ongeldig of verlopen. Vraag een nieuwe link aan.'},400,origin);
    const next=await createAdminAccessHash(code,env);
    // D1 batch is transactional; compare-and-swap prevents two links from concurrently changing access.
    const result=await db.batch([
      db.prepare(`INSERT INTO hrm_settings(setting_key,setting_value,updated_at)
        SELECT 'admin_access_hash',?,? WHERE EXISTS(SELECT 1 FROM admin_recovery_tokens WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?)
        AND COALESCE((SELECT setting_value FROM hrm_settings WHERE setting_key='admin_access_hash'),'')=?
        ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at`)
        .bind(next,new Date(now).toISOString(),tokenHash,now,stored),
      db.prepare(`UPDATE admin_recovery_tokens SET consumed_at=? WHERE consumed_at IS NULL AND EXISTS
        (SELECT 1 FROM hrm_settings WHERE setting_key='admin_access_hash' AND setting_value=?)`).bind(now,next),
      db.prepare(`INSERT INTO hrm_audit(member_id,actor,action,created_at) SELECT NULL,'owner-email-recovery','admin_access_recovered',?
        WHERE EXISTS(SELECT 1 FROM admin_recovery_tokens WHERE token_hash=? AND consumed_at=?)`).bind(new Date(now).toISOString(),tokenHash,now)
    ]);
    if(!result[0].meta.changes)return reply({message:'Deze herstellink is al gebruikt of verlopen. Vraag een nieuwe link aan.'},400,origin);
    return reply({ok:true,message:'Je beheercode is gewijzigd. Log opnieuw in op de website en in de Beheer-app met je nieuwe code.'},200,origin);
  }catch{
    // Never log tokens, codes, message bodies or provider responses.
    return reply({message:'Herstellen is tijdelijk niet gelukt. Probeer het later opnieuw.'},503,origin);
  }
}
