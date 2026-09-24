(() => {
  const form = document.querySelector('#requestForm');
  if (!form) return;

  const config = window.LATTENSPECIALIST_BOOKING || {};
  const endpoint = String(config.endpoint || '').replace(/\/$/, '');
  const maintenanceFields = document.querySelector('#maintenanceFields');
  const rentalFields = document.querySelector('#rentalFields');
  const summary = document.querySelector('#requestSummary');
  const status = document.querySelector('#bookingStatus');
  const addressStatus = document.querySelector('#addressStatus');
  const submitButton = form.querySelector('.form-submit');
  const turnstileContainer = document.querySelector('#turnstileContainer');
  let turnstileWidgetId = null;
  let addressTimer = null;
  let lastAddressQuery = '';

  const getValue = name => String(form.elements[name]?.value || '').trim();
  const selectedService = () => form.querySelector('input[name="service"]:checked')?.value || 'Onderhoud';
  const usesPickup = () => selectedService() === 'Onderhoud' && getValue('logistics').includes('Gratis ophalen');
  const formatDate = value => {
    if (!value || value === 'In overleg') return value || '-';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('nl-NL', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(date);
  };

  const showStatus = (message, type) => {
    status.textContent = message;
    status.className = `booking-status is-visible is-${type}`;
  };
  const clearStatus = () => { status.textContent = ''; status.className = 'booking-status'; };
  const setAddressStatus = (message, type = '') => {
    addressStatus.textContent = message;
    addressStatus.className = `address-status${type ? ` is-${type}` : ''}`;
  };

  const buildSummary = () => {
    const service = selectedService();
    const lines = [`Dienst: ${service}`];
    if (service === 'Onderhoud') {
      lines.push(
        `Materiaal: ${getValue('material')}`, `Aantal: ${getValue('amount')}`, `Pakket: ${getValue('package')}`,
        `Logistiek: ${getValue('logistics')}`, `Ophaaldatum: ${formatDate(getValue('pickupDate'))}`,
        `Spoed: ${getValue('urgent')}`, `Bestemming: ${getValue('destination') || '-'}`,
        `Eerste skidag: ${formatDate(getValue('skidate'))}`, `Omstandigheden: ${getValue('conditions') || 'Weet ik nog niet'}`
      );
    } else {
      lines.push(
        `Verhuur: ${getValue('rentaltype')}`, `Lengte persoon: ${getValue('height') ? `${getValue('height')} cm` : '-'}`,
        `Schoenmaat: ${getValue('shoesize') || '-'}`, `Niveau: ${getValue('level')}`,
        `Periode: ${formatDate(getValue('rentfrom'))} t/m ${formatDate(getValue('rentto'))}`
      );
    }
    lines.push('', `Naam: ${getValue('name') || '-'}`, `Mobiel: ${getValue('phone') || '-'}`, `E-mail: ${getValue('email') || '-'}`, `Ophaal- en terugbrenglocatie: ${getValue('address') || '-'}`, `Opmerking: ${getValue('notes') || '-'}`);
    return lines.join('\n');
  };

  const updateRequiredFields = () => {
    const required = usesPickup();
    ['postcode', 'houseNumber', 'address'].forEach(name => { if (form.elements[name]) form.elements[name].required = required; });
  };

  const updateForm = () => {
    const service = selectedService();
    maintenanceFields.hidden = service !== 'Onderhoud';
    rentalFields.hidden = service !== 'Verhuur';
    updateRequiredFields();
    summary.textContent = buildSummary();
  };

  const loadAvailability = async () => {
    const select = form.elements.pickupDate;
    select.innerHTML = '<option value="">Beschikbare data laden…</option><option>In overleg</option>';
    if (!endpoint) { select.value = 'In overleg'; return; }
    try {
      const response = await fetch(`${endpoint}/api/availability`, {cache: 'no-store'});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      const options = (result.dates || []).map(date => `<option value="${date}">${formatDate(date)}</option>`).join('');
      select.innerHTML = `${options}<option>In overleg</option>`;
      select.value = result.dates?.[0] || 'In overleg';
    } catch {
      select.innerHTML = '<option>In overleg</option>';
    }
    updateForm();
  };

  const lookupAddress = async () => {
    const postcode = getValue('postcode').toUpperCase().replace(/\s+/g, '');
    const houseNumber = getValue('houseNumber');
    if (!/^\d{4}[A-Z]{2}$/.test(postcode) || !/^\d{1,5}/.test(houseNumber)) {
      lastAddressQuery = '';
      form.elements.addressCity.value = '';
      setAddressStatus('Vul een volledige postcode en huisnummer in; het adres wordt dan automatisch opgezocht.');
      return;
    }
    const query = `${postcode}|${houseNumber}`;
    if (query === lastAddressQuery || !endpoint) return;
    lastAddressQuery = query;
    setAddressStatus('Adres opzoeken…', 'loading');
    try {
      const response = await fetch(`${endpoint}/api/address?postcode=${encodeURIComponent(postcode)}&houseNumber=${encodeURIComponent(houseNumber)}`, {cache: 'no-store'});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Adres niet gevonden.');
      form.elements.postcode.value = result.address.postcode;
      form.elements.houseNumber.value = result.address.houseNumber;
      form.elements.address.value = result.address.address;
      form.elements.addressCity.value = result.address.city;
      if (result.address.freePickup) setAddressStatus('Adres gevonden en binnen het gratis servicegebied.', 'success');
      else setAddressStatus('Adres gevonden, maar deze plaats valt buiten het gratis servicegebied. Kies zelf brengen in Wamel of neem contact op.', 'warning');
      updateForm();
    } catch (error) {
      form.elements.addressCity.value = '';
      setAddressStatus(`${error.message} Je kunt het adres ook handmatig invullen.`, 'warning');
    }
  };

  const scheduleAddressLookup = () => {
    window.clearTimeout(addressTimer);
    addressTimer = window.setTimeout(lookupAddress, 450);
  };

  const setDateMinimums = () => {
    const today = new Date();
    const minimum = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    ['skidate', 'rentfrom', 'rentto'].forEach(name => { if (form.elements[name]) form.elements[name].min = minimum; });
  };

  const loadTurnstile = () => {
    if (!config.turnstileSiteKey) return;
    turnstileContainer.hidden = false;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => { turnstileWidgetId = window.turnstile.render(turnstileContainer, {sitekey: config.turnstileSiteKey, theme: 'light', language: 'nl'}); });
    script.addEventListener('error', () => showStatus('De beveiligingscontrole kon niet worden geladen. Vernieuw de pagina en probeer het opnieuw.', 'error'));
    document.head.appendChild(script);
  };

  form.addEventListener('input', event => {
    if (event.target.matches('[name="postcode"], [name="houseNumber"]')) scheduleAddressLookup();
    updateForm();
  });
  form.addEventListener('change', updateForm);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    updateRequiredFields();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.elements.website.value) { form.reset(); updateForm(); showStatus('Bedankt. Je aanvraag is ontvangen.', 'success'); return; }
    if (!endpoint || !config.turnstileSiteKey) { showStatus('Het online formulier wordt nog veilig gekoppeld. Gebruik voorlopig “Reserveer via WhatsApp” of mail naar info@lattenspecialist.nl.', 'error'); return; }
    const turnstileToken = window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
    if (!turnstileToken) { showStatus('Voltooi eerst de beveiligingscontrole en verstuur de aanvraag opnieuw.', 'error'); return; }
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.privacyConsent = formData.get('privacyConsent') === 'on';

    payload.turnstileToken = turnstileToken;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    submitButton.disabled = true;
    submitButton.textContent = 'Aanvraag versturen…';
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'De aanvraag kon niet worden verstuurd.');
      const confirmation = ' Je bevestiging, voortgang en betaalverzoek staan in je klantenapp. Open en bewaar je onderhoud via de knop hieronder.';
      form.reset();
      await loadAvailability();
      updateForm();
      showStatus(`Gelukt! Je aanvraagcode is ${result.reference}.${confirmation} De planning wordt persoonlijk bevestigd.`, 'success');
      if (/^[a-f0-9]{64}$/.test(result.customerToken || '')) {
        const link = document.createElement('a');
        link.href = `app.html#klant=${result.customerToken}`;
        link.className = 'btn btn-gold'; link.textContent = 'Bekijk mijn onderhoud';
        status.append(document.createElement('br'), link);
      }
      window.dispatchEvent(new CustomEvent('lattenspecialist:booking-submitted', {detail: {reference: result.reference, customerToken: result.customerToken}}));
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Het versturen duurde te lang. Controleer je verbinding en probeer het opnieuw.' : error.message;
      showStatus(message, 'error');
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } finally {
      window.clearTimeout(timeout);
      submitButton.disabled = false;
      submitButton.textContent = 'Aanvraag via website versturen';
    }
  });

  setDateMinimums();
  updateForm();
  loadAvailability();
  loadTurnstile();
})();
