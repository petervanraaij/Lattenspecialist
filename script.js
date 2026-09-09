const WHATSAPP_NUMBER = ''; // Later invullen als internationaal nummer zonder +, bv. 31612345678
const FALLBACK_EMAIL = 'info@lattenspecialist.nl';

const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent='☰';
  }));
}

document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('requestForm');
const maintenanceFields = document.getElementById('maintenanceFields');
const rentalFields = document.getElementById('rentalFields');
const summary = document.getElementById('requestSummary');

function getValue(name) {
  const field = form.elements[name];
  return field ? String(field.value || '').trim() : '';
}

function selectedService() {
  return form.querySelector('input[name="service"]:checked')?.value || 'Onderhoud';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value + 'T12:00:00');
  return new Intl.DateTimeFormat('nl-NL', {day:'2-digit', month:'2-digit', year:'numeric'}).format(d);
}

function buildMessage() {
  const service = selectedService();
  const lines = [
    'Nieuwe aanvraag via Lattenspecialist.nl',
    '',
    `Dienst: ${service}`
  ];

  if (service === 'Onderhoud') {
    lines.push(
      `Materiaal: ${getValue('material')}`,
      `Aantal: ${getValue('amount')}`,
      `Pakket: ${getValue('package')}`,
      `Voorkeur ophalen: ${getValue('pickupday')}`,
      'Verwachte retour: daaropvolgende weekend'
    );
  } else {
    lines.push(
      `Verhuur: ${getValue('rentaltype')}`,
      `Lengte persoon: ${getValue('height') ? getValue('height') + ' cm' : '-'}`,
      `Schoenmaat: ${getValue('shoesize') || '-'}`,
      `Niveau: ${getValue('level')}`,
      `Periode: ${formatDate(getValue('rentfrom')) || '-'} t/m ${formatDate(getValue('rentto')) || '-'}`
    );
  }

  lines.push(
    '',
    `Naam: ${getValue('name') || '-'}`,
    `Mobiel: ${getValue('phone') || '-'}`,
    `Postcode: ${getValue('postcode') || '-'}`,
    `Adres / plaats: ${getValue('address') || '-'}`,
    `Opmerking: ${getValue('notes') || '-'}`,
    '',
    'Betaling: Tikkie na bevestiging.'
  );

  return lines.join('\n');
}

function updateSummary() {
  const service = selectedService();
  maintenanceFields.hidden = service !== 'Onderhoud';
  rentalFields.hidden = service !== 'Verhuur';
  summary.textContent = buildMessage();
}

form.addEventListener('input', updateSummary);
form.addEventListener('change', updateSummary);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const message = buildMessage();
  if (WHATSAPP_NUMBER) {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  } else {
    const subject = 'Nieuwe aanvraag via Lattenspecialist.nl';
    window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
});

updateSummary();
