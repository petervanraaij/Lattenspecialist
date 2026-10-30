const LIMIT=750*1024;
export async function ensurePhotos(db){await db.prepare(`CREATE TABLE IF NOT EXISTS material_photos(id TEXT PRIMARY KEY,material_id TEXT NOT NULL REFERENCES materials(id),request_id TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('intake','delivery')),note TEXT NOT NULL,storage_key TEXT NOT NULL,sha256 TEXT NOT NULL,byte_size INTEGER NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(material_id,request_id))`).run();}
// Strip metadata (including EXIF/GPS) and reject oversized or malformed JPEGs.
export function cleanJpeg(bytes,ErrorType){
 if(bytes.length<20||bytes.length>LIMIT||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new ErrorType('Kies een geldige JPEG-foto van maximaal 750 KB.',400);
 const parts=[bytes.slice(0,2)];let p=2,dimensions=false,segments=0;
 while(p<bytes.length-2){if(++segments>256)throw new ErrorType('Ongeldige foto.',400);if(bytes[p]!==255)throw new ErrorType('Ongeldige foto.',400);const marker=bytes[p+1],length=(bytes[p+2]<<8)|bytes[p+3];if(length<2||p+2+length>bytes.length)throw new ErrorType('Ongeldige foto.',400);
  if([192,193,194].includes(marker)){const height=(bytes[p+5]<<8)|bytes[p+6],width=(bytes[p+7]<<8)|bytes[p+8];if(!width||!height||width>4096||height>4096)throw new ErrorType('De foto is te groot.',400);dimensions=true;}
  if(marker===218){if(!dimensions)throw new ErrorType('Fotoafmetingen ontbreken.',400);parts.push(bytes.slice(p));const result=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
  if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(bytes.slice(p,p+2+length));p+=2+length;
 }
 throw new ErrorType('Ongeldige foto.',400);
}
async function body(request,ErrorType){const reader=request.body?.getReader();if(!reader)throw new ErrorType('Foto ontbreekt.',400);let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1100000){await reader.cancel();throw new ErrorType('De foto is te groot.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}try{const parsed=JSON.parse(new TextDecoder().decode(bytes));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error();return parsed;}catch{throw new ErrorType('Ongeldige fotogegevens.',400);}}
export async function materialPhotos(request,env,{db,materialId,photoId,member,owner,json,origin,ErrorType}){
 const material=await db.prepare('SELECT * FROM materials WHERE id=?').bind(materialId).first();if(!material)throw new ErrorType('Materiaal niet gevonden.',404);
 if(!owner&&material.assigned_to&&material.assigned_to!==member.id)throw new ErrorType('Geen toegang tot dit materiaal.',403);
 if(material.is_training)throw new ErrorType('Foto’s horen bij een echte onderhoudsopdracht.',400);
 await ensurePhotos(db);const storage=env.LATTENSPECIALIST_RESERVATIONS_KV;if(!storage)throw new ErrorType('Foto-opslag is niet beschikbaar.',503);
 if(photoId&&request.method==='GET'){
  const photo=await db.prepare('SELECT * FROM material_photos WHERE id=? AND material_id=?').bind(photoId,materialId).first();if(!photo)throw new ErrorType('Foto niet gevonden.',404);
  const data=await storage.get(photo.storage_key,'arrayBuffer');if(!data)throw new ErrorType('Foto wordt nog beschikbaar gemaakt. Probeer opnieuw.',503);
  return new Response(data,{headers:{'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="materiaal-foto.jpg"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':origin,'Vary':'Origin'}});
 }
 if(!photoId&&request.method==='GET')return json({photos:(await db.prepare('SELECT p.id,p.stage,p.note,p.byte_size AS bytes,p.created_at AS createdAt,m.name AS addedBy FROM material_photos p LEFT JOIN members m ON m.id=p.actor WHERE p.material_id=? ORDER BY p.created_at,p.id LIMIT 40').bind(materialId).all()).results},200,origin);
 if(photoId||request.method!=='POST'||owner)throw new ErrorType('Niet toegestaan.',405);
 const raw=await body(request,ErrorType);if(!['intake','delivery'].includes(raw.stage)||!String(raw.requestId||'').match(/^[a-f0-9-]{36}$/)||typeof raw.image!=='string'||raw.image.length>1024000||typeof raw.note!=='string'||raw.note.length>500)throw new ErrorType('Controleer foto, fase en toelichting.',400);
 let bytes;try{bytes=cleanJpeg(Uint8Array.from(atob(raw.image),c=>c.charCodeAt(0)),ErrorType);}catch(error){if(error instanceof ErrorType)throw error;throw new ErrorType('Ongeldige foto.',400);}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const existing=await db.prepare('SELECT * FROM material_photos WHERE material_id=? AND request_id=?').bind(materialId,raw.requestId).first();
 const matches=p=>p.sha256===digest&&p.stage===raw.stage&&p.note===raw.note;
 if(existing){if(!matches(existing))throw new ErrorType('Deze upload is al met andere gegevens opgeslagen.',409);return json({id:existing.id,saved:true},200,origin);}
 const count=await db.prepare('SELECT COUNT(*) amount FROM material_photos WHERE material_id=?').bind(materialId).first();if(Number(count.amount)>=40)throw new ErrorType('Er zijn al 40 foto’s bij dit materiaal.',409);
 const id=crypto.randomUUID(),key=`material-photo:${materialId}:${id}`,created=new Date().toISOString();await storage.put(key,bytes);
 try{await db.batch([db.prepare('INSERT OR IGNORE INTO material_photos(id,material_id,request_id,stage,note,storage_key,sha256,byte_size,actor,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM material_photos WHERE material_id=?)<40').bind(id,materialId,raw.requestId,raw.stage,raw.note,key,digest,bytes.length,member.id,created,materialId),db.prepare("INSERT INTO material_events(material_id,actor,event_type,detail,created_at) SELECT ?,?,'photo_added',?,? WHERE EXISTS(SELECT 1 FROM material_photos WHERE id=?)").bind(materialId,member.id,JSON.stringify({photoId:id,stage:raw.stage,bytes:bytes.length}),created,id)]);}catch(error){await storage.delete(key);throw error;}
 const saved=await db.prepare('SELECT * FROM material_photos WHERE material_id=? AND request_id=?').bind(materialId,raw.requestId).first();if(!saved){await storage.delete(key);throw new ErrorType('Er zijn al 40 foto’s bij dit materiaal.',409);}if(saved.id!==id){await storage.delete(key);if(!matches(saved))throw new ErrorType('Deze upload is al opgeslagen.',409);}
 return json({id:saved.id,saved:true},201,origin);
}
