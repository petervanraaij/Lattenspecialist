import {cp, mkdir, readFile} from 'node:fs/promises';
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
await build({entryPoints: [join(root, 'src/customer.js')], outfile: join(output, 'customer.js'), bundle: true, format: 'iife', target: ['safari15', 'chrome90']});
// A customer bundle must never include the owner's dashboard or credentials.
const bundled = await readFile(join(output, 'customer.js'), 'utf8');
if (/\/api\/admin\/|lattenspecialist-admin-token|beheer\.js/.test(bundled)) throw new Error('Admin code found in customer bundle.');
console.log('Klantenapp gebouwd: aanvragen, onderhoud, aanbod en reis.');
