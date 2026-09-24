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
  let token = sessionStorage.getItem('lattenspecialist-admin-token') || localStorage.getItem('lattenspecialist-admin-token') || '';
  let records = [];
  let availableDates = new Set();

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);
  const formatDateTime = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || '-') : new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); };
  const formatDate = value => { if (!value || value === 'In overleg') return value || '—'; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(date); };
  const valueOrDash = value => value ? escapeHtml(value) : '—';
  const customerStatusUrl = record => /^[a-f0-9]{64}$/.test(record.customerToken || '') ? `https://lattenspecialist.nl/app.html#klant=${record.customerToken}` : /^LS-[A-Z2-9]{6}$/.test(record.serviceCode || '') ? `https://lattenspecialist.nl/app.html#status=${encodeURIComponent(record.serviceCode)}` : '';
  const headers = () => ({Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
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
    : [['Materiaal',`${record.amount || 1}× ${record.material || ''}`],['Pakket',record.package],['Logistiek',record.logistics],['Ophaaldatum',formatDate(record.pickupDate || record.pickupday)],['Spoed',record.urgent],['Bestemming',record.destination],['Eerste skidag',formatDate(record.skidate)],['Omstandigheden',record.conditions]];

  const renderRecord = record => {
    const currentStep = Math.max(1,Math.min(steps.length,Number(record.currentStep) || 1));
    const details = serviceDetails(record).filter(([,value]) => value).map(([label,value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join('');
    const stepOptions = steps.map((label,index) => `<option value="${index+1}"${index+1 === currentStep ? ' selected' : ''}>${index+1}. ${escapeHtml(label)}</option>`).join('');
    const wax = suggestWax(record);
    const waxChoices = waxOptions.map(option => `<option${option === wax ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
    const searchText = [record.reference,record.serviceCode,record.name,record.phone,record.email,record.postcode,record.address,record.material,record.package,record.rentaltype,record.status].filter(Boolean).join(' ').toLowerCase();
    const closed = Boolean(record.closedAt);
    return `<article class="admin-record${closed ? ' is-closed' : ''}" data-reference="${escapeHtml(record.reference)}" data-search="${escapeHtml(searchText)}">
      <div class="admin-record-head"><div><span class="admin-request-code">${escapeHtml(record.reference)}</span><h2>${escapeHtml(record.name || 'Naam onbekend')}</h2><p>${escapeHtml(record.service || 'Aanvraag')} · ontvangen ${escapeHtml(formatDateTime(record.createdAt))}${closed ? ` · afgemeld ${escapeHtml(formatDateTime(record.closedAt))}` : ''}</p></div><span class="admin-status-pill">${closed ? 'Afgemeld' : escapeHtml(record.status || steps[currentStep-1])}</span></div>
      <div class="admin-record-grid">
        <div class="admin-info"><h3>Contact</h3><p><a href="tel:${encodeURIComponent(record.phone || '')}">${valueOrDash(record.phone)}</a><br><a href="mailto:${encodeURIComponent(record.email || '')}">${valueOrDash(record.email)}</a><br>${valueOrDash(record.address)}</p><h3>Aanvraag</h3><div class="admin-detail-grid">${details}</div>${record.notes ? `<div class="admin-customer-note"><b>Opmerking klant</b><p>${escapeHtml(record.notes)}</p></div>` : ''}</div>
        <form class="admin-update-form">
          <h3>Onderhoud registreren</h3>
          <label><span>Servicecode voor klant</span><div class="admin-code-row"><input name="serviceCode" value="${escapeHtml(record.serviceCode || '')}" placeholder="Nog niet toegekend" readonly><button class="btn btn-dark generate-code" type="button"${record.serviceCode ? ' hidden' : ''}>Maak code</button></div></label>
          ${customerStatusUrl(record) ? `<div class="admin-customer-link"><label><span>Persoonlijke klantlink</span><input class="customer-status-link" type="text" value="${escapeHtml(customerStatusUrl(record))}" readonly aria-label="Persoonlijke klantlink"></label><div class="admin-save-actions"><button class="btn btn-dark copy-customer-link" type="button">Kopieer klantlink</button><a class="btn btn-dark" href="${escapeHtml(customerStatusUrl(record))}" target="_blank" rel="noopener noreferrer">Bekijk klantomgeving</a></div><small>Opent direct het onderhoud op Android en iPhone. Installeren is niet nodig. Deel deze link alleen met deze klant. Sla wijzigingen op voordat je de link deelt.</small><p class="customer-link-message" role="status"></p></div>` : '<p class="field-hint">Maak een servicecode om de persoonlijke klantlink te krijgen. Bij “Opslaan voor klant” gebeurt dit automatisch.</p>'}
          <label><span>Voortgang</span><select name="currentStep">${stepOptions}</select></label>
          <label><span>Wax voor deze beurt</span><select name="waxType">${waxChoices}</select><small class="field-hint">Voorstel op basis van de opgegeven omstandigheden; controleer dit zelf.</small></label>
          <label><span>Verwacht klaar</span><input type="date" name="expectedReady" value="${escapeHtml(record.expectedReady || '')}"></label>
          <label><span>Bericht voor klant</span><textarea name="note" rows="3" maxlength="320" placeholder="Bijvoorbeeld: de kanten zijn gecontroleerd.">${escapeHtml(record.note || '')}</textarea></label>
          <div class="admin-save-actions"><button class="btn btn-gold save-record" type="submit" data-action="save">Opslaan voor klant</button></div><p class="field-hint">Bij een gewijzigde status krijgt de klant een appmelding als die op het toestel is ingeschakeld.</p>
          <section class="admin-payment"><h3>Betaalverzoek</h3><div class="payment-fields"><label><span>Bedrag (€)</span><input name="paymentAmount" inputmode="decimal" placeholder="44,95" value="${escapeHtml(String(record.paymentAmount || '').replace('.',','))}"></label><label><span>Betaallink</span><input name="paymentUrl" type="url" placeholder="https://…" value="${escapeHtml(record.paymentUrl || '')}"></label></div><p class="field-hint">${record.paymentRequestedAt ? 'Dit verzoek staat in de klantomgeving. Na wijziging van bedrag of link moet je het opnieuw klaarzetten.' : 'Bedrag en link zijn een concept tot je het betaalverzoek klaarzet.'}</p><label class="admin-consent-confirm"><input type="checkbox" name="paymentPaid"${record.paymentPaidAt ? ' checked' : ''}><span>Betaling ontvangen en gecontroleerd</span><small>Alleen aanvinken na controle bij je bank. Klik daarna op Opslaan voor klant.</small></label><button class="btn btn-dark save-record" type="submit" data-action="payment"${closed ? ' disabled' : ''}>Betaalverzoek klaarzetten in klantapp</button></section>
          <button class="admin-close-button" type="submit" data-action="close">${closed ? 'Aanvraag opnieuw openen' : 'Aanvraag afmelden'}</button>
          <div class="admin-record-message" role="status" aria-live="polite"></div>
        </form>
      </div>
    </article>`;
  };

  const applySearch = () => { const query = search.value.trim().toLowerCase(); document.querySelectorAll('.admin-record').forEach(card => { card.hidden = Boolean(query && !card.dataset.search.includes(query)); }); };
  const render = () => {
    const open = records.filter(record => !record.closedAt).length;
    const active = records.filter(record => !record.closedAt && Number(record.currentStep || 1) < steps.length).length;
    const withoutCode = records.filter(record => !record.closedAt && !record.serviceCode).length;
    summary.innerHTML = `<span><b>${open}</b> open</span><span><b>${active}</b> in behandeling</span><span><b>${withoutCode}</b> zonder servicecode</span>`;
    list.innerHTML = records.length ? records.map(renderRecord).join('') : '<div class="admin-empty"><strong>Nog geen websiteaanvragen</strong><p>Nieuwe aanvragen verschijnen hier automatisch.</p></div>';
    applySearch();
  };

  const loadDashboard = async () => {
    if (!endpoint) throw new Error('De beheerservice is nog niet gekoppeld.');
    refreshButton.disabled = true;
    list.innerHTML = '<div class="admin-empty"><strong>Reserveringen laden…</strong></div>';
    try {
      const [reservationResult] = await Promise.all([api('/api/admin/reservations'),loadAvailability()]);
      records = reservationResult.records || [];
      loginSection.hidden = true; dashboard.hidden = false; logoutButton.hidden = false; render();
    } finally { refreshButton.disabled = false; }
  };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); loginStatus.className = 'booking-status'; token = String(new FormData(loginForm).get('token') || '').trim();
    try { await loadDashboard(); sessionStorage.setItem('lattenspecialist-admin-token',token); if (loginForm.elements.remember.checked) localStorage.setItem('lattenspecialist-admin-token',token); else localStorage.removeItem('lattenspecialist-admin-token'); loginForm.reset(); }
    catch (error) { showLoginStatus(error.message); }
  });

  list.addEventListener('click', async event => {
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
    try { const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`,{method:'PATCH',body:JSON.stringify({generateServiceCode:true})}); records = records.map(record => record.reference === result.record.reference ? result.record : record); render(); }
    catch (error) { message.textContent = error.message; message.className = 'admin-record-message is-error'; button.disabled = false; }
  });

  list.addEventListener('submit', async event => {
    const form = event.target.closest('.admin-update-form'); if (!form) return; event.preventDefault();
    const card = form.closest('.admin-record'); const message = form.querySelector('.admin-record-message'); const buttons = [...form.querySelectorAll('button')];
    const action = event.submitter?.dataset.action || 'save'; const existing = records.find(record => record.reference === card.dataset.reference); const values = Object.fromEntries(new FormData(form)); const currentStep = Number(values.currentStep);
    const payload = {serviceCode:values.serviceCode,currentStep,status:steps[currentStep-1],expectedReady:values.expectedReady,note:values.note,waxType:values.waxType,paymentAmount:String(values.paymentAmount || '').replace(',','.'),paymentUrl:values.paymentUrl,paymentPaid:form.elements.paymentPaid.checked};
    if (action === 'payment') payload.publishPayment = true;
    if (action === 'close') payload.closed = !existing?.closedAt;
    buttons.forEach(button => { button.disabled = true; }); message.textContent = action === 'payment' ? 'Betaalverzoek versturen…' : 'Opslaan…'; message.className = 'admin-record-message';
    try {
      const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`,{method:'PATCH',body:JSON.stringify(payload)});
      records = records.map(record => record.reference === result.record.reference ? result.record : record); render();
      const updated = document.querySelector(`[data-reference="${CSS.escape(result.record.reference)}"]`); const updatedMessage = updated?.querySelector('.admin-record-message');
      if (!updatedMessage) return;
      let messageText = 'Opgeslagen. De voortgang is zichtbaar in de klantenapp.';
      if (action === 'payment') messageText = 'Betaalverzoek staat klaar in de klantenapp.';
      if (action === 'close') messageText = result.record.closedAt ? 'Aanvraag afgemeld.' : 'Aanvraag opnieuw geopend.';
      const push = result.notifications?.push;
      if (push?.reason === 'accepted') messageText += ' Melding aangeboden aan de telefoondienst.';
      if (push?.reason === 'not_subscribed') messageText += ' Deze klant heeft nog geen telefoonmeldingen aangezet.';
      if (push?.reason === 'not_configured') messageText += ' Telefoonmeldingen zijn nog niet ingesteld.';
      if (push?.reason === 'failed' || push?.failed) messageText += ' Niet alle telefoonmeldingen konden worden verstuurd. De update staat wel in de klantapp.';
      updatedMessage.textContent = messageText; updatedMessage.className = 'admin-record-message is-success';
    } catch (error) { message.textContent = error.message; message.className = 'admin-record-message is-error'; buttons.forEach(button => { button.disabled = false; }); }
  });

  saveAvailabilityButton.addEventListener('click',saveAvailability);
  addAvailabilityButton.addEventListener('click',() => { const date = customAvailabilityDate.value; if (!date) return; availableDates.add(date); renderAvailability(); customAvailabilityDate.value = ''; });
  search.addEventListener('input',applySearch);
  refreshButton.addEventListener('click',() => loadDashboard().catch(error => { list.innerHTML = `<div class="admin-empty"><strong>Laden mislukt</strong><p>${escapeHtml(error.message)}</p></div>`; }));
  logoutButton.addEventListener('click',() => { sessionStorage.removeItem('lattenspecialist-admin-token'); localStorage.removeItem('lattenspecialist-admin-token'); token=''; records=[]; dashboard.hidden=true; logoutButton.hidden=true; loginSection.hidden=false; });

  let installPrompt; const installButton = document.querySelector('#installAdmin');
  window.addEventListener('beforeinstallprompt',event => { event.preventDefault(); installPrompt=event; installButton.hidden=false; });
  installButton.addEventListener('click',async() => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt=null; installButton.hidden=true; });
  if ('serviceWorker' in navigator) window.addEventListener('load',() => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  if (token) loadDashboard().catch(error => { loginSection.hidden=false; dashboard.hidden=true; logoutButton.hidden=true; showLoginStatus(error.message); });
})();
