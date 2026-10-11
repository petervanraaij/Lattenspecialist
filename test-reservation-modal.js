(() => {
  const dialog = document.querySelector('#testReservationDialog');
  const form = document.querySelector('#testReservationForm');
  const pickupAddress = document.querySelector('#testPickupAddress');
  const status = document.querySelector('#testReservationStatus');
  const count = document.querySelector('#testDialogCount');
  const total = document.querySelector('#testDialogTotal');
  const weekendSelect = form?.elements.testPickupWeekend;
  const daySelect = form?.elements.testPreferredDay;
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
  const selectedLogistics = () => form.elements.testLogistics.value;
  const dateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dateLabel = date => new Intl.DateTimeFormat('nl-NL', {weekday:'long',day:'numeric',month:'long'}).format(date);
  const populateDays = () => {
    const saturday = weekendSelect.value ? new Date(`${weekendSelect.value}T12:00:00`) : null;
    daySelect.replaceChildren(new Option(saturday ? 'Kies een voorkeursmoment' : 'Kies eerst een weekend', ''));
    if (!saturday) return;
    const friday = new Date(saturday); friday.setDate(saturday.getDate() - 1);
    const sunday = new Date(saturday); sunday.setDate(saturday.getDate() + 1);
    daySelect.append(
      new Option(`${dateLabel(friday)} · avond`, `${dateValue(friday)}|avond`),
      new Option(`${dateLabel(saturday)} · 08:00–12:00`, `${dateValue(saturday)}|08:00-12:00`),
      new Option(`${dateLabel(saturday)} · 12:00–16:00`, `${dateValue(saturday)}|12:00-16:00`),
      new Option(`${dateLabel(sunday)} · 08:00–12:00`, `${dateValue(sunday)}|08:00-12:00`),
      new Option(`${dateLabel(sunday)} · 12:00–16:00`, `${dateValue(sunday)}|12:00-16:00`)
    );
  };
  const populateWeekends = () => {
    const today = new Date(); today.setHours(12,0,0,0);
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
    const first = new Date(today); first.setDate(today.getDate() + daysUntilSaturday);
    for (let index = 0; index < 8; index += 1) {
      const saturday = new Date(first); saturday.setDate(first.getDate() + (index * 7));
      const sunday = new Date(saturday); sunday.setDate(saturday.getDate() + 1);
      weekendSelect.append(new Option(`Weekend ${saturday.getDate()}–${dateLabel(sunday).replace(/^\w+\s/,'')}`, dateValue(saturday)));
    }
  };
  const updateLogistics = () => {
    const pickup = selectedLogistics() === 'pickup';
    pickupAddress.hidden = !pickup;
    pickupInputs.forEach(input => { input.required = pickup; input.disabled = !pickup; });
    updateReview();
  };
  const chosenMoment = () => daySelect.selectedOptions[0]?.textContent || '';
  const updateReview = () => {
    if (!review || !activeSelection) return;
    const lines = window.LATTEN_SELECTION.describe(activeSelection);
    const logistics = selectedLogistics() === 'pickup'
      ? `Gratis ophalen · ${weekendSelect.selectedOptions[0]?.textContent || 'weekend nog kiezen'} · ${chosenMoment() || 'voorkeursmoment nog kiezen'}`
      : 'Zelf brengen en ophalen in Wamel';
    review.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = 'Controleer je bestelling'; review.append(heading);
    lines.forEach(line => { const item = document.createElement('span'); item.textContent = line; review.append(item); });
    const planning = document.createElement('span'); planning.textContent = logistics; review.append(planning);
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
    activeSelection = selection;
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

  form.addEventListener('change', event => {
    if (event.target.name === 'testLogistics') updateLogistics();
    if (event.target.name === 'testPickupWeekend') populateDays();
    updateReview();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (isTest) {
      [...form.children].forEach(child => { if (child !== success) child.hidden = true; });
      success.hidden = false;
      return;
    }
    const token = window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
    if (!token) { status.textContent = 'Voltooi eerst de beveiligingscontrole.'; return; }
    const legacy = window.LATTEN_SELECTION.legacy(activeSelection);
    const pickup = selectedLogistics() === 'pickup';
    const notes = [window.LATTEN_SELECTION.notes(activeSelection), pickup ? `Voorkeursmoment: ${chosenMoment()}` : '', form.elements.testNotes.value.trim()].filter(Boolean).join('\n');
    const payload = {...legacy, service:'Onderhoud', quickReservation:true, maintenanceSelection:JSON.stringify(activeSelection), logistics:pickup ? 'Gratis ophalen & terugbrengen (servicegebied)' : 'Zelf brengen en zelf ophalen', pickupDate:pickup ? weekendSelect.value : 'In overleg', name:form.elements.testName.value.trim(), phone:form.elements.testPhone.value.trim(), email:'', postcode:pickup ? form.elements.testPostcode.value.trim() : '', houseNumber:pickup ? form.elements.testHouseNumber.value.trim() : '', address:pickup ? form.elements.testAddress.value.trim() : '', notes, privacyConsent:true, termsConsent:true, whatsappConsent:true, website:'', turnstileToken:token};
    const endpoint = window.LATTENSPECIALIST_BOOKING?.endpoint;
    if (!endpoint) { status.textContent = 'Reserveren is tijdelijk niet beschikbaar. Probeer het later opnieuw.'; return; }
    submitting = true; submitButton.disabled = true; submitButton.textContent = 'Reservering versturen…'; status.textContent = '';
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !/^LS-\d{4}-[A-Z2-9]{6}$/.test(result.reference || '')) throw new Error(result.message || 'De reservering kon niet worden verstuurd.');
      reference.textContent = result.reference;
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
