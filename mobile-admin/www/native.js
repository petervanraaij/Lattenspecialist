
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
