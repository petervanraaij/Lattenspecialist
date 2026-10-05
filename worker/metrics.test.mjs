import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from './src/index.js';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('./migrations/0001_website_metrics.sql', import.meta.url),'utf8'));
const db = {
  prepare(sql) {
    let params = [];
    return {bind(...values) { params = values; return this; }, all() { return {results:sqlite.prepare(sql).all(...params)}; }, run() { return sqlite.prepare(sql).run(...params); }};
  },
  async batch(statements) { sqlite.exec('BEGIN'); try { const result=statements.map(s=>s.run()); sqlite.exec('COMMIT'); return result; } catch(e) { sqlite.exec('ROLLBACK'); throw e; } }
};
const origin = 'https://lattenspecialist.nl';
const env = {LATTENSPECIALIST_ANALYTICS_DB:db,LATTENSPECIALIST_ADMIN_TOKEN:'metrics-test-only'};
let serial = 0;
const call = (path, {method='POST',body={event:'form_opened'},auth=false,from=origin,ip}={}, environment=env) => worker.fetch(new Request('https://worker.example'+path, {
  method,headers:{Origin:from,'Content-Type':'application/json','CF-Connecting-IP':ip || `test-${++serial}`,...(auth?{Authorization:'Bearer metrics-test-only'}:{})},
  ...(method==='POST'?{body:typeof body === 'string' ? body : JSON.stringify(body)}:{})
}),environment);
assert.equal((await call('/api/admin/metrics',{method:'GET'})).status,401);
assert.equal((await call('/api/metrics',{from:'https://evil.example'})).status,403);
assert.equal((await call('/api/metrics',{from:'https://stuiterbaas.nl'})).status,403);
assert.equal((await call('/api/metrics',{from:'capacitor://localhost'})).status,403);
assert.equal((await call('/api/metrics',{method:'GET'})).status,405);
assert.equal((await call('/api/metrics',{body:{event:'form_opened',email:'private@example.com'}})).status,400);
assert.equal((await call('/api/metrics',{body:{event:'customer-name'}})).status,400);
assert.equal((await call('/api/metrics',{body:'x'.repeat(129)})).status,400);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM website_metrics').get().n,0);
sqlite.exec("INSERT INTO website_metrics VALUES('2020-01-01','form_opened',40)");
await Promise.all(Array.from({length:8},()=>call('/api/metrics')));
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_metrics WHERE day='2020-01-01'").get().n,0);
let response=await call('/api/admin/metrics',{method:'GET',auth:true});
let data=await response.json();
assert.equal(data.totals.form_opened,8);
assert.equal(data.totals.booking_submitted,0);
assert.equal((await call('/api/admin/metrics?days=999',{method:'GET',auth:true})).status,400);
assert.equal((await call('/api/metrics',{},{})).status,503);
assert.equal((await call('/api/metrics',{}, {...env,LATTENSPECIALIST_ANALYTICS_DB:{batch(){throw new Error('outage')},prepare:db.prepare}})).status,503);
for(let i=0;i<20;i++) assert.equal((await call('/api/metrics',{ip:'rate-test'})).status,202);
assert.equal((await call('/api/metrics',{ip:'rate-test'})).status,429);
assert.deepEqual(sqlite.prepare('PRAGMA table_info(website_metrics)').all().map(r=>r.name),['day','event','total']);
sqlite.close();
console.log('Metrics checks passed: auth, origin separation, payload privacy, bounded body, counters, retention, rate limit and storage outage.');
