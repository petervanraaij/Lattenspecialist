import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Only these public assets are served; never expose the repository, worker or keys.
const assets = new Map([
  ['/', ['mobile-customer/dev/index.html', 'text/html']],
  ['/app.html', ['app.html', 'text/html']],
  ['/customer-app.js', ['customer-app.js', 'text/javascript']],
  ['/customer-app.css', ['customer-app.css', 'text/css']],
  ['/images/logo-main.webp', ['images/logo-main.webp', 'image/webp']],
  ['/images/family-ready.webp', ['images/family-ready.webp', 'image/webp']],
  ['/images/app-icon-512.png', ['images/app-icon-512.png', 'image/png']],
  ['/images/app-icon-192.png', ['images/app-icon-192.png', 'image/png']],
]);
const scenarios = new Set(['active', 'ready', 'closed', 'missing', 'offline']);
const fixture = {
  code: 'LS-DEMO23', material: '1× Ski (voorbeeld)', package: 'Demo', currentStep: 5,
  status: 'Onderhoud gestart', waxType: 'Premium universele wax',
  note: 'Fictief onderhoud om de klantomgeving te testen.', closed: false,
};

export function createPreviewServer() {
  return createServer(async (req, res) => {
    const send = (status, type, body) => {
      res.writeHead(status, {'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'});
      res.end(body);
    };
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', 'Demo: schrijven en berichten versturen zijn uitgeschakeld.');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/booking-config.js') return send(200, 'text/javascript', `(() => {
        const allowed = ['active','ready','closed','missing','offline'];
        const requested = new URLSearchParams(location.search).get('scenario');
        const scenario = allowed.includes(requested) ? requested : 'active';
        window.LATTENSPECIALIST_BOOKING = {endpoint: location.origin + '/demo/' + scenario};
        const banner = document.createElement('div');
        banner.className = 'connection-notice';
        banner.textContent = 'DEMO — fictieve gegevens; aanvragen en berichten versturen staan uit.';
        document.body.prepend(banner);
      })();`);
      // No service worker or installation prompt in the development preview.
      if (url.pathname === '/pwa-install.js') return send(200, 'text/javascript', "document.getElementById('installCard').hidden = true;");
      if (url.pathname === '/manifest.webmanifest') return send(200, 'application/manifest+json', '{}');
      if (url.pathname === '/' && url.searchParams.get('app') === 'klant') return send(200, 'text/html', '<!doctype html><html lang="nl"><meta charset="utf-8"><h1>Demo-aanvraagformulier</h1><p>In deze preview worden geen echte aanvragen, e-mails of WhatsApp-berichten verstuurd. Het echte aanvraagformulier test je afzonderlijk met een herkenbare testaanvraag.</p></html>');
      const route = url.pathname.match(/^\/demo\/([^/]+)\/api\/(availability|status\/([^/]+))$/);
      if (route && scenarios.has(route[1])) {
        const [, scenario, operation, code] = route;
        if (operation === 'availability') return send(200, 'application/json', JSON.stringify({dates: []}));
        if (scenario === 'offline') return send(503, 'application/json', JSON.stringify({message: 'Demo: verbinding niet beschikbaar'}));
        if (code !== fixture.code || scenario === 'missing') return send(404, 'application/json', JSON.stringify({message: 'Demo: onderhoud niet gevonden'}));
        const record = {...fixture, updatedAt: new Date().toISOString()};
        if (scenario === 'ready') Object.assign(record, {currentStep: 8, status: 'Klaar voor ophalen of terugbrengen'});
        if (scenario === 'closed') Object.assign(record, {closed: true, status: 'Afgemeld'});
        return send(200, 'application/json', JSON.stringify({record}));
      }
      if (url.pathname === '/data/aanbod.json') return send(200, 'application/json', JSON.stringify({items: []}));
      const asset = assets.get(url.pathname);
      if (!asset) return send(404, 'text/plain', 'Niet beschikbaar in de lokale demo.');
      return send(200, asset[1], await readFile(resolve(root, asset[0])));
    } catch { return send(500, 'text/plain', 'De preview kon dit onderdeel niet laden.'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.LATTEN_PREVIEW_PORT || 8780);
  const server = createPreviewServer();
  server.on('error', error => { console.error(`Preview starten mislukt: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Ontwikkelomgeving: http://127.0.0.1:${port}/ — stoppen met Ctrl+C.`));
}
