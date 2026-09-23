// The web app and its booking form share an origin; native apps use the public site.
export const SITE = typeof __WEB_APP__ !== 'undefined' && __WEB_APP__ ? window.location.origin : 'https://lattenspecialist.nl';
export const STEPS = ['Aanvraag ontvangen', 'Ophalen of brengen gepland', 'Materiaal ontvangen', 'Inspectie uitgevoerd', 'Onderhoud gestart', 'Wax koelt af', 'Finish en eindcontrole', 'Klaar voor ophalen of terugbrengen'];
export const CONDITIONS = ['Weet ik nog niet', 'Zacht / warm', 'Rond het vriespunt', 'Koud', 'Kunstsneeuw / hard / ijzig'];
export const normalizeCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
export const validCode = value => /^LS-[A-Z2-9]{6}$/.test(value);
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
  const step = Math.max(1, Math.min(STEPS.length, Number(record.currentStep) || 1));
  const progress = record.closed ? '<p class="status-note">Deze aanvraag is afgemeld. Neem bij vragen contact met ons op.</p>' : `<ol class="status-steps">${STEPS.map((label,i) => `<li class="${i+1<step?'done':i+1===step?'current':''}"><span>${i+1<step?'✓':i+1}</span>${escape(label)}</li>`).join('')}</ol>`;
  return `<article class="card"><div class="status-label"><span>${escape(record.code)}</span><span>${record.closed?'Afgemeld':`Stap ${step} van ${STEPS.length}`}</span></div><h2>${escape(record.material || 'Jouw materiaal')}</h2><p>${escape(record.status || STEPS[step-1])}</p>${progress}<dl class="status-details"><div><dt>Pakket</dt><dd>${escape(record.package || 'In overleg')}</dd></div><div><dt>Verwacht klaar</dt><dd>${escape(record.expectedReady ? formatDate(record.expectedReady) : 'Nog niet gepland')}</dd></div><div><dt>Gekozen wax</dt><dd>${escape(record.waxType || 'Nog te bepalen')}</dd></div><div><dt>Laatst bijgewerkt</dt><dd>${escape(record.updatedAt ? formatDate(record.updatedAt) : 'Nog niet bekend')}</dd></div></dl>${record.note?`<p class="status-note">${escape(record.note)}</p>`:''}<button class="text-button" type="button" id="refreshStatus">Voortgang vernieuwen</button></article>`;
}
