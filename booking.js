(() => {
  const form = document.querySelector('#requestForm');
  if (!form) return;

  const config = window.LATTENSPECIALIST_BOOKING || {};
  const maintenanceFields = document.querySelector('#maintenanceFields');
  const rentalFields = document.querySelector('#rentalFields');
  const summary = document.querySelector('#requestSummary');
  const status = document.querySelector('#bookingStatus');
  const submitButton = form.querySelector('.form-submit');
  const turnstileContainer = document.querySelector('#turnstileContainer');
  let turnstileWidgetId = null;

  const getValue = name => String(form.elements[name]?.value || '').trim();
  const selectedService = () => form.querySelector('input[name="service"]:checked')?.value || 'Onderhoud';
  const formatDate = value => {
    if (!value) return '-';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('nl-NL', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(date);
  };

  const showStatus = (message, type) => {
    status.textContent = message;
    status.className = `booking-status is-visible is-${type}`;
  };

  const clearStatus = () => {
    status.textContent = '';
    status.className = 'booking-status';
  };

  const buildSummary = () => {
    const service = selectedService();
    const lines = [`Dienst: ${service}`];
    if (service === 'Onderhoud') {
      lines.push(
        `Materiaal: ${getValue('material')}`,
        `Aantal: ${getValue('amount')}`,
        `Pakket: ${getValue('package')}`,
        `Logistiek: ${getValue('logistics')}`,
        `Voorkeursdag: ${getValue('pickupday')}`,
        `Spoed: ${getValue('urgent')}`,
        `Bestemming: ${getValue('destination') || '-'}`,
        `Eerste skidag: ${formatDate(getValue('skidate'))}`,
        `Omstandigheden: ${getValue('conditions') || 'Weet ik nog niet'}`
      );
    } else {
      lines.push(
        `Verhuur: ${getValue('rentaltype')}`,
        `Lengte persoon: ${getValue('height') ? `${getValue('height')} cm` : '-'}`,
        `Schoenmaat: ${getValue('shoesize') || '-'}`,
        `Niveau: ${getValue('level')}`,
        `Periode: ${formatDate(getValue('rentfrom'))} t/m ${formatDate(getValue('rentto'))}`
      );
    }
    lines.push('', `Naam: ${getValue('name') || '-'}`, `Mobiel: ${getValue('phone') || '-'}`, `E-mail: ${getValue('email') || '-'}`, `Postcode: ${getValue('postcode') || '-'}`, `Adres / plaats: ${getValue('address') || '-'}`, `Opmerking: ${getValue('notes') || '-'}`);
    return lines.join('\n');
  };

  const updateForm = () => {
    const service = selectedService();
    maintenanceFields.hidden = service !== 'Onderhoud';
    rentalFields.hidden = service !== 'Verhuur';
    summary.textContent = buildSummary();
  };

  const setDateMinimums = () => {
    const today = new Date();
    const minimum = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    ['skidate', 'rentfrom', 'rentto'].forEach(name => {
      if (form.elements[name]) form.elements[name].min = minimum;
    });
  };

  const loadTurnstile = () => {
    if (!config.turnstileSiteKey) return;
    turnstileContainer.hidden = false;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      turnstileWidgetId = window.turnstile.render(turnstileContainer, {sitekey: config.turnstileSiteKey, theme: 'light', language: 'nl'});
    });
    script.addEventListener('error', () => showStatus('De beveiligingscontrole kon niet worden geladen. Vernieuw de pagina en probeer het opnieuw.', 'error'));
    document.head.appendChild(script);
  };

  form.addEventListener('input', updateForm);
  form.addEventListener('change', updateForm);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (form.elements.website.value) {
      form.reset();
      updateForm();
      showStatus('Bedankt. Je aanvraag is ontvangen.', 'success');
      return;
    }
    if (!config.endpoint || !config.turnstileSiteKey) {
      showStatus('Het online formulier wordt nog veilig gekoppeld. Gebruik voorlopig “Reserveer via WhatsApp” of mail naar info@lattenspecialist.nl.', 'error');
      return;
    }
    const turnstileToken = window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
    if (!turnstileToken) {
      showStatus('Voltooi eerst de beveiligingscontrole en verstuur de aanvraag opnieuw.', 'error');
      return;
    }
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.privacyConsent = formData.get('privacyConsent') === 'on';
    payload.turnstileToken = turnstileToken;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    submitButton.disabled = true;
    submitButton.textContent = 'Aanvraag versturen…';
    try {
      const response = await fetch(config.endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'De aanvraag kon niet worden verstuurd.');
      const reference = result.reference ? ` Je aanvraagcode is ${result.reference}.` : '';
      form.reset();
      updateForm();
      showStatus(`Gelukt! Je aanvraag is verstuurd.${reference} De Lattenspecialist neemt contact met je op om de afspraak te bevestigen.`, 'success');
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Het versturen duurde te lang. Controleer je verbinding en probeer het opnieuw.' : 'De aanvraag kon niet worden verstuurd. Probeer het opnieuw of kies “Reserveer via WhatsApp”.';
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
  loadTurnstile();
})();
