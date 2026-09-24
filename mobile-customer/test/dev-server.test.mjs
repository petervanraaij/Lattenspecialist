import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../scripts/dev-server.mjs';

test('local development offers synthetic status only and cannot send or expose admin data', async t => {
  const server = createPreviewServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(base + path);
  const record = (await (await get('/demo/active/api/status/LS-DEMO23')).json()).record;
  assert.equal(record.currentStep, 5);
  assert.equal(record.name, undefined);
  assert.equal((await (await get('/demo/ready/api/status/LS-DEMO23')).json()).record.currentStep, 8);
  assert.equal((await (await get('/demo/closed/api/status/LS-DEMO23')).json()).record.closed, true);
  assert.equal((await get('/demo/missing/api/status/LS-DEMO23')).status, 404);
  assert.equal((await get('/demo/offline/api/status/LS-DEMO23')).status, 503);
  assert.equal((await get('/demo/active/api/status/LS-ABC234')).status, 404);
  for (const path of ['/worker/.admin-token.txt','/.git/config','/beheer.html','/api/admin/reservations','/../worker/.dev.vars','/images/../../worker/wrangler.toml']) assert.equal((await get(path)).status, 404);
  assert.equal((await fetch(base + '/api/reservations', {method:'POST', body:'{}'})).status, 405);
  const app = await get('/app.html');
  assert.match(app.headers.get('content-security-policy'), /connect-src 'self'; frame-src 'self'/);
  assert.match(await (await get('/?app=klant')).text(), /geen echte aanvragen/);
});
