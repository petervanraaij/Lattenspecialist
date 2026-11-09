import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createInvoiceTransfer,readInvoiceTransfer} from './src/invoice-transfer.js';
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE records(reference TEXT PRIMARY KEY,payload TEXT)');
const db={prepare(query){let values=[];const s={bind(...args){values=args;return s;},async run(){return sql.prepare(query).run(...values);},async first(){return sql.prepare(query).get(...values);},exec(){return sql.prepare(query).run(...values);}};return s;},async batch(list){sql.exec('BEGIN');try{list.forEach(s=>s.exec());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
class TestError extends Error{constructor(message,status){super(message);this.status=status;}}
const reference='LS-2611-ABC234';sql.prepare('INSERT INTO records VALUES(?,?)').run(reference,JSON.stringify({reference,service:'Onderhoud',name:'Fictief',email:'test@example.test',material:'Ski',amount:1,package:'Koper',waxstickCount:2,priceQuote:{includesVat:true,knownTotalCents:5495,needsAssessment:false}}));
const result=await createInvoiceTransfer(db,reference,TestError),token=new URLSearchParams(new URL(result.url).hash.slice(1)).get('transfer');assert.match(token,/^[a-f0-9]{64}$/);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM invoice_transfers WHERE token_hash=?').get(token).n,0,'alleen tokenhash wordt bewaard');
const snapshot=await readInvoiceTransfer(db,token);assert.equal(snapshot.waxstickCount,2);assert.equal(snapshot.maintenanceGrossCents,1995);assert.equal(snapshot.waxstickUnitGrossCents,1750);
sql.prepare("UPDATE records SET payload=json_set(payload,'$.waxstickCount',3) WHERE reference=?").run(reference);assert.equal((await readInvoiceTransfer(db,token)).waxstickCount,2,'de overgedragen snapshot blijft vast');
assert.equal(await readInvoiceTransfer(db,'a'.repeat(64)),null);sql.prepare('UPDATE invoice_transfers SET expires_at=0').run();assert.equal(await readInvoiceTransfer(db,token),null);await assert.rejects(createInvoiceTransfer(db,'LS-2611-DEF234',TestError),/niet gevonden/);
sql.close();console.log('PASS veilige opdrachtoverdracht: beperkte snapshot, tokenhash, prijsbehoud en vervaldatum.');
