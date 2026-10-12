
document.documentElement.classList.add('native-app');
const installButton=document.getElementById('installAdmin');
if(installButton) installButton.hidden=true;
const widgetBridge=window.LattenspecialistWidget;
const syncWidgetToken=()=>widgetBridge?.setAdminToken(localStorage.getItem('lattenspecialist-admin-token')||sessionStorage.getItem('lattenspecialist-admin-token')||'');
syncWidgetToken();
window.addEventListener('lattenspecialist:widget-refresh',()=>{syncWidgetToken();widgetBridge?.refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncWidgetToken();});
