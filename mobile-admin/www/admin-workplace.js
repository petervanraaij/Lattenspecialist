(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let ready=false;
 async function open(api,host){
  if(ready)return;ready=true;
  host.innerHTML=`<section class="admin-workplace"><h2>Werkplaats</h2><nav class="workplace-tabs" aria-label="Werkplaatsonderdelen"><button type="button" data-workplace-tab="planning">Planning</button><button type="button" data-workplace-tab="availability">Beschikbaarheid</button><button type="button" data-workplace-tab="practice">Oefenen</button><button type="button" data-workplace-tab="tools">Gereedschap</button><button type="button" data-workplace-tab="warehouse">Magazijn</button></nav><section data-workplace-content="planning" hidden></section><section data-workplace-content="availability" hidden></section><div data-workplace-content="practice"></div><section data-workplace-content="tools" hidden></section><section data-workplace-content="warehouse" hidden><label>Wie pakt het materiaal?<select data-warehouse-member><option value="">Kies medewerker</option></select></label><div data-warehouse-host></div></section><p data-workplace-status role="status"></p></section>`;
  const practice=document.getElementById('adminPracticePanel');practice.hidden=false;host.querySelector('[data-workplace-content=practice]').append(practice);
  async function people(){try{const data=await api('/api/admin/team/members'),options='<option value="">Kies medewerker</option>'+(data.members||[]).filter(m=>m.active).map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');for(const select of [practice.querySelector('[name=executionMemberId]'),host.querySelector('[data-warehouse-member]')])select.innerHTML=options;host.querySelector('[data-workplace-status]').textContent='';}catch(e){host.querySelector('[data-workplace-status]').textContent=e.message;}}
  await people();
  const sessions=document.createElement('section');sessions.innerHTML='<h3>Eerdere oefeningen</h3><button type="button" data-refresh-practice>Oefeningen vernieuwen</button><p data-practice-message role="status"></p><div data-practice-sessions></div>';practice.prepend(sessions);
  async function list(){const target=sessions.querySelector('[data-practice-sessions]');try{const data=await api('/api/admin/workplace/practice');target.innerHTML=(data.sessions||[]).map(item=>`<p><button type="button" data-resume-practice="${esc(item.id)}" data-member="${esc(item.memberId)}" data-member-name="${esc(item.memberName)}">${esc(item.displayCode)} · ${esc(item.kind)} · ${esc(item.title)} · ${esc(item.memberName)} · ${esc(item.status==='ready'?'Afgerond':item.status==='maintenance'?'Bezig':'Openen')}</button> ${['ready','delivered'].includes(item.status)?'':`<button class="admin-trash-cross" type="button" data-remove-practice="${esc(item.id)}" data-code="${esc(item.displayCode)}" aria-label="Verwijder oefening ${esc(item.displayCode)}" title="Oefening verwijderen">×</button>`}</p>`).join('')||'<p>Nog geen oefeningen.</p>';}catch(e){target.textContent=e.message;}}
  const confirm=document.createElement('dialog');
  confirm.className='workorder-executor-dialog';
  confirm.setAttribute('aria-labelledby','removePracticeTitle');
  confirm.innerHTML='<form method="dialog"><h3 id="removePracticeTitle">Oefening verwijderen?</h3><p data-remove-description></p><div class="admin-save-actions"><button class="btn btn-dark" value="cancel" autofocus>Annuleren</button><button class="btn btn-gold" value="remove">Verwijderen</button></div></form>';
  sessions.append(confirm);
  let pending;
  confirm.addEventListener('close',async()=>{
   const button=pending;pending=null;
   if(!button||confirm.returnValue!=='remove')return;
   const id=button.dataset.removePractice,message=sessions.querySelector('[data-practice-message]');
   button.disabled=true;message.textContent='';
   try{
    await api('/api/admin/workplace/practice/'+encodeURIComponent(id)+'/remove',{method:'POST',body:'{}'});
    practice.querySelector(`[data-practice-material="${CSS.escape(id)}"]`)?.remove();
    await list();
    message.textContent='Oefening verwijderd.';
   }catch(e){message.textContent=e.message;}
   finally{button.disabled=false;}
  });
  sessions.querySelector('[data-refresh-practice]').onclick=list;
  sessions.addEventListener('click',event=>{
   const remove=event.target.closest('[data-remove-practice]');
   if(remove){
    pending=remove;
    confirm.querySelector('[data-remove-description]').textContent=`${remove.dataset.code} verdwijnt uit de lijst. Geregistreerde tijd en geboekt verbruik blijven bewaard.`;
    confirm.returnValue='cancel';confirm.showModal();return;
   }
   const button=event.target.closest('[data-resume-practice]');if(!button)return;
   const {resumePractice,member,memberName}=button.dataset;
   const target=practice.querySelector('#practiceResult');
   const panel=window.LSWorkflows.practicePanel(target,member,memberName,resumePractice);
   const bench=panel.lastElementChild;
   if(!bench.hasChildNodes())void window.LSWorkflows.open(bench,resumePractice,{admin:true,memberId:member});
   panel.scrollIntoView({block:'start',behavior:'smooth'});
  });
  document.addEventListener('ls-practice-created',()=>void list());
  void list();

  const warehouse=()=>window.LSWarehouse.open(api,host.querySelector('[data-warehouse-host]'),{owner:true,memberId:host.querySelector('[data-warehouse-member]').value});
  host.querySelector('[data-warehouse-member]').onchange=warehouse;
  host.querySelector('.workplace-tabs').onclick=event=>{const button=event.target.closest('[data-workplace-tab]');if(!button)return;const tab=button.dataset.workplaceTab;for(const item of host.querySelectorAll('[data-workplace-content]'))item.hidden=item.dataset.workplaceContent!==tab;for(const item of host.querySelectorAll('[data-workplace-tab]'))item.setAttribute('aria-pressed',String(item===button));if(['planning','availability'].includes(tab))void window.LSWorkplacePlanning.mount(api,host.querySelector('[data-workplace-content='+tab+']'),tab);if(tab==='tools')window.LattenspecialistGuides.open(api,host.querySelector('[data-workplace-content=tools]'),!window.AdminSecurity?.locked,true,true);if(tab==='warehouse')void warehouse();};
  host.querySelector('[data-workplace-tab=practice]').setAttribute('aria-pressed','true');
 }
 window.LSAdminWorkplace={open};
})();
