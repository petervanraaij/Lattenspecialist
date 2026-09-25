(() => {
  const form = document.querySelector('#requestForm');
  if (!form) return;
  const config = window.LATTENSPECIALIST_BOOKING || {};
  const endpoint = String(config.endpoint || '').replace(/\/$/, '');
  const maintenanceFields = document.querySelector('#maintenanceFields');
  const rentalFields = document.querySelector('#rentalFields');
  const addressFields = document.querySelector('#pickupAddressFields');
  const pickupDateField = document.querySelector('#pickupDateField');
  const summary = document.querySelector('#requestSummary');
  const status = document.querySelector('#bookingStatus');
  const addressStatus = document.querySelector('#addressStatus');
  const submitButton = form.querySelector('.form-submit');
  const confirmation = document.querySelector('#bookingConfirmation');
  const turnstileContainer = document.querySelector('#turnstileContainer');
  let turnstileWidgetId = null, addressTimer, addressController;
  let addressVersion = 0, lastAddressQuery = '', outsidePickupArea = false, submitting = false;
  const getValue = name => String(form.elements[name]?.value || '').trim();
  const selectedService = () => form.querySelector('input[name="service"]:checked')?.value || 'Onderhoud';
  const usesPickup = () => selectedService() === 'Onderhoud' && getValue('logistics').includes('Gratis ophalen');
  const formatDate = value => {
    if (!value || value === 'In overleg') return value || 'Nog niet ingevuld';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('nl-NL', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).format(date);
  };
  const showStatus = (message, type) => { status.textContent = message; status.className = `booking-status is-visible is-${type}`; };
  const clearStatus = () => { status.textContent = ''; status.className = 'booking-status'; };
  const setAddressStatus = (message, type = '') => { addressStatus.textContent = message; addressStatus.className = `address-status${type ? ` is-${type}` : ''}`; };
  const toggleFields = (container, visible) => {
    if (!container) return;
    container.hidden = !visible;
    container.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = !visible; });
  };
  const buildSummary = () => {
    const service = selectedService();
    const lines = [`Dienst: ${service}`];
    if (service === 'Onderhoud') {
      lines.push(`Materiaal: ${getValue('material')}`, `Aantal: ${getValue('amount')}`, `Pakket: ${getValue('package') || 'Nog kiezen'}`, `Halen of brengen: ${getValue('logistics')}`);
      if (usesPickup()) lines.push(`Ophaaldatum: ${formatDate(getValue('pickupDate'))}`, `Ophaal- en terugbrenglocatie: ${getValue('address') || 'Nog invullen'}`);
      lines.push(`Spoed: ${getValue('urgent')}`);
      if (getValue('destination')) lines.push(`Bestemming: ${getValue('destination')}`);
      if (getValue('skidate')) lines.push(`Eerste skidag: ${formatDate(getValue('skidate'))}`);
      if (getValue('conditions') !== 'Weet ik nog niet') lines.push(`Omstandigheden: ${getValue('conditions')}`);
    } else {
      lines.push(`Verhuur: ${getValue('rentaltype')}`, `Lengte persoon: ${getValue('height') ? `${getValue('height')} cm` : '-'}`, `Schoenmaat: ${getValue('shoesize') || '-'}`, `Niveau: ${getValue('level')}`, `Periode: ${formatDate(getValue('rentfrom'))} t/m ${formatDate(getValue('rentto'))}`);
    }
    lines.push('', `Naam: ${getValue('name') || '-'}`, `Mobiel: ${getValue('phone') || '-'}`, `E-mail: ${getValue('email') || '-'}`, `WhatsApp-updates: ${form.elements.whatsappConsent.checked ? 'Ja' : 'Nee'}`);
    if (getValue('notes')) lines.push(`Opmerking: ${getValue('notes')}`);
    return lines.join('\n');
  };
  const updateForm = () => {
    toggleFields(maintenanceFields, selectedService() === 'Onderhoud');
    toggleFields(rentalFields, selectedService() === 'Verhuur');
    toggleFields(addressFields, usesPickup());
    toggleFields(pickupDateField, usesPickup());
    ['postcode','houseNumber','address','pickupDate'].forEach(name => { form.elements[name].required = usesPickup(); });
    form.elements.address.setCustomValidity(usesPickup() && outsidePickupArea ? 'Deze plaats valt buiten het gratis servicegebied. Kies zelf brengen in Wamel of in overleg.' : '');
    form.elements.rentto.setCustomValidity(selectedService() === 'Verhuur' && getValue('rentfrom') && getValue('rentto') && getValue('rentto') < getValue('rentfrom') ? 'Kies een einddatum op of na de begindatum.' : '');
    summary.textContent = buildSummary();
  };
  const loadAvailability = async () => {
    const select = form.elements.pickupDate;
    const chosen = select.value;
    select.replaceChildren(new Option('Beschikbare data laden…', ''));
    try {
      if (!endpoint) throw new Error();
      const response = await fetch(`${endpoint}/api/availability`, {cache:'no-store'});
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.dates)) throw new Error();
      const dates = [...new Set(result.dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
      const options = dates.length ? [new Option('Kies een ophaaldatum', '')] : [];
      dates.forEach(date => options.push(new Option(formatDate(date), date)));
      options.push(new Option('In overleg', 'In overleg'));
      select.replaceChildren(...options);
      select.value = [...select.options].some(option => option.value === chosen) ? chosen : dates.length ? '' : 'In overleg';
    } catch { select.replaceChildren(new Option('In overleg — data niet beschikbaar', 'In overleg')); }
    updateForm();
  };
  const lookupAddress = async () => {
    const postcode = getValue('postcode').toUpperCase().replace(/\s+/g, '');
    const houseNumber = getValue('houseNumber');
    if (!usesPickup() || !/^\d{4}[A-Z]{2}$/.test(postcode) || !/^\d{1,5}/.test(houseNumber) || !endpoint) return;
    const query = `${postcode}|${houseNumber}`;
    if (query === lastAddressQuery) return;
    const version = addressVersion;
    addressController = new AbortController();
    const controller = addressController;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setAddressStatus('Adres opzoeken…', 'loading');
    try {
      const response = await fetch(`${endpoint}/api/address?postcode=${encodeURIComponent(postcode)}&houseNumber=${encodeURIComponent(houseNumber)}`, {cache:'no-store', signal:controller.signal});
      const result = await response.json();
      if (version !== addressVersion || !usesPickup()) return;
      if (!response.ok || !result.address?.address) throw new Error('Adres niet gevonden.');
      lastAddressQuery = query;
      form.elements.postcode.value = result.address.postcode;
      form.elements.houseNumber.value = result.address.houseNumber;
      form.elements.address.value = result.address.address;
      form.elements.addressCity.value = result.address.city;
      outsidePickupArea = result.address.freePickup === false;
      setAddressStatus(outsidePickupArea ? 'Dit adres ligt buiten het gratis servicegebied. Kies zelf brengen in Wamel of in overleg.' : 'Adres gevonden en binnen het gratis servicegebied.', outsidePickupArea ? 'warning' : 'success');
      updateForm();
    } catch {
      if (version !== addressVersion || !usesPickup()) return;
      setAddressStatus('Het adres kon niet worden opgezocht. Vul je ophaal- en terugbrenglocatie handmatig in; we controleren het servicegebied bij de planning.', 'warning');
    } finally { window.clearTimeout(timeout); }
  };
  const scheduleAddressLookup = () => {
    window.clearTimeout(addressTimer);
    addressController?.abort();
    addressVersion += 1;
    lastAddressQuery = ''; outsidePickupArea = false;
    form.elements.address.value = ''; form.elements.addressCity.value = '';
    setAddressStatus('Het adres verschijnt na het invullen van postcode en huisnummer.');
    addressTimer = window.setTimeout(lookupAddress, 450);
  };
  const resetRequest = () => {
    addressController?.abort(); addressVersion += 1; window.clearTimeout(addressTimer);
    form.reset(); lastAddressQuery = ''; outsidePickupArea = false;
    setAddressStatus('Het adres verschijnt na het invullen van postcode en huisnummer.');
    clearStatus(); updateForm(); loadAvailability();
  };
  const today = new Date();
  const minimum = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  ['skidate','rentfrom','rentto'].forEach(name => { form.elements[name].min = minimum; });
  const packageChoice = new URLSearchParams(location.search).get('pakket');
  if ([...form.elements.package.options].some(option => option.value && option.value === packageChoice)) form.elements.package.value = packageChoice;
  const loadTurnstile = () => {
    if (!config.turnstileSiteKey) return;
    turnstileContainer.hidden = false;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true;
    script.addEventListener('load', () => { turnstileWidgetId = window.turnstile.render(turnstileContainer, {sitekey:config.turnstileSiteKey, theme:'light', language:'nl'}); });
    script.addEventListener('error', () => showStatus('De beveiligingscontrole kon niet worden geladen. Vernieuw de pagina en probeer het opnieuw.', 'error'));
    document.head.appendChild(script);
  };
  form.addEventListener('input', event => {
    if (event.target.matches('[name="postcode"], [name="houseNumber"]')) scheduleAddressLookup();
    updateForm();
  });
  form.addEventListener('change', () => { updateForm(); if (usesPickup()) lookupAddress(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    clearStatus(); updateForm();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.elements.website.value) { resetRequest(); showStatus('Bedankt. Je aanvraag is ontvangen.', 'success'); return; }
    if (!endpoint || !config.turnstileSiteKey) { showStatus('Het formulier is tijdelijk niet beschikbaar. Gebruik “Reserveer via WhatsApp” of mail naar info@lattenspecialist.nl.', 'error'); return; }
    const turnstileToken = window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
    if (!turnstileToken) { showStatus('Voltooi eerst de beveiligingscontrole en verstuur de aanvraag opnieuw.', 'error'); return; }
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.privacyConsent = formData.get('privacyConsent') === 'on';
    payload.whatsappConsent = formData.get('whatsappConsent') === 'on';
    payload.turnstileToken = turnstileToken;
    if (selectedService() === 'Onderhoud' && !usesPickup()) payload.pickupDate = 'In overleg';
    const submittedSummary = buildSummary();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    submitting = true; submitButton.disabled = true; submitButton.textContent = 'Aanvraag versturen…';
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'De aanvraag kon niet worden verstuurd.');
      if (!result.ok || !/^LS-\d{4}-[A-Z2-9]{6}$/.test(result.reference || '')) throw new Error('We kunnen de ontvangst nog niet bevestigen. Neem contact met ons op voordat je opnieuw verstuurt.');
      document.querySelector('#confirmationReference').textContent = result.reference;
      document.querySelector('#confirmationSummary').textContent = submittedSummary;
      document.querySelector('#confirmationDelivery').textContent = result.confirmationSent === true ? 'We hebben je ook een bevestiging per e-mail gestuurd. Nog niet zichtbaar? Kijk ook in je spammap.' : result.confirmationSent === false ? 'Je aanvraag is opgeslagen, maar de bevestigingsmail kon niet worden verstuurd. Bewaar de aanvraagcode hierboven.' : 'Bewaar je aanvraagcode voor vragen over de planning.';
      document.querySelector('#confirmationTracking').textContent = payload.whatsappConsent ? 'Zodra je onderhoud is geregistreerd, ontvang je je persoonlijke statuslink bij een update. Daarmee open je direct je onderhoud, zonder code of installatie.' : 'Zodra je onderhoud is geregistreerd, kun je het volgen via een persoonlijke statuslink. Je hoeft daarvoor geen app te installeren.';
      document.body.classList.add('has-confirmation');
      form.hidden = true; confirmation.hidden = false; confirmation.focus({preventScroll:true});
      confirmation.scrollIntoView?.({block:'start', behavior:'instant'});
      resetRequest();
      window.dispatchEvent(new CustomEvent('lattenspecialist:booking-submitted', {detail:{reference:result.reference}}));
    } catch (error) {
      showStatus(error.name === 'AbortError' ? 'De ontvangst kon niet op tijd worden bevestigd. Controleer je e-mail of neem contact op voordat je opnieuw verstuurt, om een dubbele aanvraag te voorkomen.' : error.message, 'error');
    } finally {
      window.clearTimeout(timeout); submitting = false;
      submitButton.disabled = false; submitButton.textContent = 'Aanvraag versturen';
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    }
  });
  document.querySelector('#newRequest')?.addEventListener('click', () => {
    confirmation.hidden = true; form.hidden = false; document.body.classList.remove('has-confirmation');
    ['confirmationReference','confirmationSummary','confirmationDelivery','confirmationTracking'].forEach(id => { document.getElementById(id).textContent = ''; });
    form.elements.package.focus();
  });
  updateForm(); loadAvailability(); loadTurnstile(); submitButton.disabled = false;
})();
