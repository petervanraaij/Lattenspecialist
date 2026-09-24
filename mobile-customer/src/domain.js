// The web app and its booking form share an origin; native apps use the public site.
export const SITE = typeof __WEB_APP__ !== 'undefined' && __WEB_APP__ ? window.location.origin : 'https://lattenspecialist.nl';
export const STEPS = ['Aanvraag ontvangen', 'Ophalen of brengen gepland', 'Materiaal ontvangen', 'Inspectie uitgevoerd', 'Onderhoud gestart', 'Wax koelt af', 'Finish en eindcontrole', 'Klaar voor ophalen of terugbrengen'];
export const CONDITIONS = ['Weet ik nog niet', 'Zacht / warm', 'Rond het vriespunt', 'Koud', 'Kunstsneeuw / hard / ijzig'];
export const normalizeCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
export const validCode = value => /^LS-[A-Z2-9]{6}$/.test(value);
export const validCustomerToken = value => /^[a-f0-9]{64}$/.test(value || '');
export function tokenFromStatusHash(hash) {
  const match = /^#klant=([a-f0-9]{64})$/.exec(String(hash));
  return match ? match[1] : '';
}
export function tokenFromAppLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://lattenspecialist.nl' || url.pathname !== '/app.html' || url.search || url.username || url.password) return '';
    return tokenFromStatusHash(url.hash);
  } catch { return ''; }
}
export function safePaymentUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function codeFromStatusHash(hash) {
  try {
    const match = /^#status=(LS-[A-Z2-9]{6})$/i.exec(decodeURIComponent(String(hash)));
    return match ? normalizeCode(match[1]) : '';
  } catch { return ''; }
}
export function codeFromAppLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://lattenspecialist.nl' || url.pathname !== '/app.html' || url.search || url.username || url.password) return '';
    return codeFromStatusHash(url.hash);
  } catch { return ''; }
}
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
export const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
};
export function readTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const destination = String(raw.destination || '').trim().slice(0,100);
  const skidate = String(raw.skidate || '');
  if (!destination || !validDate(skidate)) return null;
  return {destination, skidate, conditions: CONDITIONS.includes(raw.conditions) ? raw.conditions : CONDITIONS[0]};
}
export function formatDate(value) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('nl-NL', {day:'numeric',month:'long',year:'numeric'}).format(date);
}
export function renderStatus(record) {
  const step = Math.max(1, Math.min(STEPS.length, Math.trunc(Number(record.currentStep)) || 1));
  const next = record.closed ? 'Deze aanvraag is afgemeld. Neem bij vragen contact met ons op.'
    : step === 1 ? 'We nemen contact met je op om de planning te bevestigen. Je aanvraag is nog geen definitieve afspraak.'
    : step === 2 ? 'Houd je materiaal klaar voor de afgesproken ophaal- of brengafspraak.'
    : step === 8 ? 'Je materiaal is klaar. We stemmen het ophalen of terugbrengen met je af.'
    : 'Je materiaal is bij ons in behandeling. Je hoeft nu niets te doen; hier zie je de laatste stand.';
  const progress = record.closed ? '' : `<details class="progress-details"><summary>Bekijk alle onderhoudsstappen</summary><ol class="status-steps">${STEPS.map((label,i) => `<li class="${i+1<step?'done':i+1===step?'current':''}"${i+1===step?' aria-current="step"':''}><span aria-hidden="true">${i+1<step?'✓':i+1}</span>${escape(label)}</li>`).join('')}</ol></details>`;
  const waxChosen = record.waxType && record.waxType !== 'Nog te bepalen';
  let payment;
  const amount = String(record.payment?.amount || '');
  const validAmount = /^\d{1,4}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const formatted = validAmount ? new Intl.NumberFormat('nl-NL', {style:'currency',currency:'EUR'}).format(Number(amount)) : '';
  const payUrl = safePaymentUrl(record.payment?.url);
  if (record.payment?.state === 'paid' && validAmount) {
    payment = `<span class="tag">Betaling ontvangen</span><h2>Bedankt, je betaling is verwerkt</h2><p class="payment-amount">${escape(formatted)}</p><p>De Lattenspecialist heeft de ontvangst geregistreerd.</p>`;
  } else if (!record.closed && record.payment?.state === 'open' && validAmount && payUrl) {
    payment = `<span class="tag">Betaalverzoek</span><h2>Je betaalverzoek staat klaar</h2><p class="payment-amount">${escape(formatted)}</p><a class="button gold" id="customerPayment" href="${escape(payUrl)}" target="_blank" rel="noopener noreferrer">Betaal ${escape(formatted)} <span aria-hidden="true">↗</span></a><p class="muted">Je betaalt via ${escape(new URL(payUrl).hostname)}. Al betaald? We werken dit bij zodra we je betaling hebben gecontroleerd.</p>`;
  } else {
    payment = `<span class="tag">Betaling</span><h2>${record.closed?'Geen actief betaalverzoek':record.payment?'Nog geen betaalverzoek':'Je betaalverzoek bekijken'}</h2><p>${record.closed?'Neem bij een vraag over betaling contact met ons op.':record.payment?'Zodra je betaalverzoek klaarstaat, vind je het hier.':'Open de persoonlijke link uit je nieuwste bericht om je betaalverzoek te bekijken.'}</p>`;
  }
  return `<div class="maintenance-overview">
    <article class="card maintenance-summary"><div class="status-label"><span>${escape(record.code)}</span><span>${record.closed?'Afgemeld':`Stap ${step} van ${STEPS.length}`}</span></div><h2>${escape(record.closed ? 'Aanvraag afgemeld' : record.status || STEPS[step-1])}</h2><p>${escape(record.material || 'Jouw materiaal')} · ${escape(record.package || 'In overleg')}</p><div class="next-step"><h3>Wat gebeurt er nu?</h3><p>${next}</p></div></article>
    <dl class="status-details"><div><dt>Verwacht klaar</dt><dd>${escape(record.expectedReady ? formatDate(record.expectedReady) : 'We stemmen dit met je af')}</dd></div><div><dt>Laatst bijgewerkt</dt><dd>${escape(record.updatedAt && !Number.isNaN(new Date(record.updatedAt).getTime()) ? new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'}).format(new Date(record.updatedAt)) : 'Nog niet bekend')}</dd></div>${record.pickupDate?`<div><dt>Aangevraagde ophaaldatum</dt><dd>${escape(record.pickupDate==='In overleg'?'In overleg':formatDate(record.pickupDate))}</dd></div>`:''}</dl>
    ${record.note?`<article class="card"><span class="eyebrow">Bericht van De Lattenspecialist</span><p class="status-note">${escape(record.note)}</p></article>`:''}
    <div class="maintenance-grid"><article class="card wax-card"><span class="tag">Wax voor jouw beurt</span><h2>${escape(waxChosen ? record.waxType : 'Waxkeuze volgt')}</h2><p>${waxChosen?'Dit is de wax die voor deze onderhoudsbeurt is geselecteerd.':'We kiezen de wax bij het onderhoud. Je bestemming, reisdatum en verwachte sneeuwcondities helpen daarbij.'}</p></article><article class="card payment-card">${payment}</article></div>
    ${progress}<div class="status-actions"><button class="text-button" type="button" id="refreshStatus">Voortgang vernieuwen</button><a class="text-link" href="https://wa.me/31618327132">Vraag over je onderhoud? →</a></div>
  </div>`;
}
