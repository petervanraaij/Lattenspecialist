(() => {
  const endpoint = String(window.LATTENSPECIALIST_BOOKING?.endpoint || '').replace(/\/$/, '');
  const steps = [
    'Aanvraag ontvangen',
    'Ophalen of brengen gepland',
    'Materiaal ontvangen',
    'Inspectie uitgevoerd',
    'Onderhoud gestart',
    'Wax koelt af',
    'Finish en eindcontrole',
    'Klaar voor ophalen of terugbrengen'
  ];
  const loginSection = document.querySelector('#adminLogin');
  const dashboard = document.querySelector('#adminDashboard');
  const loginForm = document.querySelector('#adminLoginForm');
  const loginStatus = document.querySelector('#adminLoginStatus');
  const logoutButton = document.querySelector('#logoutAdmin');
  const list = document.querySelector('#adminList');
  const summary = document.querySelector('#adminSummary');
  const search = document.querySelector('#adminSearch');
  const refreshButton = document.querySelector('#refreshAdmin');
  let token = sessionStorage.getItem('lattenspecialist-admin-token') || localStorage.getItem('lattenspecialist-admin-token') || '';
  let records = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'})[character]);
  const formatDateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '-') : new Intl.DateTimeFormat('nl-NL', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(date);
  };
  const formatReadyDate = value => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('nl-NL', {day: '2-digit', month: 'long', year: 'numeric'}).format(date);
  };
  const normalizeWhatsAppPhone = value => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `31${digits.slice(1)}`;
    return digits;
  };
  const whatsappUrl = record => {
    const phone = normalizeWhatsAppPhone(record.phone);
    if (!phone || !record.serviceCode) return '';
    const lines = [
      `Hallo ${String(record.name || '').split(/\s+/)[0] || ''},`,
      '',
      'De status van je aanvraag bij De Lattenspecialist is bijgewerkt:',
      `*${record.status || steps[Math.max(0, Number(record.currentStep || 1) - 1)]}*`
    ];
    if (record.note) lines.push('', record.note);
    if (record.expectedReady) lines.push('', `Verwacht klaar: ${formatReadyDate(record.expectedReady)}`);
    lines.push('', `Servicecode: ${record.serviceCode}`, 'Bekijk je voortgang: https://lattenspecialist.nl/app.html', '', 'Geen statusupdates meer via WhatsApp? Laat het ons in deze chat weten.', '', 'Groet,', 'De Lattenspecialist');
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };
  const valueOrDash = value => value ? escapeHtml(value) : '—';
  const headers = () => ({Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'});
  const showLoginStatus = message => {
    loginStatus.textContent = message;
    loginStatus.className = 'booking-status is-visible is-error';
  };

  const serviceDetails = record => record.service === 'Verhuur'
    ? [
        ['Materiaal', record.rentaltype], ['Lengte', record.height ? `${record.height} cm` : ''], ['Schoenmaat', record.shoesize],
        ['Niveau', record.level], ['Periode', record.rentfrom || record.rentto ? `${record.rentfrom || '?'} t/m ${record.rentto || '?'}` : '']
      ]
    : [
        ['Materiaal', `${record.amount || 1}× ${record.material || ''}`], ['Pakket', record.package], ['Logistiek', record.logistics],
        ['Voorkeursdag', record.pickupday], ['Spoed', record.urgent], ['Bestemming', record.destination],
        ['Eerste skidag', record.skidate], ['Omstandigheden', record.conditions]
      ];

  const renderRecord = record => {
    const currentStep = Math.max(1, Math.min(steps.length, Number(record.currentStep) || 1));
    const details = serviceDetails(record).filter(([, value]) => value).map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join('');
    const stepOptions = steps.map((label, index) => `<option value="${index + 1}"${index + 1 === currentStep ? ' selected' : ''}>${index + 1}. ${escapeHtml(label)}</option>`).join('');
    const searchText = [record.reference, record.serviceCode, record.name, record.phone, record.email, record.postcode, record.address, record.material, record.package, record.rentaltype].filter(Boolean).join(' ').toLowerCase();
    return `<article class="admin-record" data-reference="${escapeHtml(record.reference)}" data-search="${escapeHtml(searchText)}">
      <div class="admin-record-head">
        <div><span class="admin-request-code">${escapeHtml(record.reference)}</span><h2>${escapeHtml(record.name || 'Naam onbekend')}</h2><p>${escapeHtml(record.service || 'Aanvraag')} · ontvangen ${escapeHtml(formatDateTime(record.createdAt))}</p></div>
        <span class="admin-status-pill">${escapeHtml(record.status || steps[currentStep - 1])}</span>
      </div>
      <div class="admin-record-grid">
        <div class="admin-info">
          <h3>Contact</h3>
          <p><a href="tel:${encodeURIComponent(record.phone || '')}">${valueOrDash(record.phone)}</a><br><a href="mailto:${encodeURIComponent(record.email || '')}">${valueOrDash(record.email)}</a><br>${valueOrDash(record.address)} ${valueOrDash(record.postcode)}</p>
          <span class="whatsapp-permission ${record.whatsappConsent ? 'is-allowed' : 'is-missing'}">${record.whatsappConsent ? '✓ WhatsApp-statusupdates toegestaan' : 'Geen WhatsApp-toestemming vastgelegd'}</span>
          <h3>Aanvraag</h3>
          <div class="admin-detail-grid">${details}</div>
          ${record.notes ? `<div class="admin-customer-note"><b>Opmerking klant</b><p>${escapeHtml(record.notes)}</p></div>` : ''}
        </div>
        <form class="admin-update-form">
          <h3>Onderhoud registreren</h3>
          <label><span>Servicecode voor klant</span><div class="admin-code-row"><input name="serviceCode" value="${escapeHtml(record.serviceCode || '')}" placeholder="Nog niet toegekend" readonly><button class="btn btn-dark generate-code" type="button"${record.serviceCode ? ' hidden' : ''}>Maak code</button></div></label>
          <label><span>Voortgang</span><select name="currentStep">${stepOptions}</select></label>
          <label><span>Verwacht klaar</span><input type="date" name="expectedReady" value="${escapeHtml(record.expectedReady || '')}"></label>
          <label><span>Bericht voor klant</span><textarea name="note" rows="3" maxlength="320" placeholder="Bijvoorbeeld: de kanten zijn gecontroleerd.">${escapeHtml(record.note || '')}</textarea></label>
          <div class="admin-save-actions">
            <button class="btn btn-gold save-record" type="submit" data-action="whatsapp"${record.whatsappConsent && record.serviceCode ? '' : ' disabled'}>Opslaan + WhatsApp openen</button>
            <button class="btn btn-dark save-record" type="submit" data-action="save">Alleen opslaan</button>
          </div>
          <small class="whatsapp-help">WhatsApp opent met een ingevuld statusbericht. Controleer het bericht en tik daarna op verzenden.</small>
          <div class="admin-record-message" role="status" aria-live="polite"></div>
        </form>
      </div>
    </article>`;
  };

  const applySearch = () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll('.admin-record').forEach(card => { card.hidden = query && !card.dataset.search.includes(query); });
  };

  const render = () => {
    const open = records.filter(record => Number(record.currentStep || 1) < steps.length).length;
    const withoutCode = records.filter(record => !record.serviceCode).length;
    summary.innerHTML = `<span><b>${records.length}</b> aanvragen</span><span><b>${open}</b> in behandeling</span><span><b>${withoutCode}</b> zonder servicecode</span>`;
    list.innerHTML = records.length ? records.map(renderRecord).join('') : '<div class="admin-empty"><strong>Nog geen websiteaanvragen</strong><p>Nieuwe aanvragen verschijnen hier automatisch.</p></div>';
    applySearch();
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${endpoint}${path}`, {...options, headers: {...headers(), ...(options.headers || {})}, cache: 'no-store'});
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionStorage.removeItem('lattenspecialist-admin-token');
      localStorage.removeItem('lattenspecialist-admin-token');
      token = '';
      throw new Error('De beheercode is niet juist.');
    }
    if (!response.ok) throw new Error(result.message || 'De bewerking is niet gelukt.');
    return result;
  };

  const loadReservations = async () => {
    if (!endpoint) throw new Error('De beheerservice is nog niet gekoppeld.');
    refreshButton.disabled = true;
    list.innerHTML = '<div class="admin-empty"><strong>Reserveringen laden…</strong></div>';
    try {
      const result = await api('/api/admin/reservations');
      records = result.records || [];
      loginSection.hidden = true;
      dashboard.hidden = false;
      logoutButton.hidden = false;
      render();
    } finally {
      refreshButton.disabled = false;
    }
  };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginStatus.className = 'booking-status';
    token = String(new FormData(loginForm).get('token') || '').trim();
    try {
      await loadReservations();
      sessionStorage.setItem('lattenspecialist-admin-token', token);
      if (loginForm.elements.remember.checked) localStorage.setItem('lattenspecialist-admin-token', token);
      else localStorage.removeItem('lattenspecialist-admin-token');
      loginForm.reset();
    } catch (error) {
      showLoginStatus(error.message);
    }
  });

  list.addEventListener('click', async event => {
    const button = event.target.closest('.generate-code');
    if (!button) return;
    const card = button.closest('.admin-record');
    const message = card.querySelector('.admin-record-message');
    button.disabled = true;
    message.textContent = 'Servicecode maken…';
    try {
      const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`, {method: 'PATCH', body: JSON.stringify({generateServiceCode: true})});
      records = records.map(record => record.reference === result.record.reference ? result.record : record);
      render();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'admin-record-message is-error';
      button.disabled = false;
    }
  });

  list.addEventListener('submit', async event => {
    const form = event.target.closest('.admin-update-form');
    if (!form) return;
    event.preventDefault();
    const card = form.closest('.admin-record');
    const message = form.querySelector('.admin-record-message');
    const buttons = [...form.querySelectorAll('.save-record')];
    const wantsWhatsapp = event.submitter?.dataset.action === 'whatsapp';
    let whatsappWindow = wantsWhatsapp ? window.open('about:blank', '_blank') : null;
    if (whatsappWindow) whatsappWindow.opener = null;
    const values = Object.fromEntries(new FormData(form));
    const currentStep = Number(values.currentStep);
    buttons.forEach(button => { button.disabled = true; });
    message.textContent = 'Opslaan…';
    message.className = 'admin-record-message';
    try {
      const result = await api(`/api/admin/reservations/${encodeURIComponent(card.dataset.reference)}`, {method: 'PATCH', body: JSON.stringify({serviceCode: values.serviceCode, currentStep, status: steps[currentStep - 1], expectedReady: values.expectedReady, note: values.note})});
      records = records.map(record => record.reference === result.record.reference ? result.record : record);
      const messageUrl = wantsWhatsapp ? whatsappUrl(result.record) : '';
      if (whatsappWindow && messageUrl) whatsappWindow.location.href = messageUrl;
      else if (whatsappWindow) whatsappWindow.close();
      render();
      const updated = document.querySelector(`[data-reference="${CSS.escape(result.record.reference)}"]`);
      const updatedMessage = updated?.querySelector('.admin-record-message');
      if (updatedMessage) {
        updatedMessage.textContent = wantsWhatsapp && messageUrl ? 'Opgeslagen. WhatsApp is geopend; tik daar op verzenden.' : 'Opgeslagen. De klant ziet de bijgewerkte status.';
        updatedMessage.className = 'admin-record-message is-success';
        if (wantsWhatsapp && messageUrl && !whatsappWindow) {
          const link = document.createElement('a');
          link.href = messageUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = ' Open WhatsApp.';
          updatedMessage.append(link);
        }
      }
    } catch (error) {
      if (whatsappWindow) whatsappWindow.close();
      message.textContent = error.message;
      message.className = 'admin-record-message is-error';
      buttons.forEach(button => { button.disabled = false; });
    }
  });

  search.addEventListener('input', applySearch);
  refreshButton.addEventListener('click', () => loadReservations().catch(error => { list.innerHTML = `<div class="admin-empty"><strong>Laden mislukt</strong><p>${escapeHtml(error.message)}</p></div>`; }));
  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem('lattenspecialist-admin-token');
    localStorage.removeItem('lattenspecialist-admin-token');
    token = '';
    records = [];
    dashboard.hidden = true;
    logoutButton.hidden = true;
    loginSection.hidden = false;
  });

  let installPrompt;
  const installButton = document.querySelector('#installAdmin');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    installButton.hidden = true;
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

  if (token) loadReservations().catch(error => {
    loginSection.hidden = false;
    dashboard.hidden = true;
    logoutButton.hidden = true;
    showLoginStatus(error.message);
  });
})();
