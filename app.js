const WHATSAPP_NUMBER = '31618327132';
const STATUS_STEPS = [
  'Aanvraag ontvangen',
  'Ophalen of brengen gepland',
  'Materiaal ontvangen',
  'Inspectie uitgevoerd',
  'Onderhoud gestart',
  'Wax koelt af',
  'Finish en eindcontrole',
  'Klaar voor ophalen of terugbrengen'
];

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function formatDate(value) {
  if (!value) return 'Nog niet gepland';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('nl-NL', {day: '2-digit', month: 'long', year: 'numeric'}).format(date);
}

const statusForm = document.getElementById('statusForm');
const statusResult = document.getElementById('statusResult');

statusForm.addEventListener('submit', async event => {
  event.preventDefault();
  const code = String(new FormData(statusForm).get('code') || '').trim().toUpperCase().replace(/\s+/g, '');
  statusResult.innerHTML = '<div class="empty-state"><strong>Status ophalen…</strong></div>';
  try {
    const response = await fetch(`data/status.json?ts=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('Statusbestand niet beschikbaar');
    const data = await response.json();
    const record = (data.records || []).find(item => String(item.code || '').toUpperCase().replace(/\s+/g, '') === code);
    if (!record) {
      statusResult.innerHTML = `<div class="empty-state"><strong>Code niet gevonden</strong><p>Controleer de code uit je bevestiging. Heb je nog geen code, neem dan contact op via WhatsApp.</p><a class="text-link" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hallo De Lattenspecialist, ik heb een vraag over mijn servicecode ${code}.`)}" target="_blank" rel="noopener">Vraag het via WhatsApp →</a></div>`;
      return;
    }
    const currentStep = Math.max(1, Math.min(STATUS_STEPS.length, Number(record.currentStep) || 1));
    const steps = STATUS_STEPS.map((label, index) => {
      const number = index + 1;
      const state = number < currentStep ? 'done' : number === currentStep ? 'current' : '';
      return `<li class="${state}"><span>${number < currentStep ? '✓' : number}</span><strong>${escapeHtml(label)}</strong></li>`;
    }).join('');
    statusResult.innerHTML = `
      <div class="status-head"><span class="status-code">${escapeHtml(record.code)}</span><span>Bijgewerkt ${escapeHtml(record.updatedAt || data.updated || '')}</span></div>
      <h3>${escapeHtml(record.material || 'Ski- of snowboardonderhoud')}</h3>
      <p>${escapeHtml(record.status || STATUS_STEPS[currentStep - 1])}</p>
      <ul class="status-steps">${steps}</ul>
      <div class="status-meta"><span><b>Pakket</b>${escapeHtml(record.package || 'In overleg')}</span><span><b>Verwacht klaar</b>${escapeHtml(record.expectedReady || 'Nog niet gepland')}</span></div>
      ${record.note ? `<p class="status-note">${escapeHtml(record.note)}</p>` : ''}`;
  } catch (error) {
    statusResult.innerHTML = '<div class="empty-state"><strong>Status tijdelijk niet beschikbaar</strong><p>Probeer het later opnieuw of neem contact op via WhatsApp.</p></div>';
  }
});

const waxForm = document.getElementById('waxForm');
const waxResult = document.getElementById('waxResult');

const temperatureAdvice = {
  unknown: ['Nog geen temperatuurbereik gekozen', 'Controleer kort voor vertrek de verwachting op hoogte.'],
  warm: ['Warme waxcategorie', 'Let extra op natte sneeuw en het afvoeren van water.'],
  nearzero: ['Warm tot middentemperatuurbereik', 'Een veelzijdige premium wax past vaak bij wisselende omstandigheden rond het vriespunt.'],
  cold: ['Middentemperatuur tot koude waxcategorie', 'Koudere sneeuw vraagt doorgaans om een hardere wax.'],
  verycold: ['Extra koude waxcategorie', 'Zeer koude, droge sneeuw is scherp en vraagt om een harde, slijtvaste wax.']
};

const snowAdvice = {
  unknown: 'Het soort sneeuw wordt bij de definitieve keuze nog meegenomen.',
  fresh: 'Verse sneeuwkristallen kunnen scherp zijn; temperatuur en luchtvochtigheid bepalen de definitieve keuze.',
  old: 'Oude of omgevormde sneeuw vraagt aandacht voor vervuiling en slijtvastheid.',
  artificial: 'Kunstsneeuw is vaak harder en agressiever; slijtvastheid weegt daarom zwaarder.',
  icy: 'Harde of ijzige pistes vragen naast passende wax vooral goed onderhouden kanten.',
  wet: 'Natte sneeuw vraagt een wax en structuur die water goed afvoeren.'
};

waxForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(waxForm));
  const [category, temperatureNote] = temperatureAdvice[values.temperature] || temperatureAdvice.unknown;
  const tripDate = new Date(`${values.date}T12:00:00`);
  const daysUntil = Math.ceil((tripDate.getTime() - Date.now()) / 86400000);
  let forecastNote = 'De weersverwachting is nog niet betrouwbaar genoeg voor een definitieve waxkeuze.';
  if (daysUntil >= 0 && daysUntil <= 16) forecastNote = 'Je reis valt binnen ongeveer zestien dagen. Controleer nu de actuele verwachting op hoogte.';
  if (daysUntil < 0) forecastNote = 'De ingevulde datum ligt in het verleden; controleer de reisdatum.';
  const humidityNote = values.humidity === 'humid'
    ? 'Bij vochtige omstandigheden telt waterafvoer extra mee.'
    : values.humidity === 'dry'
      ? 'Bij droge omstandigheden letten we extra op hardheid en slijtvastheid.'
      : 'De luchtvochtigheid nemen we mee zodra die bekend is.';

  const message = [
    'Hallo De Lattenspecialist,',
    '',
    'Ik wil mijn waxkeuze afstemmen op mijn wintersport:',
    `Bestemming: ${values.destination}`,
    `Eerste skidag: ${formatDate(values.date)}`,
    `Temperatuur: ${waxForm.elements.temperature.options[waxForm.elements.temperature.selectedIndex].text}`,
    `Sneeuw: ${waxForm.elements.snow.options[waxForm.elements.snow.selectedIndex].text}`,
    `Klimaat: ${waxForm.elements.humidity.options[waxForm.elements.humidity.selectedIndex].text}`,
    `Gebruik: ${values.usage}`
  ].join('\n');

  const weatherUrl = `https://www.google.com/search?q=${encodeURIComponent(`weer ${values.destination} skigebied`)}`;
  waxResult.innerHTML = `
    <span class="result-label">Voorbereiding voor ${escapeHtml(values.destination)}</span>
    <h3>${escapeHtml(category)}</h3>
    <p><strong>Eerste skidag:</strong> ${escapeHtml(formatDate(values.date))}</p>
    <ul class="result-list"><li>${escapeHtml(temperatureNote)}</li><li>${escapeHtml(snowAdvice[values.snow] || snowAdvice.unknown)}</li><li>${escapeHtml(humidityNote)}</li><li>${escapeHtml(forecastNote)}</li></ul>
    <p class="result-caution">Dit is een voorbereiding, geen definitief productadvies. De uiteindelijke wax kiezen we op basis van de actuele verwachting en de staat van het materiaal.</p>
    <div class="result-actions"><a class="btn btn-gold" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Bespreek via WhatsApp</a><a class="text-link" href="${weatherUrl}" target="_blank" rel="noopener">Bekijk weersverwachting →</a></div>`;
});

async function loadInventory() {
  const list = document.getElementById('inventoryList');
  try {
    const response = await fetch(`data/aanbod.json?ts=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('Aanbod niet beschikbaar');
    const data = await response.json();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      list.innerHTML = '<article class="inventory-empty"><strong>Verhuur op aanvraag</strong><p>Er staat nu geen vast openbaar aanbod online. Stuur je lengte, schoenmaat, niveau en reisperiode; dan bekijken we wat beschikbaar is of geregeld kan worden.</p></article>';
      return;
    }
    list.innerHTML = data.items.map(item => `<article class="inventory-card"><span>${escapeHtml(item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.details || '')}</p><strong class="availability ${item.available ? 'available' : 'unavailable'}">${item.available ? 'Beschikbaar' : 'Verhuurd'}</strong></article>`).join('');
  } catch (error) {
    list.innerHTML = '<article class="inventory-empty"><strong>Aanbod tijdelijk niet beschikbaar</strong><p>Neem contact op voor de actuele mogelijkheden.</p></article>';
  }
}
loadInventory();

let installPrompt;
const installButton = document.getElementById('installApp');
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
