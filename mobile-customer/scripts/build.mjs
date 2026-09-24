import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, '..');
const output = join(root, 'www');
await mkdir(join(output, 'images'), {recursive: true});
for (const file of ['index.html', 'customer.css']) await cp(join(root, 'src', file), join(output, file));
for (const file of ['app-icon-512.png', 'logo-main.webp', 'family-ready.webp']) await cp(join(site, 'images', file), join(output, 'images', file));
await cp(join(site, 'booking-config.js'), join(output, 'booking-config.js'));
const shared = {entryPoints: [join(root, 'src/customer.js')], bundle: true, format: 'iife', target: ['safari15', 'chrome90']};
await build({...shared, outfile: join(output, 'customer.js'), define: {__WEB_APP__: 'false'}});
await build({...shared, outfile: join(site, 'customer-app.js'), define: {__WEB_APP__: 'true'}});
await cp(join(root, 'src/customer.css'), join(site, 'customer-app.css'));
await cp(join(root, 'src/install.js'), join(site, 'pwa-install.js'));
const template = await readFile(join(root, 'src/index.html'), 'utf8');
const install = await readFile(join(root, 'src/install.html'), 'utf8');
const web = template
  .replace('<!-- WEB_META -->', `<meta name="description" content="Vraag onderhoud aan, volg je ski’s of snowboard en bereid je wintersport voor met Mijn Lattenspecialist.">
  <link rel="canonical" href="https://lattenspecialist.nl/app.html">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="images/app-icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Lattenspecialist">`)
  .replace('<!-- WEB_INSTALL -->', install.trim())
  .replace('<!-- WEB_SCRIPT -->', '<script src="pwa-install.js?v=1"></script>')
  .replace('href="customer.css"', 'href="customer-app.css?v=1"')
  .replace('src="customer.js"', 'src="customer-app.js?v=3"')
  .replace('src="booking-config.js"', 'src="booking-config.js?v=2"')
  .replace('frame-src https://lattenspecialist.nl;', "frame-src 'self' https://lattenspecialist.nl;");
await writeFile(join(site, 'app.html'), '<!-- Generated from mobile-customer/src; run npm run build in mobile-customer. -->\n' + web);
// A customer bundle must never include the owner's dashboard or credentials.
const bundled = await readFile(join(output, 'customer.js'), 'utf8');
if (/\/api\/admin\/|lattenspecialist-admin-token|beheer\.js/.test(bundled)) throw new Error('Admin code found in customer bundle.');
console.log('Klantenapp gebouwd voor de website, Android en iPhone.');
