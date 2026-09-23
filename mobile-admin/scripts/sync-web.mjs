import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const siteRoot = resolve(appRoot, '..');
const webRoot = join(appRoot, 'www');

await rm(webRoot, {recursive: true, force: true});
await mkdir(join(webRoot, 'images'), {recursive: true});

let html = await readFile(join(siteRoot, 'beheer.html'), 'utf8');
html = html
  .replace('<link rel="manifest" href="beheer.webmanifest">', '')
  .replace('<body class="admin-body">', '<body class="admin-body native-admin-body">')
  .replace('<a class="brand" href="/" aria-label="De Lattenspecialist">', '<div class="brand" aria-label="De Lattenspecialist">')
  .replace('</a>\r\n      <div class="app-header-actions">', '</div>\r\n      <div class="app-header-actions">')
  .replace('</a>\n      <div class="app-header-actions">', '</div>\n      <div class="app-header-actions">')
  .replace('</head>', '  <link rel="stylesheet" href="native.css">\n</head>')
  .replace('</body>', '  <script src="native.js"></script>\n</body>');

await writeFile(join(webRoot, 'index.html'), html);
for (const file of ['beheer.js', 'booking-config.js', 'styles.css']) {
  await cp(join(siteRoot, file), join(webRoot, file));
}
for (const file of ['badge.webp', 'logo-main.webp', 'app-icon-192.png', 'app-icon-512.png']) {
  await cp(join(siteRoot, 'images', file), join(webRoot, 'images', file));
}

await writeFile(join(webRoot, 'native.css'), `
html{background:#f4f0e8}
body.native-admin-body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);overscroll-behavior-y:none}
.native-admin-body .site-header{top:env(safe-area-inset-top)}
.native-admin-body .install-button{display:none!important}
@media(max-width:560px){.native-admin-body .admin-main{padding-top:24px}.native-admin-body .container{width:min(100% - 24px,1180px)}}
`);

await writeFile(join(webRoot, 'native.js'), `
document.documentElement.classList.add('native-app');
const installButton=document.getElementById('installAdmin');
if(installButton) installButton.hidden=true;
`);

console.log('Beheerbestanden voor de mobiele app zijn bijgewerkt.');
