(() => {
  const endpoint = String(window.LATTENSPECIALIST_BOOKING?.endpoint || '').replace(/\/$/, '');
  const steps = ['Aanvraag ontvangen','Ophalen of brengen gepland','Materiaal ontvangen','Inspectie uitgevoerd','Onderhoud gestart','Wax koelt af','Finish en eindcontrole','Klaar voor ophalen of terugbrengen'];
  const waxOptions = ['Nog te bepalen','Premium warmweerwax','Premium universele wax','Premium koudweerwax','Premium wax voor harde sneeuw en kunstsneeuw'];
  const loginSection = document.querySelector('#adminLogin');
  const dashboard = document.querySelector('#adminDashboard');
  const loginForm = document.querySelector('#adminLoginForm');
  const loginStatus = document.querySelector('#adminLoginStatus');
  const logoutButton = document.querySelector('#logoutAdmin');
  const list = document.querySelector('#adminList');
  const summary = document.querySelector('#adminSummary');
  const search = document.querySelector('#adminSearch');
  const refreshButton = document.querySelector('#refreshAdmin');
  const availabilityCalendar = document.querySelector('#availabilityCalendar');
  const availabilityMessage = document.querySelector('#availabilityMessage');
  const saveAvailabilityButton = document.querySelector('#saveAvailability');
  const addAvailabilityButton = document.querySelector('#addAvailabilityDate');
  const customAvailabilityDate = document.querySelector('#customAvailabilityDate');
  const manualDialog = document.querySelector('#manualRequestDialog');
  const manualForm = document.querySelector('#manualRequestForm');
  const manualStatus = document.querySelector('#manualRequestStatus');
  const manualSelection=window.LattenManualSelection.mount(manualForm);
  const manualAddress = document.querySelector('#manualPickupAddress');
  const manualAddressStatus = document.querySelector('#manualAddressStatus');
  let manualAddressTimer, manualAddressController;
  let token = sessionStorage.getItem('lattenspecialist-admin-token') || localStorage.getItem('lattenspecialist-admin-token') || '';
  let records = [];
  let activeFilter='open';
  const dirtyRequests=new Set();
  const recordStage=record=>record.closedAt?'closed':Number(record.currentStep||1)>=8?'ready':Number(record.currentStep||1)>=3?'work':Number(record.currentStep||1)===2?'planned':'new';
  const filterLabels={open:'Alle open',new:'Nieuw',planned:'Gepland',work:'In de werkplaats',ready:'Gereed',closed:'Afgerond'};
  const orderFilters=document.createElement('section');orderFilters.className='admin-order-filters';orderFilters.setAttribute('aria-label','Opdrachten filteren');
  summary.before(orderFilters);
  const listStatus=document.createElement('p');listStatus.className='admin-list-status';listStatus.setAttribute('role','status');list.before(listStatus);
  const syncStatus=document.createElement('p');syncStatus.className='admin-sync-status';syncStatus.setAttribute('role','status');refreshButton.parentElement.append(syncStatus);
  for(const type of ['input','change'])list.addEventListener(type,event=>{const card=event.target.closest('.admin-record');if(card&&event.target.closest('.admin-update-form')){dirtyRequests.add(card.dataset.reference);card.dataset.unsaved='true';card.querySelector('.discard-request').hidden=false;syncStatus.textContent='Niet-opgeslagen wijzigingen blijven bewaard tijdens verversen.';}});
  orderFilters.addEventListener('click',event=>{const button=event.target.closest('[data-order-filter]');if(!button)return;activeFilter=button.dataset.orderFilter;applySearch();});
  const requestAlert=document.createElement('section');
  requestAlert.className='admin-request-alert';requestAlert.setAttribute('role','status');requestAlert.hidden=true;
  dashboard.prepend(requestAlert);
  const quickRequest=document.createElement('button');quickRequest.type='button';quickRequest.className='btn btn-primary admin-quick-request';quickRequest.textContent='+ Telefonische aanvraag';
  quickRequest.onclick=()=>requestManualOpen('Ski');dashboard.prepend(quickRequest);
  function renderRequestAlert(source=records){
    const fresh=source.filter(r=>!r.closedAt&&r.service==='Onderhoud'&&Number(r.currentStep||1)===1);
    requestAlert.replaceChildren();requestAlert.hidden=!fresh.length;
    if(!fresh.length)return;
    const heading=document.createElement('strong');heading.textContent=`${fresh.length} nieuwe onderhoudsaanvraag${fresh.length===1?'':'en'} · nog op te pakken`;
    requestAlert.append(heading);
    fresh.forEach(record=>{const button=document.createElement('button');button.type='button';button.className='btn btn-primary';button.textContent=`Bekijk ${record.reference} · ${record.name||'Aanvraag'}`;button.onclick=()=>{search.value='';activeFilter='new';render();document.querySelector('#adminTabs [data-tab="orders"]')?.click();const card=list.querySelector(`[data-reference="${CSS.escape(record.reference)}"]`);if(card){card.querySelector('.admin-record-details').open=true;card.scrollIntoView({behavior:'smooth',block:'start'});}};requestAlert.append(button);});
  }
  let polling=false;
  async function pollRequests(){
    if(!token||dashboard.hidden||document.hidden||polling)return;
    polling=true;
    const startedToken=token,startedRecords=JSON.stringify(records);
    try{const result=await api('/api/admin/reservations');const next=result.records||[];
      if(token!==startedToken||dashboard.hidden||JSON.stringify(records)!==startedRecords)return;
      // Keep edits in progress intact. Only redraw when the server data changes.
      if(JSON.stringify(next)!==JSON.stringify(records)){records=next.map(record=>dirtyRequests.has(record.reference)?records.find(old=>old.reference===record.reference)||record:record);render();}
      else renderRequestAlert();
      syncStatus.textContent=dirtyRequests.size?'Bijgewerkt · je niet-opgeslagen wijzigingen zijn bewaard.':'Bijgewerkt om '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
    }catch{requestAlert.hidden=false;requestAlert.textContent='Aanvragen konden niet worden bijgewerkt. Controleer je verbinding en druk op Vernieuwen.';}
    finally{polling=false;}
  }
  setInterval(pollRequests,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollRequests();});
  let availableDates = new Set();

  window.addEventListener('lattenspecialist:admin-code-changed',event=>{
    const next=String(event.detail?.code||'');if(!next)return;
    const remembered=localStorage.getItem('lattenspecialist-admin-token')===token;
    token=next;sessionStorage.setItem('lattenspecialist-admin-token',token);
    if(remembered)localStorage.setItem('lattenspecialist-admin-token',token);else localStorage.removeItem('lattenspecialist-admin-token');
  });

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);
  const formatDateTime = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || '-') : new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); };
  const formatDate = value => { if (!value || value === 'In overleg') return value || '—'; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(date); };
  const plannedMinutes = record => Number.isInteger(Number(record.plannedMinutes)) ? Number(record.plannedMinutes) : (record.service === 'Onderhoud' ? Math.max(1,Number(record.amount)||1)*60 : 0);
  const formatPlannedTime = minutes => { const value=Math.max(0,Number(minutes)||0),hours=Math.floor(value/60),rest=value%60;return hours&&rest?`${hours} u ${rest} min`:hours?`${hours} uur`:`${rest} min`; };
  const normalizeWhatsAppPhone = value => { let digits = String(value || '').replace(/\D/g,''); if (digits.startsWith('00')) digits = digits.slice(2); if (digits.startsWith('0')) digits = `31${digits.slice(1)}`; return digits; };
  const valueOrDash = value => value ? escapeHtml(value) : '—';
  const customerStatusUrl = record => /^LS-[A-Z2-9]{6}$/.test(record.serviceCode || '') ? `https://lattenspecialist.nl/app.html#status=${encodeURIComponent(record.serviceCode)}` : '';
  const headers = () => ({Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
  const pushTest=document.createElement('button');pushTest.type='button';pushTest.className='btn';pushTest.textContent='Test telefoonmelding';
  const pushTestResult=document.createElement('p');pushTestResult.setAttribute('role','status');
  refreshButton.parentElement.append(pushTest,pushTestResult);
  pushTest.addEventListener('click',async()=>{pushTest.disabled=true;pushTestResult.textContent='Test wordt gecontroleerd…';try{
    const day=new Date().toISOString().slice(0,10).replace(/-/g,''),response=await fetch(endpoint+'/api/admin/push/test',{method:'POST',headers:headers(),body:JSON.stringify({testKey:'root-deviceids-testpush-'+day})}),result=await response.json();
    if(!response.ok)throw new Error(result.message||'Test niet verstuurd.');pushTestResult.textContent=result.state==='accepted'?'Test door Google geaccepteerd. Controleer je telefoon.':'Teststatus: '+result.state+'. Niet opnieuw verzenden; controleer de verbinding.';
  }catch(error){pushTestResult.textContent=error.message;}finally{pushTest.disabled=false;}});
  const showLoginStatus = message => { loginStatus.textContent = message; loginStatus.className = 'booking-status is-visible is-error'; };
  const suggestWax = record => {
    if (record.waxType && waxOptions.includes(record.waxType)) return record.waxType;
    const conditions = String(record.conditions || '').toLowerCase();
    if (conditions.includes('zacht') || conditions.includes('warm')) return waxOptions[1];
    if (conditions.includes('vriespunt')) return waxOptions[2];
    if (conditions.includes('koud')) return waxOptions[3];
    if (conditions.includes('kunst') || conditions.includes('ijzig') || conditions.includes('hard')) return waxOptions[4];
    return waxOptions[0];
  };
  const customerMessageLines = (record, type = 'status') => {
    const firstName = String(record.name || '').split(/\s+/)[0] || '';
    const lines = type === 'payment'
      ? [`Hallo ${firstName},`,'',`Je materiaal is gereed. Het betaalverzoek van € ${Number(record.paymentAmount || 0).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})} staat hier:`,record.paymentUrl || '','Na betaling kan het materiaal worden opgehaald of teruggebracht.','',`Aanvraagcode: ${record.reference}`,'','Groet,','De Lattenspecialist']
      : [`Hallo ${firstName},`,'','De status van je aanvraag bij De Lattenspecialist is bijgewerkt:',`*${record.status || steps[Math.max(0,Number(record.currentStep || 1)-1)]}*`];
    if (type === 'status') {
      if (record.note) lines.push('',record.note);
      if (record.expectedReady) lines.push('',`Verwacht klaar: ${formatDate(record.expectedReady)}`);
      const statusUrl = customerStatusUrl(record);
      lines.push('','Bekijk je onderhoudsstatus:',statusUrl,'Deze persoonlijke link opent direct jouw onderhoud. Je hoeft niets te installeren of een code in te voeren.','','Geen statusupdates meer via WhatsApp? Laat het ons in deze chat weten.','','Groet,','De Lattenspecialist');
    }
    return lines;
  };
  const whatsappUrl = (record, type = 'status') => {
    const phone = normalizeWhatsAppPhone(record.phone);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(customerMessageLines(record,type).join('\n'))}` : '';
  };
  const smsUrl = record => {
    const phone = String(record.phone || '').replace(/[^+\d]/g,'');
    if (!phone) return '';
    const lines = customerMessageLines(record).filter(line => !line.includes('Geen statusupdates meer via WhatsApp'));
    return `sms:${phone}?body=${encodeURIComponent(lines.join('\n'))}`;
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${endpoint}${path}`, {...options, headers:{...headers(),...(options.headers || {})}, cache:'no-store'});
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { sessionStorage.removeItem('lattenspecialist-admin-token'); localStorage.removeItem('lattenspecialist-admin-token'); token = ''; throw new Error('De beheercode is niet juist.'); }
    if (!response.ok) throw new Error(result.message || 'De bewerking is niet gelukt.');
    return result;
  };

  const futureWeekendDates = () => {
    const dates = [];
    const cursor = new Date();
    cursor.setHours(12,0,0,0);
    for (let offset = 0; offset < 56; offset += 1) {
      const date = new Date(cursor); date.setDate(cursor.getDate() + offset);
      if ([5,6,0].includes(date.getDay())) dates.push(date.toISOString().slice(0,10));
    }
    return dates;
  };
  const renderAvailability = () => {
    const baseDates = futureWeekendDates();
    const allDates = [...new Set([...baseDates,...availableDates])].sort();
    availabilityCalendar.innerHTML = allDates.map(date => `<label><input type="checkbox" value="${date}"${availableDates.has(date) ? ' checked' : ''}><span>${escapeHtml(formatDate(date))}</span></label>`).join('');
    const today = new Date().toISOString().slice(0,10);
    customAvailabilityDate.min = today;
  };
  const loadAvailability = async () => {
    const result = await api('/api/admin/availability');
    availableDates = new Set(result.dates || []);
    renderAvailability();
  };
  const saveAvailability = async () => {
    const dates = [...availabilityCalendar.querySelectorAll('input:checked')].map(input => input.value);
    saveAvailabilityButton.disabled = true;
    availabilityMessage.textContent = 'Ophaaldata opslaan…';
    availabilityMessage.className = 'admin-record-message';
    try {
      const result = await api('/api/admin/availability',{method:'PATCH',body:JSON.stringify({dates})});
      availableDates = new Set(result.dates || []);
      renderAvailability();
      availabilityMessage.textContent = `${availableDates.size} beschikbare ophaaldatum${availableDates.size === 1 ? '' : 's'} opgeslagen en zichtbaar in het aanvraagformulier.`;
      availabilityMessage.className = 'admin-record-message is-success';
    } catch (error) {
      availabilityMessage.textContent = error.message;
      availabilityMessage.className = 'admin-record-message is-error';
    } finally { saveAvailabilityButton.disabled = false; }
  };

  const serviceDetails = record => record.service === 'Verhuur'
    ? [['Materiaal',record.rentaltype],['Lengte',record.height ? `${record.height} cm` : ''],['Schoenmaat',record.shoesize],['Niveau',record.level],['Periode',record.rentfrom || record.rentto ? `${record.rentfrom || '?'} t/m ${record.rentto || '?'}` : '']]
    : [['Binnengekomen via',record.sourceChannel],['Materiaal',`${record.amount || 1}× ${record.material || ''}`],['Pakket',record.package],['Logistiek',record.logistics],[String(record.logistics || '').toLowerCase().includes('zelf brengen') ? 'Brengweekend' : 'Ophaalweekend',formatDate(record.pickupDate || record.pickupday)],['Spoed',record.urgent],['Bestemming',record.destination],['Omstandigheden',record.conditions]];

  const renderRecord = record => {
    const currentStep = Math.max(1,Math.min(steps.length,Number(record.currentStep) || 1));
    const details = serviceDetails(record).filter(([,value]) => value).map(([label,value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join('');
    const stepOptions = steps.map((label,index) => `<option value="${index+1}"${index+1 === currentStep ? ' selected' : ''}>${index+1}. ${escapeHtml(label)}</option>`).join('');
    const wax = suggestWax(record);
    const waxChoices = waxOptions.map(option => `<option${option === wax ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
    const searchText = [record.reference,record.serviceCode,record.name,record.phone,record.email,record.postcode,record.address,record.material,record.package,record.rentaltype,record.status].filter(Boolean).join(' ').toLowerCase();
    const closed = Boolean(record.closedAt);
    const minutes=plannedMinutes(record);
    return `<article class="admin-record${closed ? ' is-closed' : ''}" data-stage="${recordStage(record)}" data-reference="${escapeHtml(record.reference)}" data-search="${escapeHtml(searchText)}">
      <div class="admin-record-head"><button class="admin-open-request" type="button" aria-expanded="false"><span class="admin-request-code">${escapeHtml(record.workOrderNumber || record.reference)}</span><strong>${escapeHtml(record.name || 'Naam onbekend')}</strong><span>${escapeHtml(record.service || 'Aanvraag')} · ${escapeHtml(record.amount || 1)}× ${escapeHtml(record.material || record.rentaltype || 'materiaal')} · ${escapeHtml(record.package || '')}</span><small>Bekijk ${record.workOrderNumber?'werkorder':'aanvraag'} →</small></button><div class="admin-record-badges"><span class="admin-time-pill">⏱ ${escapeHtml(formatPlannedTime(minutes))} benodigd</span><span class="admin-status-pill">${closed ? 'Afgemeld' : escapeHtml(record.status || steps[currentStep-1])}</span></div></div>
      ${Number(record.waxstickCount)>0?`<section class="admin-payment admin-waxstick" data-waxstick-reference="${escapeHtml(record.reference)}"><h3>Meebesteld · ${Number(record.waxstickCount)}× Holmenkol Natural Skiwax Stick 50 g</h3><p>€ 17,50 per stuk · bij deze opdracht meegeven.</p><p class="waxstick-handover-status" role="status" aria-live="polite">Meegeefstatus laden…</p><button class="btn btn-gold waxstick-handover" type="button" disabled>Meegeven bevestigen</button><button class="btn btn-dark waxstick-invoice" type="button">Factuur maken in Pierfinity →</button><button class="btn btn-dark waxstick-reload" type="button" hidden>Status opnieuw laden</button></section>`:''}
      <details class="admin-record-details"><summary>Open aanvraag en planning</summary><div class="admin-record-grid">
        <div class="admin-info"><h3>Contact</h3><p><a href="tel:${encodeURIComponent(record.phone || '')}">${valueOrDash(record.phone)}</a><br><a href="mailto:${encodeURIComponent(record.email || '')}">${valueOrDash(record.email)}</a><br>${valueOrDash(record.address)}</p><span class="whatsapp-permission ${record.whatsappConsent ? 'is-allowed' : 'is-missing'}">${record.whatsappConsent ? '✓ WhatsApp-statusupdates toegestaan' : 'Geen WhatsApp-toestemming vastgelegd'}</span><h3>Aanvraag</h3><div class="admin-detail-grid">${details}</div>${record.notes ? `<div class="admin-customer-note"><b>Opmerking klant</b><p>${escapeHtml(record.notes)}</p></div>` : ''}</div>
        <form class="admin-update-form">
          <h3>${record.workOrderNumber?'Werkorder '+escapeHtml(record.workOrderNumber):'Aanvraag aanvullen'}</h3>
          ${record.workOrderNumber?`<p>Aangemaakt op ${escapeHtml(formatDateTime(record.workOrderCreatedAt))} · aanvraag ${escapeHtml(record.reference)}</p>`:''}
          <label><span>Naam klant</span><input name="name" required maxlength="120" value="${escapeHtml(record.name||'')}"></label>
          <label><span>Telefoon klant</span><input name="phone" type="tel" maxlength="40" value="${escapeHtml(record.phone||'')}"></label>
          <label><span>E-mailadres klant</span><input name="email" type="email" maxlength="160" value="${escapeHtml(record.email||'')}"></label>
          <label><span>Aanvraag en aanvullende afspraken</span><textarea name="notes" maxlength="4000" rows="4">${escapeHtml(record.notes||'')}</textarea></label>
          ${!record.workOrderNumber&&record.service==='Onderhoud'&&!closed?'<p>Controleer de aanvraag en wijs het werk eventueel toe. Omzetten maakt één gekoppelde werkorder en een klantcode aan. Er wordt geen klantbericht verstuurd.</p><button class="btn btn-gold" type="submit" data-action="workorder">Omzetten naar werkorder</button>':''}
          <label><span>Toegewezen medewerker</span><select name="assignedTo">${window.LattenspecialistTeam?.options(record.assignedTo) || '<option value="">Nog niet toegewezen</option>'}</select></label>
          ${record.workNote ? `<div class="team-work-note"><b>Werknotitie medewerker</b><p>${escapeHtml(record.workNote)}</p></div>` : ''}
          ${record.workOrderNumber?'<button class="btn btn-gold open-workorder-workspace" type="button">Werkzaamheden en foto’s openen</button>':''}
          <button class="btn btn-dark team-history" type="button">Bekijk werklogboek</button><div class="team-audit" hidden></div>
          <label><span>Servicecode voor klant</span><div class="admin-code-row"><input name="serviceCode" value="${escapeHtml(record.serviceCode || '')}" placeholder="Nog niet toegekend" readonly><button class="btn btn-dark generate-code" type="button"${record.serviceCode ? ' hidden' : ''}>Maak code</button></div></label>
          <div><button class="btn btn-dark create-material-labels" type="button">Maak / bekijk QR-stickers</button><div class="material-labels" role="status"></div></div>
          ${customerStatusUrl(record) ? `<div class="admin-customer-link"><label><span>Persoonlijke klantlink</span><input class="customer-status-link" type="text" value="${escapeHtml(customerStatusUrl(record))}" readonly aria-label="Persoonlijke klantlink"></label><div class="admin-save-actions"><button class="btn btn-dark copy-customer-link" type="button">Kopieer klantlink</button><a class="btn btn-dark" href="${escapeHtml(customerStatusUrl(record))}" target="_blank" rel="noopener noreferrer">Bekijk klantomgeving</a></div><small>Opent direct het onderhoud op Android en iPhone. Installeren is niet nodig. Deel deze link alleen met deze klant. Sla wijzigingen op voordat je de link deelt.</small><p class="customer-link-message" role="status"></p></div>` : '<p class="field-hint">Maak een servicecode om de persoonlijke klantlink te krijgen. Bij “Opslaan + klant berichten” gebeurt dit automatisch.</p>'}
          <label><span>Voortgang</span><select name="currentStep">${stepOptions}</select></label>
          <label><span>Wax voor deze beurt</span><select name="waxType">${waxChoices}</select><small class="field-hint">Voorstel op basis van de opgegeven omstandigheden; controleer dit zelf.</small></label>
          <label><span>Verwacht klaar</span><input type="date" name="expectedReady" value="${escapeHtml(record.expectedReady || '')}"></label>
          <label><span>Gereserveerde werktijd</span><input type="number" name="plannedMinutes" min="15" max="2400" step="15" value="${minutes}"><small class="field-hint">Totaal voor deze aanvraag in minuten. Automatisch 60 minuten per paar.</small></label>
          <label><span>Bericht voor klant</span><textarea name="note" rows="3" maxlength="320" placeholder="Bijvoorbeeld: de kanten zijn gecontroleerd.">${escapeHtml(record.note || '')}</textarea></label>
          <label class="admin-consent-confirm"><input type="checkbox" name="whatsappConsent"${record.whatsappConsent ? ' checked' : ''}><span>Klant heeft toestemming gegeven voor WhatsApp-statusupdates</span><small>Alleen aanvinken na mondelinge of schriftelijke toestemming.</small></label>
          <details class="customer-message-actions"><summary>Klant berichten</summary><p>Kies hoe je deze klant wilt informeren. WhatsApp en sms openen met een ingevuld bericht; jij controleert en verstuurt het.</p><div><button class="btn message-whatsapp" type="submit" data-action="whatsapp"${record.whatsappConsent ? '' : ' disabled'}>WhatsApp openen</button><button class="btn message-sms" type="submit" data-action="sms">Sms openen</button><button class="btn btn-dark" type="submit" data-action="email"${record.email ? '' : ' disabled'}>E-mail automatisch versturen</button></div>${record.whatsappConsent ? '' : '<small>WhatsApp is niet beschikbaar omdat toestemming ontbreekt.</small>'}${record.email ? '' : '<small>E-mail is niet beschikbaar omdat bij deze aanvraag geen e-mailadres is ingevuld.</small>'}</details>
          <div class="admin-save-actions"><button class="btn btn-gold save-record" type="submit" data-action="save">Wijzigingen opslaan</button><button class="btn btn-dark discard-request" type="button" hidden>Wijzigingen verwerpen en herladen</button></div>
          <section class="admin-payment"><h3>Betaalverzoek</h3><div class="payment-fields"><label><span>Bedrag (€)</span><input name="paymentAmount" inputmode="decimal" placeholder="44,95" value="${escapeHtml(String(record.paymentAmount || '').replace('.',','))}"></label><label><span>Betaallink</span><input name="paymentUrl" type="url" placeholder="https://…" value="${escapeHtml(record.paymentUrl || '')}"></label></div><button class="btn btn-dark save-record" type="submit" data-action="payment">Betaalverzoek e-mailen</button></section>
          <button class="admin-close-button" type="submit" data-action="close">${closed ? 'Aanvraag opnieuw openen' : 'Aanvraag afmelden'}</button>
          <div class="admin-record-message" role="status" aria-live="polite"></div>
        </form>
      </div></details>
    </article>`;
  };

  function showWaxstickHandover(panel,state){
    const status=panel.querySelector('.waxstick-handover-status'),button=panel.querySelector('.waxstick-handover');
    button.hidden=!state.remaining;button.disabled=!state.remaining;
    button.textContent=`${state.remaining} waxstick${state.remaining===1?'':'s'} meegegeven · bevestigen`;
    status.textContent=state.remaining?`${state.ordered} besteld · ${state.delivered} meegegeven · ${state.remaining} nog mee te geven. ${state.legacyBooked?`${state.legacyBooked} al van de voorraad afgeboekt via de werkplaats; dit wordt niet dubbel geboekt. Bevestig hier het daadwerkelijk meegeven.`:'Voorraad wordt pas na bevestiging afgeboekt.'}`:`${state.delivered} waxstick${state.delivered===1?'':'s'} meegegeven${state.handedOverAt?' op '+formatDateTime(state.handedOverAt):''}. Voorraad is afgeboekt.${state.legacyBooked?' Eerdere werkplaatsboeking is meegenomen.':''}`;
    panel.querySelector('.waxstick-reload').hidden=true;
  }
  async function loadWaxstickHandover(panel){
    const invoice=panel.querySelector('.waxstick-invoice');if(invoice&&!invoice.dataset.mounted){invoice.dataset.mounted='true';invoice.addEventListener('click',async()=>{invoice.disabled=true;try{const result=await api('/api/admin/accounting/maintenance-transfer/'+encodeURIComponent(panel.dataset.waxstickReference),{method:'POST',body:'{}'});if(typeof result.url!=='string'||!result.url.startsWith('https://app.pierfinity.nl/?maintenanceInvoice=1#transfer='))throw new Error('De veilige factuurkoppeling is niet beschikbaar.');location.assign(result.url);}catch(error){panel.querySelector('.waxstick-handover-status').textContent=error.message;invoice.disabled=false;}});}
    const button=panel.querySelector('.waxstick-handover'),retry=panel.querySelector('.waxstick-reload'),status=panel.querySelector('.waxstick-handover-status');
    if(!panel.dataset.mounted){panel.dataset.mounted='true';retry.addEventListener('click',()=>void loadWaxstickHandover(panel));button.addEventListener('click',async()=>{
      button.disabled=true;retry.hidden=true;status.textContent='Meegeven en voorraad opslaan…';
      try{const state=await api('/api/admin/inventory/waxsticks/'+encodeURIComponent(panel.dataset.waxstickReference),{method:'POST',body:JSON.stringify({confirmed:true})});if(panel.isConnected)showWaxstickHandover(panel,state);window.dispatchEvent(new Event('lattenspecialist:inventory-updated'));}
      catch(error){if(panel.isConnected){status.textContent=error.message;retry.hidden=false;}}
    });}
    button.disabled=true;
    try{const state=await api('/api/admin/inventory/waxsticks/'+encodeURIComponent(panel.dataset.waxstickReference));if(panel.isConnected)showWaxstickHandover(panel,state);}
    catch(error){if(panel.isConnected){status.textContent=error.message;retry.hidden=false;}}
  }
  const applySearch = () => {
    const query=search.value.trim().toLowerCase();let visible=0;
    list.querySelectorAll('.admin-record').forEach(card=>{const matches=activeFilter==='open'?card.dataset.stage!=='closed':card.dataset.stage===activeFilter;card.hidden=!matches||Boolean(query&&!card.dataset.search.includes(query));if(!card.hidden)visible++;});
    orderFilters.replaceChildren(...Object.entries(filterLabels).map(([key,label])=>{const button=document.createElement('button');button.type='button';button.dataset.orderFilter=key;button.setAttribute('aria-pressed',String(activeFilter===key));const count=records.filter(record=>key==='open'?recordStage(record)!=='closed':recordStage(record)===key).length;button.textContent=label+' · '+count;return button;}));
    listStatus.textContent=visible?`${visible} ${visible===1?'opdracht':'opdrachten'} getoond`:'Geen opdrachten gevonden. Kies een ander filter of pas je zoekopdracht aan.';
  };
  const render = () => {
    const focused=list.contains(document.activeElement)?document.activeElement:null;
    const selection=focused&&typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;
    const workspaces=new Map([...list.querySelectorAll('.workorder-workspace')].map(host=>[host.closest('.admin-record').dataset.reference,host]));
    const preserved=new Map([...list.querySelectorAll('.admin-record')].filter(card=>dirtyRequests.has(card.dataset.reference)).map(card=>[card.dataset.reference,card]));
    const expanded=new Set([...list.querySelectorAll('.admin-record-details[open]')].map(detail=>detail.closest('.admin-record').dataset.reference));
    renderRequestAlert();
    const open = records.filter(record => !record.closedAt).length;
    const active = records.filter(record => recordStage(record)==='work').length;
    const withoutCode = records.filter(record => !record.closedAt && !record.serviceCode).length;
    const reservedMinutes=records.filter(record=>!record.closedAt&&Number(record.currentStep||1)<steps.length).reduce((total,record)=>total+plannedMinutes(record),0);
    summary.innerHTML = `<span><b>${open}</b> open</span><span><b>${formatPlannedTime(reservedMinutes)}</b> benodigde tijd</span><span><b>${active}</b> in behandeling</span><span><b>${withoutCode}</b> zonder servicecode</span>`;
    list.innerHTML = records.length ? [...records].sort((a,b)=>['new','planned','work','ready','closed'].indexOf(recordStage(a))-['new','planned','work','ready','closed'].indexOf(recordStage(b))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(renderRecord).join('') : '<div class="admin-empty"><strong>Nog geen websiteaanvragen</strong><p>Nieuwe aanvragen verschijnen hier automatisch.</p></div>';
    for(const card of list.querySelectorAll('.admin-record')){const old=preserved.get(card.dataset.reference);if(old)card.replaceWith(old);else{if(expanded.has(card.dataset.reference))card.querySelector('.admin-record-details').open=true;const workspace=workspaces.get(card.dataset.reference);if(workspace)card.append(workspace);}}
    for(const detail of list.querySelectorAll('.admin-record-details'))detail.closest('.admin-record').querySelector('.admin-open-request')?.setAttribute('aria-expanded',String(detail.open));
    list.querySelectorAll('[data-waxstick-reference]').forEach(panel=>void loadWaxstickHandover(panel));
    applySearch();
    if(focused?.isConnected){focused.focus({preventScroll:true});if(selection)focused.setSelectionRange(...selection);}
  };

  list.addEventListener('toggle',event=>{if(event.target.matches('.admin-record-details'))event.target.closest('.admin-record').querySelector('.admin-open-request')?.setAttribute('aria-expanded',String(event.target.open));},true);
  list.addEventListener('click',event=>{const button=event.target.closest('.admin-open-request');if(button){const detail=button.closest('.admin-record').querySelector('.admin-record-details');detail.open=!detail.open;button.setAttribute('aria-expanded',String(detail.open));}});
  list.addEventListener('click',async event=>{const button=event.target.closest('.discard-request');if(!button)return;const card=button.closest('.admin-record'),reference=card.dataset.reference;button.disabled=true;try{const result=await api('/api/admin/reservations');const latest=result.records?.find(record=>record.reference===reference);if(!latest)throw new Error('Deze aanvraag is niet meer beschikbaar.');dirtyRequests.delete(reference);card.removeAttribute('data-unsaved');records=records.map(record=>record.reference===reference?latest:record);render();syncStatus.textContent='Aanvraag herladen; lokale wijzigingen zijn verworpen.';}catch(error){button.disabled=false;syncStatus.textContent=error.message;}});
  window.addEventListener('lattenspecialist:workorder-opened',()=>{activeFilter='open';applySearch();});
  let metricsVersion = 0;
  const loadMetrics = async () => {
    const target = document.querySelector('#websiteMetrics');
    const version = ++metricsVersion;
    const auth = token;
    const days = document.querySelector('#metricsPeriod').value;
    target.textContent = 'Tellingen laden…';
    try {
      const result = await api('/api/admin/metrics?days=' + days);
      if (version !== metricsVersion || token !== auth) return;
      const labels = {packages_viewed:'Pakketten bekeken',form_opened:'Formulier geopend',form_started:'Invullen gestart',booking_submitted:'Aanvraag verstuurd'};
      target.replaceChildren(...Object.entries(labels).map(([key,label]) => {
        const item = document.createElement('div'), value = document.createElement('strong'), caption = document.createElement('span');
        value.textContent = Number(result.totals?.[key] || 0).toLocaleString('nl-NL');
        caption.textContent = label; item.append(value,caption); return item;
      }));
    } catch { if (version === metricsVersion && token === auth) target.textContent = 'Tellingen tijdelijk niet beschikbaar. Je kunt de reserveringen gewoon beheren.'; }
  };
  document.querySelector('#metricsPeriod').addEventListener('change', loadMetrics);
  const updateManualAddress = () => {
    const pickup = false;
    manualAddress.hidden = !pickup;
    manualAddress.querySelectorAll('input').forEach(input => { input.required = pickup; input.disabled = !pickup; });
  };
  let pendingManualOpen = false;
  let pendingManualMaterial = '';
  const openManualRequest = material => { manualForm.reset(); manualSelection.reset(); manualStatus.textContent='';updateManualAddress();manualDialog.showModal();manualForm.elements.name.focus(); };
  const requestManualOpen = material => {
    pendingManualOpen = true;
    pendingManualMaterial = material || '';
    if (dashboard.hidden) return;
    const chosenMaterial = pendingManualMaterial;
    pendingManualOpen = false;
    pendingManualMaterial = '';
    openManualRequest(chosenMaterial);
  };
  document.querySelector('#newAdminRequest').addEventListener('click',()=>requestManualOpen(''));
  window.addEventListener('lattenspecialist:new-request',event=>requestManualOpen(event.detail?.material||''));
  manualDialog.querySelector('.manual-request-close').addEventListener('click',()=>manualDialog.close());
  manualDialog.querySelector('.manual-request-cancel').addEventListener('click',()=>manualDialog.close());
  manualForm.elements.logistics.addEventListener('change',updateManualAddress);
  const lookupManualAddress = async () => {
    const postcode=manualForm.elements.postcode.value.toUpperCase().replace(/\s+/g,'');const houseNumber=manualForm.elements.houseNumber.value.trim();
    if(!/^\d{4}[A-Z]{2}$/.test(postcode)||!/^\d{1,5}/.test(houseNumber))return;
    manualAddressController?.abort();manualAddressController=new AbortController();manualAddressStatus.textContent='Adres zoeken…';
    try{const response=await fetch(`${endpoint}/api/address?postcode=${encodeURIComponent(postcode)}&houseNumber=${encodeURIComponent(houseNumber)}`,{cache:'no-store',signal:manualAddressController.signal});const result=await response.json().catch(()=>({}));if(!response.ok||!result.address?.address)throw new Error(result.message||'Adres niet gevonden.');manualForm.elements.postcode.value=result.address.postcode;manualForm.elements.houseNumber.value=result.address.houseNumber;manualForm.elements.address.value=result.address.address;manualForm.elements.addressCity.value=result.address.city;manualAddressStatus.textContent=result.address.freePickup?'Adres gevonden · binnen gratis servicegebied':'Adres gevonden · buiten gratis servicegebied';manualAddressStatus.className=`address-status ${result.address.freePickup?'is-success':'is-error'}`;}catch(error){if(error.name!=='AbortError'){manualForm.elements.address.value='';manualAddressStatus.textContent=error.message;manualAddressStatus.className='address-status is-error';}}
  };
  ['postcode','houseNumber'].forEach(name=>manualForm.elements[name].addEventListener('input',()=>{clearTimeout(manualAddressTimer);manualForm.elements.address.value='';manualAddressTimer=setTimeout(lookupManualAddress,450);}));
  manualForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (!manualForm.reportValidity()) return;
    const values=Object.fromEntries(new FormData(manualForm));
    const chosen=manualSelection.get();if(!chosen){manualStatus.textContent='Kies minimaal één geldig pakket of losse werkzaamheid.';return;}
    const extraNotes=[chosen.notes,values.planningMoment?`Voorkeursmoment: ${values.planningMoment}`:'',values.notes||''].filter(Boolean).join('\n');
    const submit=manualForm.querySelector('[type="submit"]');submit.disabled=true;manualStatus.textContent='Aanvraag opslaan…';manualStatus.className='admin-record-message';
    try {
      const result=await api('/api/admin/reservations',{method:'POST',body:JSON.stringify({...values,...chosen.legacy,maintenanceSelection:JSON.stringify(chosen.selection),service:'Onderhoud',pickupDate:values.pickupDate||'In overleg',urgent:chosen.legacy.urgent,notes:extraNotes,whatsappConsent:manualForm.elements.whatsappConsent.checked})});
      records.unshift(result.record);render();manualDialog.close();
      const card=document.querySelector(`[data-reference="${CSS.escape(result.record.reference)}"]`);card?.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error){manualStatus.textContent=error.message;manualStatus.className='admin-record-message is-error';}
    finally{submit.disabled=false;}
  });
  const loadDashboard = async () => {
    if (!endpoint) throw new Error('De beheerservice is nog niet gekoppeld.');
    refreshButton.disabled = true;
    if(!records.length)list.innerHTML = '<div class="admin-empty"><strong>Reserveringen laden…</strong></div>';
    try {
      const [reservationResult] = await Promise.all([api('/api/admin/reservations'),loadAvailability(),window.LattenspecialistTeam?.init(api,render)]);
      records = (reservationResult.records || []).map(record=>dirtyRequests.has(record.reference)?records.find(old=>old.reference===record.reference)||record:record);
      loginSection.hidden = true; dashboard.hidden = false; logoutButton.hidden = false; render(); await window.LattenspecialistOperations?.init(api,()=>records); void loadMetrics();
      if (pendingManualOpen) requestManualOpen(pendingManualMaterial);
      window.dispatchEvent(new CustomEvent('lattenspecialist:widget-refresh'));
    } finally { refreshButton.disabled = false; }
  };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); loginStatus.className = 'booking-status'; token = String(new FormData(loginForm).get('token') || '').trim();
    try { await loadDashboard(); sessionStorage.setItem('lattenspecialist-admin-token',token); if (loginForm.elements.remember.checked) localStorage.setItem('lattenspecialist-admin-token',token); else localStorage.removeItem('lattenspecialist-admin-token'); loginForm.reset();window.dispatchEvent(new CustomEvent('lattenspecialist:widget-refresh')); }
    catch (error) { showLoginStatus(error.message); }
  });

  list.addEventListener('click', async event => {
    const historyButton=event.target.closest('.team-history');
    if(historyButton){const card=historyButton.closest('.admin-record'),target=card.querySelector('.team-audit');target.hidden=false;target.textContent='Logboek laden…';try{const result=await api('/api/admin/team/audit?reference='+encodeURIComponent(card.dataset.reference));target.textContent=result.events.map(item=>`${formatDateTime(item.created_at)} · ${item.actor==='owner'?'Beheer':'Medewerker'} · ${steps[item.current_step-1] || ''} · ${item.wax_type || ''}${item.work_note?'\n'+item.work_note:''}`).join('\n\n') || 'Nog geen wijzigingen geregistreerd.';}catch(error){target.textContent=error.message;}return;}
    const copyButton = event.target.closest('.copy-customer-link');
    if (copyButton) {
      const section = copyButton.closest('.admin-customer-link');
      const input = section.querySelector('.customer-status-link');
      const feedback = section.querySelector('.customer-link-message');
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(input.value);
        feedback.textContent = 'Klantlink gekopieerd. Je kunt hem in het bericht aan deze klant plakken.';
      } catch {
        input.focus(); input.select();
        feedback.textContent = 'De link is geselecteerd. Kies Kopiëren in het menu van je telefoon of gebruik Ctrl+C.';
      }
      return;
    }
    const button = event.target.closest('.generate-code'); if (!button) return;
    const card = button.closest('.admin-record'); const message = card.querySelector('.admin-record-message'); button.disabled = true; message.textContent = 'Servicecode maken…';
    try { const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`,{method:'PATCH',body:JSON.stringify({generateServiceCode:true,revision:records.find(r=>r.reference===card.dataset.reference)?.revision ?? 0})}); records = records.map(record => record.reference === result.record.reference ? result.record : record); render(); }
    catch (error) { message.textContent = error.message; message.className = 'admin-record-message is-error'; button.disabled = false; }
  });

  list.addEventListener('submit', async event => {
    const form = event.target.closest('.admin-update-form'); if (!form) return; event.preventDefault();
    const card = form.closest('.admin-record'); const message = form.querySelector('.admin-record-message'); const buttons = [...form.querySelectorAll('button')];
    const action = event.submitter?.dataset.action || 'save'; const existing = records.find(record => record.reference === card.dataset.reference); const values = Object.fromEntries(new FormData(form)); const currentStep = Number(values.currentStep);
    if (action === 'whatsapp' && !form.elements.whatsappConsent.checked) { message.textContent = 'WhatsApp kan alleen na toestemming van de klant.'; message.className = 'admin-record-message is-error'; return; }
    if (action === 'email' && !existing?.email) { message.textContent = 'Bij deze aanvraag is geen e-mailadres ingevuld.'; message.className = 'admin-record-message is-error'; return; }
    const payload = {name:values.name,phone:values.phone,email:values.email,notes:values.notes,serviceCode:values.serviceCode,currentStep,status:steps[currentStep-1],expectedReady:values.expectedReady,plannedMinutes:Number(values.plannedMinutes),note:values.note,waxType:values.waxType,whatsappConsent:form.elements.whatsappConsent.checked,paymentAmount:String(values.paymentAmount || '').replace(',','.'),paymentUrl:values.paymentUrl};
    payload.revision=existing?.revision ?? 0;payload.assignedTo=values.assignedTo || '';
    if (action === 'email') payload.sendStatusEmail = true;
    if (action === 'payment') { payload.sendPaymentEmail = true; payload.sendWhatsApp = true; payload.notificationType = 'payment'; }
    if (action === 'close') payload.closed = !existing?.closedAt;
    if (action === 'workorder') payload.convertToWorkOrder = true;
    buttons.forEach(button => { button.disabled = true; }); message.textContent = action === 'payment' ? 'Betaalverzoek versturen…' : 'Opslaan…'; message.className = 'admin-record-message';
    try {
      const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`,{method:'PATCH',body:JSON.stringify(payload)});
      dirtyRequests.delete(result.record.reference);card.removeAttribute('data-unsaved');
      records = records.map(record => record.reference === result.record.reference ? result.record : record); render();
      const updated = document.querySelector(`[data-reference="${CSS.escape(result.record.reference)}"]`); const updatedMessage = updated?.querySelector('.admin-record-message');
      if (!updatedMessage) return;
      if(action==='workorder'){activeFilter='planned';applySearch();}
      let messageText = action==='workorder'?'Werkorder aangemaakt. De aanvraag, materialen en historie blijven gekoppeld.':'Opgeslagen.';
      if (action === 'email') messageText = result.notifications?.email?.sent ? 'Opgeslagen en status per e-mail verstuurd.' : 'Opgeslagen; de status-e-mail kon niet worden verstuurd.';
      if (action === 'payment') messageText = result.notifications?.paymentEmail?.sent ? 'Betaalverzoek per e-mail verstuurd.' : `Opgeslagen; betaalmail niet verstuurd (${result.notifications?.paymentEmail?.reason || 'controleer de gegevens'}).`;
      if (action === 'close') messageText = result.record.closedAt ? 'Aanvraag afgemeld.' : 'Aanvraag opnieuw geopend.';
      updatedMessage.textContent = messageText; updatedMessage.className = 'admin-record-message is-success';
      if (action === 'whatsapp') {
        const url = whatsappUrl(result.record);
        if (url) window.location.href = url;
        else { updatedMessage.textContent = 'Opgeslagen, maar het WhatsApp-nummer is niet geldig.'; updatedMessage.className = 'admin-record-message is-error'; }
      }
      if (action === 'sms') {
        const url = smsUrl(result.record);
        if (url) window.location.href = url;
        else { updatedMessage.textContent = 'Opgeslagen, maar het telefoonnummer is niet geldig.'; updatedMessage.className = 'admin-record-message is-error'; }
      }
      const whatsAppSent = result.notifications?.whatsapp?.sent;
      if (action === 'payment' && result.record.whatsappConsent && !whatsAppSent) {
        const link = document.createElement('a'); link.href = whatsappUrl(result.record,action === 'payment' ? 'payment' : 'status'); link.target = '_blank'; link.rel = 'noopener'; link.className = 'btn whatsapp-launch'; link.textContent = 'Open WhatsApp en verstuur'; updatedMessage.append(link);
      } else if (whatsAppSent) updatedMessage.append(document.createTextNode(' WhatsApp is automatisch verstuurd.'));
    } catch (error) { message.textContent = error.message; message.className = 'admin-record-message is-error'; buttons.forEach(button => { button.disabled = false; }); }
  });

  saveAvailabilityButton.addEventListener('click',saveAvailability);
  addAvailabilityButton.addEventListener('click',() => { const date = customAvailabilityDate.value; if (!date) return; availableDates.add(date); renderAvailability(); customAvailabilityDate.value = ''; });
  search.addEventListener('input',applySearch);
  refreshButton.addEventListener('click',() => loadDashboard().catch(error => { syncStatus.textContent='Bijwerken mislukt: '+error.message+' Je invoer is bewaard.'; }));
  logoutButton.addEventListener('click',() => { sessionStorage.removeItem('lattenspecialist-admin-token'); localStorage.removeItem('lattenspecialist-admin-token'); token=''; records=[];dirtyRequests.clear();list.replaceChildren();orderFilters.replaceChildren();listStatus.textContent='';syncStatus.textContent='';window.LattenspecialistTeam?.clear();window.LattenspecialistOperations?.clear(); dashboard.hidden=true; logoutButton.hidden=true; loginSection.hidden=false;window.dispatchEvent(new CustomEvent('lattenspecialist:widget-refresh')); });

  let installPrompt; const installButton = document.querySelector('#installAdmin');
  window.addEventListener('beforeinstallprompt',event => { event.preventDefault(); installPrompt=event; installButton.hidden=false; });
  installButton.addEventListener('click',async() => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt=null; installButton.hidden=true; });
  if ('serviceWorker' in navigator) window.addEventListener('load',() => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  if (token) loadDashboard().catch(error => { loginSection.hidden=false; dashboard.hidden=true; logoutButton.hidden=true; showLoginStatus(error.message); });
})();
