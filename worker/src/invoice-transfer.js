const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
export async function invoiceTransferToken(request){const reader=request.body?.getReader();if(!reader)return null;const parts=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>500){await reader.cancel();return null;}parts.push(r.value);}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}try{return JSON.parse(new TextDecoder().decode(bytes)).token;}catch{return null;}}
async function ensure(db){await db.prepare('CREATE TABLE IF NOT EXISTS invoice_transfers(token_hash TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL)').run();}
export async function createInvoiceTransfer(db,reference,ErrorType){
 const row=await db.prepare('SELECT payload FROM records WHERE reference=?').bind(reference).first();if(!row)throw new ErrorType('Opdracht niet gevonden.',404);
 const r=JSON.parse(row.payload),count=Number(r.waxstickCount)||0;if(r.service!=='Onderhoud'||!Number.isInteger(count)||count<1||count>20)throw new ErrorType('Deze opdracht bevat geen waxstickbestelling.',409);
 const quote=r.priceQuote,maintenanceGrossCents=quote?.includesVat&&Number.isSafeInteger(quote.knownTotalCents)&&quote.knownTotalCents>=count*1750?quote.knownTotalCents-count*1750:null;
 const snapshot={source:'lattenspecialist',reference,customerName:r.name||'',customerEmail:r.email||'',customerAddress:r.address||'',waxstickCount:count,waxstickUnitGrossCents:1750,maintenanceDescription:`Onderhoud ${r.amount||1}× ${r.material||'ski/snowboard'} · ${r.package||'volgens opdracht'}`,maintenanceGrossCents,needsAssessment:quote?.needsAssessment!==false,issuer:{name:'Van Raaij Services · De Lattenspecialist',address:'Hollenhof 13, 6659 BB Wamel',chamberOfCommerce:'99668637',vatId:'NL005403580B64'}};
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');await ensure(db);await db.batch([db.prepare('DELETE FROM invoice_transfers WHERE expires_at<?').bind(Date.now()),db.prepare('INSERT INTO invoice_transfers(token_hash,payload,expires_at) VALUES(?,?,?)').bind(await digest(token),JSON.stringify(snapshot),Date.now()+30*60000)]);
 return{url:`https://app.pierfinity.nl/?maintenanceInvoice=1#transfer=${token}`};
}
export async function readInvoiceTransfer(db,token){
 if(!db||!/^[a-f0-9]{64}$/.test(token||''))return null;await ensure(db);const row=await db.prepare('SELECT payload FROM invoice_transfers WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first();return row?JSON.parse(row.payload):null;
}
