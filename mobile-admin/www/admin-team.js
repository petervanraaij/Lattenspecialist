(() => {
 let members=[],api,refresh,generation=0;
 const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=()=>document.querySelector('#teamPanel');
 function render(){
  panel().innerHTML=`<div class="availability-admin-head"><div><span class="eyebrow">Team</span><h2>Medewerkers</h2><p>Iedere medewerker krijgt een eigen toegangssleutel. Wijs het werk hieronder per aanvraag toe.</p></div><a class="btn btn-dark" href="https://lattenspecialist.nl/medewerkers.html" target="_blank" rel="noopener">Open medewerkersapp</a></div>
  <form id="createMember" class="team-create"><label>Naam<input name="name" required maxlength="80" autocomplete="off"></label><label>Gebruikersnaam<input name="login" required minlength="3" maxlength="120" autocomplete="off" autocapitalize="none" placeholder="bijv. robin"></label><label>Eigen toegangssleutel<input name="accessKey" minlength="10" maxlength="80" autocomplete="new-password" placeholder="Leeg = automatisch maken"></label><button class="btn btn-dark" id="generateMemberKey" type="button">Sterke sleutel maken</button><button class="btn btn-gold" type="submit">Medewerker toevoegen</button></form>
  <div id="teamMessage" role="status" aria-live="polite"></div><div id="teamKey" hidden><p>Deze sleutel wordt één keer getoond. Deel hem persoonlijk met deze medewerker.</p><label>Toegangssleutel<input readonly autocomplete="off"></label><button type="button" id="hideTeamKey" class="btn btn-dark">Ik heb de sleutel bewaard</button></div>
  <div class="team-members">${members.map(m=>`<div class="team-member"><span><strong>${escape(m.name)}</strong> · ${escape(m.login)} · ${m.active?'Actief':'Toegang ingetrokken'}</span><div><button class="btn btn-dark" type="button" data-member="${escape(m.id)}" data-action="rotate">Nieuwe sleutel</button>${m.active?` <button class="btn btn-dark" type="button" data-member="${escape(m.id)}" data-action="revoke">Toegang intrekken</button>`:''}</div></div>`).join('') || '<p>Nog geen medewerkers.</p>'}</div>`;
  document.querySelector('#hideTeamKey').onclick=()=>{document.querySelector('#teamKey input').value='';document.querySelector('#teamKey').hidden=true;};
  document.querySelector('#generateMemberKey').onclick=()=>{const bytes=crypto.getRandomValues(new Uint8Array(12));document.querySelector('#createMember [name="accessKey"]').value=`LS-${Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}`;};
 }
 function reveal(result){if(!result.accessKey)return;const box=document.querySelector('#teamKey');box.hidden=false;box.querySelector('input').value=result.accessKey;document.querySelector('#teamMessage').textContent=`Toegang aangemaakt voor ${result.name} (${result.login}).`;}
 async function load(expected=generation){try{const result=await api('/api/admin/team/members');if(expected!==generation)return;members=result.members;render();}catch(error){if(expected!==generation)return;members=[];panel().textContent=error.message;} }
 window.LattenspecialistTeam={
  async init(client,onChange){api=client;refresh=onChange;await load();},
  options(selected){return '<option value="">Nog niet toegewezen</option>'+(selected&&!members.some(m=>m.id===selected)?`<option value="${escape(selected)}" selected>Huidige toewijzing (naam niet beschikbaar)</option>`:'')+members.filter(m=>m.active || m.id===selected).map(m=>`<option value="${escape(m.id)}"${m.id===selected?' selected':''}>${escape(m.name)}${m.active?'':' (ingetrokken)'}</option>`).join('');},
  clear(){generation++;members=[];if(panel())panel().replaceChildren();}
 };
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='createMember')return;event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
  const expected=generation;
  try{const result=await api('/api/admin/team/members',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});if(expected!==generation)return;await load(expected);if(expected!==generation)return;reveal(result);refresh();}
  catch(error){if(expected!==generation)return;const message=document.querySelector('#teamMessage');if(message)message.textContent=error.message;button.disabled=false;}
 });
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-member]');if(!button)return;
  let accessKey='';if(button.dataset.action==='rotate'){const chosen=prompt('Vul zelf een nieuwe toegangssleutel in (minimaal 10 tekens). Laat leeg om automatisch een sterke sleutel te maken.');if(chosen===null)return;accessKey=chosen.trim();if(accessKey&&accessKey.length<10){alert('Gebruik minimaal 10 tekens.');return;}}else if(!confirm('Toegang van deze medewerker direct intrekken?'))return;
  button.disabled=true;
  const expected=generation;
  try{const result=await api('/api/admin/team/members/'+encodeURIComponent(button.dataset.member),{method:'PATCH',body:JSON.stringify({action:button.dataset.action,...(button.dataset.action==='rotate'?{accessKey}:{})})});if(expected!==generation)return;await load(expected);if(expected!==generation)return;reveal(result);refresh();}
  catch(error){if(expected!==generation)return;const message=document.querySelector('#teamMessage');if(message)message.textContent=error.message;button.disabled=false;}
 });
})();
