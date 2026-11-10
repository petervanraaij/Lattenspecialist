import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditWebAssets} from './verify-web-assets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const siteRoot = resolve(appRoot, '..');
const webRoot = join(appRoot, 'www');

await mkdir(join(webRoot, 'images'), {recursive: true});
await mkdir(join(webRoot, 'vendor'), {recursive: true});

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
for (const file of ['tool-images.js','admin-dossiers.js','admin-dossiers.css','material-photos.js','medewerkers-workflow.js','medewerkers-workflow.css','beheer.js','maintenance-selection.js','manual-maintenance.js', 'admin-team.js', 'admin-operations.js', 'maintenance-guide-ui.js','work-instructions.js', 'maintenance-guide.css', 'admin-inventory.js', 'team.css', 'admin-metrics.css', 'admin-operations.css', 'admin-operations-extra.css', 'admin-wallboard.css', 'admin-inventory.css', 'booking-config.js', 'styles.css']) {
  await cp(join(siteRoot, file), join(webRoot, file));
}
for (const file of ['treatment-overview.js','treatment-overview.css']) await cp(join(siteRoot,file),join(webRoot,file));
await cp(join(siteRoot,'admin-recovery.js'),join(webRoot,'admin-recovery.js'));
for (const file of ['qrcode.js','html5-qrcode.min.js']) await cp(join(siteRoot,'vendor',file),join(webRoot,'vendor',file));
for (const file of ['badge.webp', 'logo-main.webp', 'hero-workshop.webp', 'app-icon-192.png', 'app-icon-512.png']) {
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
const widgetBridge=window.LattenspecialistWidget;
const syncWidgetToken=()=>widgetBridge?.setAdminToken(localStorage.getItem('lattenspecialist-admin-token')||sessionStorage.getItem('lattenspecialist-admin-token')||'');
syncWidgetToken();
window.addEventListener('lattenspecialist:widget-refresh',()=>{syncWidgetToken();widgetBridge?.refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncWidgetToken();});
const quickMaterial=widgetBridge?.consumeQuickMaterial();
if(quickMaterial)window.dispatchEvent(new CustomEvent('lattenspecialist:new-request',{detail:{material:quickMaterial}}));
if(widgetBridge?.getPushStatus){
 const panel=document.createElement('section');panel.setAttribute('role','status');panel.className='native-push-status';
 const label=document.createElement('span'),check=document.createElement('button');check.type='button';check.className='btn btn-ghost';check.textContent='Verbinding controleren';
 check.onclick=()=>{syncWidgetToken();widgetBridge.refresh();updatePushState();};panel.append(label,check);
 document.querySelector('#adminDashboard')?.prepend(panel);
 function updatePushState(){try{const state=JSON.parse(widgetBridge.getPushStatus());label.textContent='Directe meldingen: '+(state.permitted?state.status:'meldingen staan uit')+(state.lastReceived?' · laatst ontvangen '+new Date(state.lastReceived).toLocaleTimeString('nl-NL'):'');}catch{label.textContent='Directe meldingen: status niet beschikbaar';}}
 updatePushState();setInterval(()=>{if(!document.hidden)updatePushState();},5000);
}
`);

console.log('Beheerbestanden voor de mobiele app zijn bijgewerkt.');

await cp(join(siteRoot,'images/tools'),join(webRoot,'images/tools'),{recursive:true});
console.log(JSON.stringify(auditWebAssets(webRoot)));
