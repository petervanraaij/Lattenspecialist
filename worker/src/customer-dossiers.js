import {ensurePhotos} from './material-photos.js';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
function text(v,n,required=false){if(typeof v!=='string'||v.length>n||required&&!v.trim())throw Error('Controleer de ingevulde klant- en materiaalgegevens.');return v.trim();}
async function schema(db){for(const query of [
`CREATE TABLE IF NOT EXISTS workshop_customers(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS workshop_assets(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES workshop_customers(id),kind TEXT NOT NULL,brand TEXT NOT NULL,model TEXT NOT NULL,serial TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS workshop_material_links(material_id TEXT PRIMARY KEY REFERENCES materials(id),asset_id TEXT NOT NULL REFERENCES workshop_assets(id),linked_at TEXT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS workshop_assets_customer ON workshop_assets(customer_id)`,
`CREATE INDEX IF NOT EXISTS workshop_links_asset ON workshop_material_links(asset_id)`])await db.prepare(query).run();}
// A phone number identifies a workshop dossier, never an account or access right.
const separators = [' ', '-', '(', ')', '.'];
const compactPhone = separators.reduce((sql, char) => "replace("+sql+",'"+char+"','')", 'phone');
const phoneKey = `CASE WHEN substr(${compactPhone},1,6)='003106' THEN substr(${compactPhone},5)
 WHEN substr(${compactPhone},1,5)='00316' THEN '0'||substr(${compactPhone},5)
 WHEN substr(${compactPhone},1,4)='+310' THEN substr(${compactPhone},4)
 WHEN substr(${compactPhone},1,3)='+31' THEN '0'||substr(${compactPhone},4)
 ELSE ${compactPhone} END`;
export function mobileKey(value) {
 const compact=separators.reduce((number,char)=>number.replaceAll(char,''),String(value??'').trim());
 const key=compact.replace(/^(?:0031|\+31)0?(?=6)/,'0');
 return /^06[0-9]{8}$/.test(key)?key:null;
}
async function requestLinkSchema(db){
 await schema(db);
 await db.prepare(`CREATE TABLE IF NOT EXISTS workshop_request_customers(
  reference TEXT PRIMARY KEY REFERENCES records(reference), customer_id TEXT NOT NULL REFERENCES workshop_customers(id))`).run();
 await db.prepare(`CREATE INDEX IF NOT EXISTS workshop_request_customer ON workshop_request_customers(customer_id)`).run();
 await db.prepare(`CREATE INDEX IF NOT EXISTS workshop_customer_phone ON workshop_customers(${phoneKey})`).run();
}
export async function requestCustomerStatements(db, record) {
 const key=mobileKey(record.phone);
 if(!key||record.service!=='Onderhoud'||record.deletedAt||record.purgedAt||!record.name?.trim())return [];
 await requestLinkSchema(db);
 const available=`EXISTS(SELECT 1 FROM records WHERE reference=?1
   AND json_extract(payload,'$.deletedAt') IS NULL AND json_extract(payload,'$.purgedAt') IS NULL)
   AND NOT EXISTS(SELECT 1 FROM workshop_request_customers WHERE reference=?1)`;
 return [
  db.prepare(`INSERT INTO workshop_customers(id,name,email,phone,notes,created_at,updated_at)
   SELECT ?3,?4,?5,?2,'',?6,?6 WHERE ${available}
   AND NOT EXISTS(SELECT 1 FROM workshop_customers WHERE (${phoneKey})=?2)`)
   .bind(record.reference,key,crypto.randomUUID(),record.name,record.email||'',new Date().toISOString()),
  db.prepare(`INSERT INTO workshop_request_customers(reference,customer_id)
   SELECT ?1,MIN(id) FROM workshop_customers WHERE (${phoneKey})=?2 AND ${available}
   HAVING COUNT(*)=1`).bind(record.reference,key)
 ];
}
export async function customerDossiers(request,db,{json,origin,ErrorType}){
 await requestLinkSchema(db);await ensurePhotos(db);const url=new URL(request.url),path=url.pathname,base='/api/admin/operations/customers';let raw;
 if(['POST','PUT'].includes(request.method)){const content=await request.text();if(content.length>12000)throw new ErrorType('Te veel gegevens.',413);try{raw=JSON.parse(content);if(!raw||Array.isArray(raw)||typeof raw!=='object')throw Error();}catch{throw new ErrorType('Ongeldige gegevens.',400);}}
 try{
 if(path===base&&request.method==='GET'){const q=(url.searchParams.get('q')||'').trim().slice(0,100).toLowerCase();const customers=(await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM workshop_assets a WHERE a.customer_id=c.id) assetCount FROM workshop_customers c WHERE instr(lower(c.name||' '||c.email||' '||c.phone),?)>0 OR (${phoneKey})=? ORDER BY c.name LIMIT 100`).bind(q,mobileKey(q)).all()).results;return json({customers},200,origin);}
 const customer=path.match(/^\/api\/admin\/operations\/customers\/([a-f0-9-]{36})$/);
 if((path===base&&request.method==='POST')||(customer&&request.method==='PUT')){const id=customer?.[1]||crypto.randomUUID(),stamp=new Date().toISOString();if(customer&&!await db.prepare('SELECT id FROM workshop_customers WHERE id=?').bind(id).first())throw new ErrorType('Klant niet gevonden.',404);await db.prepare(`INSERT INTO workshop_customers(id,name,email,phone,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,notes=excluded.notes,updated_at=excluded.updated_at`).bind(id,text(raw.name,200,true),text(raw.email||'',254),text(raw.phone||'',60),text(raw.notes||'',2000),stamp,stamp).run();return json({id},customer?200:201,origin);}
 if(customer&&request.method==='GET'){const c=await db.prepare('SELECT * FROM workshop_customers WHERE id=?').bind(customer[1]).first();if(!c)throw new ErrorType('Klant niet gevonden.',404);const assets=(await db.prepare('SELECT * FROM workshop_assets WHERE customer_id=? ORDER BY created_at,id').bind(c.id).all()).results;for(const asset of assets){const materials=(await db.prepare(`SELECT m.id,m.reference,m.display_code,m.kind,m.package_name,m.wax_type,m.internal_status,m.created_at,m.ready_at FROM materials m JOIN workshop_material_links l ON l.material_id=m.id WHERE l.asset_id=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 100`).bind(asset.id).all()).results;for(const m of materials){m.photos=(await db.prepare('SELECT id,stage,note,created_at FROM material_photos WHERE material_id=? ORDER BY created_at,id LIMIT 40').bind(m.id).all()).results;m.steps=(await db.prepare('SELECT title,status,step_code,completed_at FROM maintenance_steps WHERE material_id=? ORDER BY step_order').bind(m.id).all()).results;m.usage=(await db.prepare(`SELECT u.sku,i.name,u.quantity,u.unit,s.step_code,s.title FROM maintenance_usage u JOIN inventory_items i ON i.sku=u.sku JOIN maintenance_steps s ON s.id=u.step_id WHERE u.material_id=? ORDER BY u.created_at,u.rowid`).bind(m.id).all()).results;}asset.history=materials;}const requests=(await db.prepare(`SELECT r.reference,json_extract(r.payload,'$.createdAt') createdAt,
 json_extract(r.payload,'$.serviceCode') serviceCode FROM workshop_request_customers l JOIN records r ON r.reference=l.reference
 WHERE l.customer_id=? AND json_extract(r.payload,'$.deletedAt') IS NULL AND json_extract(r.payload,'$.purgedAt') IS NULL
 ORDER BY createdAt DESC LIMIT 100`).bind(c.id).all()).results;return json({customer:c,assets,requests},200,origin);}
 const assets=path.match(/^\/api\/admin\/operations\/customers\/([a-f0-9-]{36})\/assets$/);
 if(assets&&request.method==='POST'){if(!await db.prepare('SELECT id FROM workshop_customers WHERE id=?').bind(assets[1]).first())throw new ErrorType('Klant niet gevonden.',404);const id=crypto.randomUUID(),stamp=new Date().toISOString(),kind=text(raw.kind,30,true);if(!['Ski','Snowboard'].includes(kind))throw Error('Kies ski’s of snowboard.');await db.prepare('INSERT INTO workshop_assets(id,customer_id,kind,brand,model,serial,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,assets[1],kind,text(raw.brand||'',150),text(raw.model||'',150),text(raw.serial||'',150),text(raw.notes||'',2000),stamp,stamp).run();return json({id},201,origin);}
 const material=path.match(/^\/api\/admin\/operations\/materials\/([a-f0-9-]{36})\/dossier$/);
 if(material){const m=await db.prepare('SELECT * FROM materials WHERE id=?').bind(material[1]).first();if(!m||m.is_training)throw new ErrorType('Onderhoudsmateriaal niet gevonden.',404);if(request.method==='GET'){const link=await db.prepare('SELECT a.*,c.name customerName FROM workshop_material_links l JOIN workshop_assets a ON a.id=l.asset_id JOIN workshop_customers c ON c.id=a.customer_id WHERE l.material_id=?').bind(m.id).first();const record=await db.prepare('SELECT payload FROM records WHERE reference=?').bind(m.reference).first();const r=record?JSON.parse(record.payload):{};const suggested=await db.prepare('SELECT c.id,c.name,c.email FROM workshop_request_customers l JOIN workshop_customers c ON c.id=l.customer_id WHERE l.reference=?').bind(m.reference).first();return json({material:{id:m.id,kind:m.kind,reference:m.reference},link:link||null,suggestedCustomer:suggested,suggestion:{name:r.name||'',email:r.email||'',phone:r.phone||''}},200,origin);}if(request.method==='PUT'){if(!uuid(raw.assetId))throw Error('Kies het juiste materiaal uit het klantdossier.');const a=await db.prepare('SELECT * FROM workshop_assets WHERE id=?').bind(raw.assetId).first();if(!a)throw new ErrorType('Materiaal in klantdossier niet gevonden.',404);if(a.kind!==m.kind)throw Error('Het materiaaltype komt niet overeen met deze opdracht.');const old=await db.prepare('SELECT asset_id FROM workshop_material_links WHERE material_id=?').bind(m.id).first(),stamp=new Date().toISOString();await db.batch([db.prepare('INSERT INTO workshop_material_links(material_id,asset_id,linked_at) VALUES(?,?,?) ON CONFLICT(material_id) DO UPDATE SET asset_id=excluded.asset_id,linked_at=excluded.linked_at').bind(m.id,a.id,stamp),db.prepare("INSERT INTO material_events(material_id,actor,event_type,detail,created_at) VALUES(?,'owner','customer_asset_linked',?,?)").bind(m.id,JSON.stringify({previousAssetId:old?.asset_id||null,assetId:a.id,customerId:a.customer_id}),stamp)]);return json({linked:true,customerId:a.customer_id,assetId:a.id},200,origin);}}
 throw new ErrorType('Niet gevonden.',404);
 }catch(error){if(error instanceof ErrorType)throw error;throw new ErrorType(error.message?.startsWith('Controleer')||error.message?.startsWith('Kies')||error.message?.startsWith('Het materiaaltype')?error.message:'Klantdossier kon niet worden bijgewerkt.',400);}
}
