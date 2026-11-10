(()=>{
 // Shared Beheer access: the existing code is the complete sign-in.
 // Optional secondary protection is enabled only by an explicit installation setting.
 if(window.LATTENSPECIALIST_BOOKING?.extraAdminPassword!==true){
  window.AdminSecurity={refresh:async()=>({enabled:false,unlocked:true}),open:async()=>{},lock(){},logout(){},get locked(){return false;}};
  return;
 }

 const endpoint=String(window.LATTENSPECIALIST_BOOKING?.endpoint||'').replace(/\/$/,'');
 const originalFetch=window.fetch.bind(window);let unlockToken='',ownerCode='',generation=0,lastActivity=0,timer,enabled=true,configured=false,locked=true;
 const code=()=>ownerCode||sessionStorage.getItem('lattenspecialist-admin-token')||localStorage.getItem('lattenspecialist-admin-token')||'';
 const panel=document.createElement('section');panel.className='admin-security-panel';panel.innerHTML='<div><strong data-security-state>Beheer vergrendeld</strong><p>De werkplaats werkt met de beheercode. Klantgegevens, financiën en instellingen vragen een extra ontgrendeling.</p></div><button class="btn btn-gold" type="button" data-security-open>Beheer ontgrendelen</button><button class="btn btn-dark" type="button" data-security-lock hidden>Beheer vergrendelen</button>';
 document.querySelector('#adminDashboard')?.prepend(panel);
 const dialog=document.createElement('dialog');dialog.className='admin-security-dialog';dialog.setAttribute('aria-labelledby','securityUnlockTitle');dialog.innerHTML='<h2 id="securityUnlockTitle">Beheer ontgrendelen</h2><p>Deze ontgrendeling blijft maximaal tien minuten zonder gebruik geldig. Je wachtwoord wordt niet op dit toestel bewaard.</p><form data-unlock-form><label>Extra beheerwachtwoord<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button class="btn btn-gold" type="submit">Ontgrendelen</button></form><button class="btn btn-dark" type="button" data-security-request>Wachtwoord instellen of vergeten</button><p data-security-result role="status"></p><button class="btn btn-dark" type="button" data-security-close>Sluiten</button>';document.body.append(dialog);
 const status=dialog.querySelector('[data-security-result]');
 function paint(){panel.hidden=!enabled;panel.querySelector('[data-security-state]').textContent=locked?'Werkplaats geopend · beheer vergrendeld':'Beheer ontgrendeld · vergrendelt na tien minuten zonder gebruik';panel.querySelector('[data-security-open]').hidden=!locked;panel.querySelector('[data-security-lock]').hidden=locked;dialog.querySelector('form').hidden=!configured;document.documentElement.dataset.adminLocked=String(locked&&enabled);}
 async function call(path,data,token=unlockToken){const response=await originalFetch(endpoint+'/api/admin/security/'+path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+code(),'Content-Type':'application/json',...(token?{'X-Admin-Unlock':token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),cache:'no-store'});const value=await response.json();if(!response.ok)throw Error(value.message||'Ontgrendelen is niet gelukt.');return value;}
 async function refresh(value){if(value)ownerCode=value;const access=await call('status');enabled=access.enabled;configured=access.configured;locked=!access.unlocked;paint();return access;}
 async function open(){try{await refresh();status.textContent=configured?'':'Stel je extra beheerwachtwoord zelf in via een link naar het vaste herstelmailadres.';if(!dialog.open)dialog.showModal();}catch(error){status.textContent=error.message;if(!dialog.open)dialog.showModal();}}
 function reloadLocked(){const message=document.createElement('main');message.className='admin-main';message.textContent='Beheer is vergrendeld. De werkplaats wordt opnieuw geopend…';document.body.replaceChildren(message);location.reload();}
 function lock(reload=true){const old=unlockToken;unlockToken='';generation++;locked=true;clearTimeout(timer);paint();dialog.querySelector('form').reset();if(old)void call('lock',{},old).catch(()=>{});if(reload&&old)reloadLocked();}
 function activity(){if(!unlockToken)return;lastActivity=Date.now();clearTimeout(timer);timer=setTimeout(()=>lock(),600000);}
 window.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),backend=new URL(endpoint,location.href);
  if(url.origin!==backend.origin||!url.pathname.startsWith(backend.pathname.replace(/\/$/,'')+'/api/admin/'))return originalFetch(input,options);
  const headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined)),started=unlockToken,version=generation;
  if(started&&headers.get('Authorization')==='Bearer '+code())headers.set('X-Admin-Unlock',started);
  const response=await originalFetch(input,{...options,headers});
  if(started&&(version!==generation||unlockToken!==started))throw Error('Beheer is vergrendeld. Ontgrendel opnieuw.');
  if(response.headers.get('X-Admin-Mode')==='workspace'&&(started||!locked)){if(started)lock();else{enabled=true;locked=true;generation++;reloadLocked();}throw Error('De werkplaats is opnieuw beveiligd.');}
  if(response.status===403){const result=await response.clone().json().catch(()=>({}));if(result.code==='ADMIN_LOCKED'){if(started)lock();else void open();}}
  return response;
 };
 panel.querySelector('[data-security-open]').onclick=open;panel.querySelector('[data-security-lock]').onclick=()=>lock();dialog.querySelector('[data-security-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-security-request]').onclick=async event=>{event.target.disabled=true;try{status.textContent=(await call('request',{})).message;}catch(error){status.textContent=error.message;}finally{event.target.disabled=false;}};
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;try{const result=await call('unlock',{password:form.elements.password.value});unlockToken=result.token;generation++;locked=false;form.reset();dialog.close();activity();paint();window.dispatchEvent(new Event('lattenspecialist:admin-unlocked'));}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 for(const event of ['pointerdown','keydown','touchstart'])document.addEventListener(event,activity,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&unlockToken&&Date.now()-lastActivity>=600000)lock();});
 window.addEventListener('pageshow',event=>{if(event.persisted)reloadLocked();});
 window.AdminSecurity={refresh,open,lock,get locked(){return enabled&&locked;},logout(){lock(false);ownerCode='';}};paint();
})();
