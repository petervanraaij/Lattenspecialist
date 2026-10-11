(() => {
  const dialog = document.querySelector('#testReservationDialog');
  const form = document.querySelector('#testReservationForm');
  const pickupAddress = document.querySelector('#testPickupAddress');
  const status = document.querySelector('#testReservationStatus');
  const count = document.querySelector('#testDialogCount');
  const total = document.querySelector('#testDialogTotal');
  if (!dialog || !form || !pickupAddress || !status || !count || !total) return;

  const isTest = document.body.classList.contains('test-environment');
  const reservationLinks = [...document.querySelectorAll('a[href^="test-afspraak.html"],a[href^="afspraak.html"]')];
  let activeLink = null;
  const pickupInputs = [...pickupAddress.querySelectorAll('input')];
  const close = () => { dialog.close(); status.textContent = ''; };
  const selectedLogistics = () => form.elements.testLogistics.value;
  const updateLogistics = () => {
    const pickup = selectedLogistics() === 'pickup';
    pickupAddress.hidden = !pickup;
    pickupInputs.forEach(input => { input.required = pickup; input.disabled = !pickup; });
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
    const estimate = window.LATTEN_SELECTION.estimate(selection);
    count.textContent = `${estimate.amount} ${estimate.amount === 1 ? 'materiaal' : 'materialen'} gekozen`;
    total.textContent = estimate.formatted;
    status.textContent = '';
    updateLogistics();
    dialog.showModal();
    form.elements.testName.focus();
  }));

  form.addEventListener('change', event => {
    if (event.target.name === 'testLogistics') updateLogistics();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!isTest && activeLink) {
      location.href = activeLink.href;
      return;
    }
    status.textContent = selectedLogistics() === 'pickup'
      ? 'Test compleet. De volgende stap wordt de betaalkeuze; het ophaaladres gaat alleen mee bij ophalen.'
      : 'Test compleet. De volgende stap wordt de betaalkeuze; bij zelf brengen bewaren we alleen naam en telefoonnummer.';
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.querySelector('.test-dialog-close').addEventListener('click', close);
  dialog.querySelector('.test-dialog-cancel').addEventListener('click', close);
  updateLogistics();
})();
