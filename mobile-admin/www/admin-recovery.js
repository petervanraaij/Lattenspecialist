(() => {
  const endpoint=String(window.LATTENSPECIALIST_BOOKING?.endpoint||'').replace(/\/$/,'');
  const dialog=document.querySelector('#adminRecoveryDialog'),requestForm=document.querySelector('#adminRecoveryForm');
  document.querySelector('#forgotAdminCode')?.addEventListener('click',()=>dialog.showModal());
  document.querySelector('#closeAdminRecovery')?.addEventListener('click',()=>dialog.close());
  async function post(path,data){
    const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',referrerPolicy:'no-referrer'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.message||'Herstellen is tijdelijk niet beschikbaar.');
    return result;
  }
  requestForm?.addEventListener('submit',async event=>{
    event.preventDefault();const button=requestForm.querySelector('[type=submit]'),status=document.querySelector('#adminRecoveryStatus');
    button.disabled=true;status.textContent='Herstellink aanvragen…';
    try{const result=await post('/api/admin/recovery/request',{email:requestForm.elements.email.value});status.textContent=result.message;}
    catch(error){status.textContent=error.message||'Controleer je internetverbinding en probeer opnieuw.';}
    finally{button.disabled=false;}
  });
  const form=document.querySelector('#newAdminCodeForm');
  if(!form)return;
  // Read once, then remove the secret from the address bar before any later navigation.
  let token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
  history.replaceState(null,'',location.pathname);
  const status=document.querySelector('#resetAdminStatus'),button=form.querySelector('[type=submit]');
  if(!/^[a-f0-9]{64}$/.test(token)){form.hidden=true;status.textContent='Open de herstellink uit je e-mail, of vraag via Beheer een nieuwe link aan.';return;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();const code=form.elements.code.value;
    if(code!==form.elements.confirm.value){status.textContent='De twee codes zijn niet gelijk.';return;}
    if(code!==code.trim()){status.textContent='Gebruik geen spaties aan het begin of einde.';return;}
    button.disabled=true;status.textContent='Nieuwe code opslaan…';
    try{
      const result=await post('/api/admin/recovery/complete',{token,code});token='';form.reset();form.hidden=true;
      sessionStorage.removeItem('lattenspecialist-admin-token');localStorage.removeItem('lattenspecialist-admin-token');
      status.textContent=result.message;
    }catch(error){status.textContent=error.message||'Controleer je internetverbinding en probeer opnieuw.';button.disabled=false;}
  });
})();
