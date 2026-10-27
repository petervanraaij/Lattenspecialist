(() => {
  const dialog = document.querySelector('#testReservationDialog');
  const form = document.querySelector('#testReservationForm');
  const pickupAddress = document.querySelector('#testPickupAddress');
  const status = document.querySelector('#testReservationStatus');
  const count = document.querySelector('#testDialogCount');
  const total = document.querySelector('#testDialogTotal');
  const weekendSelect = form?.elements.testPickupWeekend;
  const daySelect = form?.elements.testPreferredDay;
  const weekendLabel = document.querySelector('#testWeekendLabel');
  const preferredDayField = document.querySelector('#testPreferredDayField');
  const dialogNote = document.querySelector('#testDialogNote');
  const successMessage = document.querySelector('#testSuccessMessage');
  const review = document.querySelector('#testOrderReview');
  const turnstileContainer = document.querySelector('#testTurnstile');
  const success = form?.querySelector('.test-reservation-success');
  const reference = document.querySelector('#testReservationReference');
  const submitButton = form?.querySelector('[type="submit"]');
  if (!dialog || !form || !pickupAddress || !status || !count || !total) return;

  const isTest = document.body.classList.contains('test-environment');
  const reservationLinks = [...document.querySelectorAll('a[href^="test-afspraak.html"],a[href^="afspraak.html"]')];
  let activeLink = null, activeSelection = null, turnstileWidgetId = null, submitting = false;
  const pickupInputs = [...pickupAddress.querySelectorAll('input,select')];
  const resetView = () => {
    [...form.children].forEach(child => { if (child !== success) child.hidden = false; });
    if (turnstileContainer) turnstileContainer.hidden = isTest;
    success.hidden = true; status.textContent = '';
  };
  const close = () => { dialog.close(); resetView(); };
  const service = window.LATTEN_SERVICE;
  const selectedLogistics = () => 'dropoff';
  const waxAmount = () => activeSelection ? Object.entries(activeSelection.p).reduce((n,[id,item]) => n+(id==='slijpen'?0:item.s+item.b),0) : 0;
  const extras = () => service.read(form,waxAmount());
  const chosenMoment = () => weekendSelect.value === 'In overleg' ? 'Op afspraak' : weekendSelect.value ? `${service.label(weekendSelect.value)}; ophalen ${service.label(service.plusWeek(weekendSelect.value))}` : 'Datum nog kiezen';
  const planningNote = () => !weekendSelect.value||weekendSelect.value==='In overleg'?'Brengen/halen: op afspraak':`Brengen ${weekendSelect.value}; ophalen ${service.plusWeek(weekendSelect.value)}`;
  const populateDays = () => {
    preferredDayField.hidden=true;daySelect.disabled=true;daySelect.required=false;
    daySelect.replaceChildren(new Option('Tijdstip wordt persoonlijk bevestigd','appointment'));
  };
  const populateWeekends = () => service.dates(weekendSelect);
  const updateLogistics = () => {
    pickupAddress.hidden=true;
    pickupInputs.forEach(input=>{input.required=false;input.disabled=true;});
    weekendLabel.textContent='Wanneer kom je brengen?';
    dialogNote.textContent='Woensdag brengen, de woensdag erop ophalen, of op afspraak. Kom pas langs nadat we het tijdstip hebben bevestigd. Betalen doe je wanneer het onderhoud gereed is.';
    populateDays();updateReview();
  };
  const updateReview = () => {
    if (!review || !activeSelection) return;
    const extra=extras();
    const lines=[...window.LATTEN_SELECTION.describe(activeSelection),...extra.lines];
    const sum=window.LATTEN_SELECTION.estimate(activeSelection).total+extra.total;
    total.textContent=extra.valid ? service.price(sum) : 'Controleer de extra keuzes';
    document.querySelector('#reservationExtrasTotal').textContent=extra.valid ? `Gekozen extra’s: ${service.price(extra.total)}` : 'Controleer de aantallen.';
    const reserved=[service.compactNote(window.LATTEN_SELECTION.notes(activeSelection)),extra.note,planningNote()].filter(Boolean).join(' | ');
    const notes=form.elements.testNotes;
    notes.maxLength=Math.max(0,800-reserved.length-3);
    notes.setCustomValidity(reserved.length>800?'Deze uitgebreide keuze past niet in één aanvraag. Neem contact met ons op.':notes.value.trim().length>notes.maxLength ? `Maak je opmerking korter (maximaal ${notes.maxLength} tekens).` : '');
    review.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='Controleer je bestelling';review.append(heading);
    lines.forEach(line=>{const item=document.createElement('span');item.textContent=line;review.append(item);});
    const planning=document.createElement('span');planning.textContent=`Zelf brengen in Wamel · ${chosenMoment()} · tijdstip na bevestiging`;review.append(planning);
    const finalTotal=document.createElement('strong');finalTotal.textContent=extra.valid?`Totaal vanaf inclusief gekozen extra’s: ${service.price(sum)}`:'Controleer de aantallen';review.append(finalTotal);
  };
  const loadTurnstile = () => {
    if (isTest || turnstileWidgetId !== null || !turnstileContainer || !window.LATTENSPECIALIST_BOOKING?.turnstileSiteKey) return;
    turnstileContainer.hidden = false;
    const render = () => { if (turnstileWidgetId === null) turnstileWidgetId = window.turnstile.render(turnstileContainer, {sitekey:window.LATTENSPECIALIST_BOOKING.turnstileSiteKey,theme:'light',language:'nl'}); };
    if (window.turnstile) { render(); return; }
    let script = document.querySelector('script[data-reservation-turnstile]');
    if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.dataset.reservationTurnstile = 'true'; document.head.append(script); }
    script.addEventListener('load', render, {once:true});
  };
  const selectionFromLink = link => {
    try {
      const value = new URL(link.href, location.href).searchParams.get('keuze');
      return value ? window.LATTEN_SELECTION?.parse(value) : null;
    } catch { return null; }
  };

  reservationLinks.forEach(link => link.addEventListener('click', event => {
    const selection = selectionFromLink(link);
    if (!selection || !window.LATTEN_SELECTION?.hasItems(selection)) {
      event.preventDefault();
      document.querySelector('#pakketten')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    event.preventDefault();
    activeLink = link;
    activeSelection = window.LATTEN_SELECTION.withoutCleaning(selection);
    form.elements.firstWaxCount.value = String(window.LATTEN_SELECTION.cleaningCount(selection));
    resetView();
    const estimate = window.LATTEN_SELECTION.estimate(selection);
    count.textContent = `${estimate.amount} ${estimate.amount === 1 ? 'materiaal' : 'materialen'} gekozen`;
    total.textContent = estimate.formatted;
    status.textContent = '';
    updateLogistics();
    updateReview();
    dialog.showModal();
    loadTurnstile();
    form.elements.testName.focus();
  }));

  form.addEventListener('input',updateReview);
  form.addEventListener('change', event => {
    if (event.target.name === 'testLogistics') updateLogistics();
    if (event.target.name === 'testPickupWeekend') populateDays();
    updateReview();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    updateReview();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (isTest) {
      successMessage.textContent = selectedLogistics() === 'pickup'
        ? 'In de echte reservering nemen we contact op om het onderhoud en de exacte ophaaldag te bevestigen.'
        : weekendSelect.value === 'In overleg' ? 'In de echte reservering nemen we contact op om het brengmoment in Wamel af te spreken.' : 'In de echte reservering bevestigen we het gekozen brengmoment in Wamel.';
      [...form.children].forEach(child => { if (child !== success) child.hidden = true; });
      success.hidden = false;
      return;
    }
    const token = window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
    if (!token) { status.textContent = 'Voltooi eerst de beveiligingscontrole.'; return; }
    const legacy = window.LATTEN_SELECTION.legacy(activeSelection);
    const pickup = selectedLogistics() === 'pickup';
    const notes = [service.compactNote(window.LATTEN_SELECTION.notes(activeSelection)), extras().note, planningNote(), form.elements.testNotes.value.trim()].filter(Boolean).join(' | ');
    const payload = {...legacy, service:'Onderhoud', quickReservation:true, maintenanceSelection:JSON.stringify(activeSelection), logistics:'Zelf brengen en zelf ophalen', pickupDate:weekendSelect.value === 'In overleg' ? 'In overleg' : weekendSelect.value, name:form.elements.testName.value.trim(), phone:form.elements.testPhone.value.trim(), email:'', postcode:pickup ? form.elements.testPostcode.value.trim() : '', houseNumber:pickup ? form.elements.testHouseNumber.value.trim() : '', address:pickup ? form.elements.testAddress.value.trim() : '', notes, privacyConsent:true, termsConsent:true, whatsappConsent:true, website:'', turnstileToken:token};
    const endpoint = window.LATTENSPECIALIST_BOOKING?.endpoint;
    if (!endpoint) { status.textContent = 'Reserveren is tijdelijk niet beschikbaar. Probeer het later opnieuw.'; return; }
    submitting = true; submitButton.disabled = true; submitButton.textContent = 'Reservering versturen…'; status.textContent = '';
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !/^LS-\d{4}-[A-Z2-9]{6}$/.test(result.reference || '')) throw new Error(result.message || 'De reservering kon niet worden verstuurd.');
      reference.textContent = result.reference;
      successMessage.textContent = pickup
        ? 'We hebben je aanvraag ontvangen. De Lattenspecialist neemt contact met je op om het onderhoud te bevestigen en laat weten op welke dag we langskomen.'
        : weekendSelect.value === 'In overleg'
          ? 'We hebben je aanvraag ontvangen. De Lattenspecialist neemt contact met je op om het onderhoud en het brengmoment in Wamel af te spreken.'
          : 'We hebben je aanvraag ontvangen. De Lattenspecialist neemt contact met je op om het onderhoud en jouw gekozen brengmoment in Wamel te bevestigen.';
      [...form.children].forEach(child => { if (child !== success) child.hidden = true; });
      success.hidden = false;
    } catch (error) {
      status.textContent = error.message;
      window.turnstile?.reset(turnstileWidgetId);
    } finally { submitting = false; submitButton.disabled = false; submitButton.textContent = 'Reserveren →'; }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.querySelector('.test-dialog-close').addEventListener('click', close);
  dialog.querySelector('.test-dialog-cancel').addEventListener('click', close);
  dialog.querySelector('.test-success-close').addEventListener('click', close);
  updateLogistics();
  populateWeekends();
  populateDays();
})();
