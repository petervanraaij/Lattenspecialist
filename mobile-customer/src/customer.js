import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {SITE, normalizeCode, validCode, codeFromStatusHash, codeFromAppLink, escape, today, readTrip, formatDate, renderStatus} from './domain.js';

const endpoint = String(window.LATTENSPECIALIST_BOOKING?.endpoint || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const CODE_KEY = 'lattenspecialist-customer-code';
const TRIP_KEY = 'lattenspecialist-customer-trip';
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key,value) { try { localStorage.setItem(key,value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};
let currentCode = '';
let statusRequest = 0;
let offersRequest = 0;
let activeScreen = 'home';
let bookingStarted = false;
let bookingReady = false;
let bookingTimer;
let bookingPrefill = null;
const frame = $('bookingFrame');
const pages = ['home','onderhoud','aanvragen','aanbod','reis'];
const fail = message => `<div class="card"><p class="error">${escape(message)}</p></div>`;

async function fetchResource(url, json = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {cache:'no-store', signal:controller.signal, credentials:'omit'});
    if (!response.ok) { const error = new Error('Ophalen mislukt'); error.status=response.status; throw error; }
    return json ? await response.json() : await response.text();
  } finally { clearTimeout(timer); }
}

function updateSavedCode() {
  const saved = normalizeCode(storage.get(CODE_KEY));
  $('savedCodeArea').hidden = !validCode(saved);
  $('savedCodeLabel').textContent = validCode(saved) ? `Bewaard op dit toestel: ${saved}` : '';
}

async function loadStatus(code) {
  const request = ++statusRequest;
  $('statusResult').innerHTML = '<div class="empty"><p>Je actuele voortgang wordt opgehaald…</p></div>';
  $('statusSubmit').disabled = true;
  try {
    if (!validCode(code) || !endpoint) throw new Error('Ongeldige code');
    const data = await fetchResource(`${endpoint}/api/status/${encodeURIComponent(code)}`);
    if (request !== statusRequest) return;
    if (!data.record || normalizeCode(data.record.code) !== code) throw new Error('Ongeldig antwoord');
    currentCode = code;
    $('statusResult').innerHTML = renderStatus(data.record);
    if ($('statusForm').hidden) $('statusIntro').textContent = 'Hier zie je de actuele voortgang van jouw onderhoud. Je hoeft niets te installeren.';
    $('refreshStatus').addEventListener('click', () => loadStatus(currentCode));
    if ($('rememberCode').checked) {
      const ok = storage.set(CODE_KEY, code);
      $('codeFeedback').textContent = ok ? '' : 'Je toestel kon de code niet bewaren. De status is wel opgehaald.';
    } else storage.remove(CODE_KEY);
    updateSavedCode();
  } catch(error) {
    if (request !== statusRequest) return;
    const missing = error.status === 404 || error.status === 400;
    if (missing) showCodeForm();
    $('statusResult').innerHTML = fail(missing ? 'Deze onderhoudscode is niet gevonden. Controleer de code uit je bericht; je aanvraagcode is een andere code.' : 'Je actuele voortgang kon niet worden opgehaald. Controleer je internetverbinding en probeer het opnieuw.');
    if (!missing) {
      $('statusIntro').textContent = 'Je persoonlijke link is geopend. De voortgang is tijdelijk niet bereikbaar.';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'button dark'; retry.textContent = 'Opnieuw proberen';
      retry.addEventListener('click', () => loadStatus(code));
      $('statusResult').append(retry);
    }
  } finally { if (request === statusRequest) $('statusSubmit').disabled=false; }
}

function showCodeForm() {
  $('statusForm').hidden = false;
  $('changeCode').hidden = true;
  $('statusIntro').textContent = 'Vul de persoonlijke onderhoudscode in die je van ons ontvangt. Je aanvraagcode is een andere code.';
}
function openPersonalStatus(code) {
  ++statusRequest;
  currentCode = code;
  $('serviceCode').value = code;
  $('rememberCode').checked = storage.get(CODE_KEY) === code;
  if (!$('rememberCode').checked) storage.remove(CODE_KEY);
  updateSavedCode();
  $('codeFeedback').textContent = '';
  $('statusResult').innerHTML = '';
  $('statusForm').hidden = true;
  $('changeCode').hidden = false;
  $('statusIntro').textContent = 'Je persoonlijke voortgang wordt opgehaald. Je hoeft niets te installeren.';
  // Remove the personal code from browser history and subsequent navigation.
  history.replaceState(null, '', `${location.pathname}${location.search}#onderhoud`);
}
$('changeCode').addEventListener('click', () => { showCodeForm(); $('serviceCode').focus(); });

$('statusForm').addEventListener('submit', event => {
  event.preventDefault();
  const code = normalizeCode($('serviceCode').value);
  $('serviceCode').value = code;
  if (!validCode(code)) {
    ++statusRequest;
    currentCode = '';
    $('statusSubmit').disabled = false;
    $('statusResult').innerHTML = '';
    $('codeFeedback').textContent = 'Gebruik je onderhoudscode: LS- met 6 letters of cijfers. Een aanvraagcode (LS-2609-…) werkt hier niet.';
    return;
  }
  $('codeFeedback').textContent='';
  currentCode=code;
  if(storage.get(CODE_KEY)!==code){storage.remove(CODE_KEY);updateSavedCode();}
  loadStatus(code);
});
$('forgetCode').addEventListener('click', () => {
  ++statusRequest;
  storage.remove(CODE_KEY);
  currentCode=''; $('serviceCode').value=''; $('rememberCode').checked=false;
  $('statusSubmit').disabled=false;
  $('statusResult').innerHTML=''; $('codeFeedback').textContent='De code en getoonde voortgang zijn van dit toestel verwijderd.';
  showCodeForm();
  updateSavedCode();
});
$('rememberCode').addEventListener('change', () => {
  if (!$('rememberCode').checked) { storage.remove(CODE_KEY); updateSavedCode(); }
});

async function loadDates() {
  try {
    const data = await fetchResource(`${endpoint}/api/availability`);
    const dates = Array.isArray(data.dates) ? data.dates.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today()) : [];
    $('pickupDates').textContent = dates.length ? dates.slice(0,3).map(formatDate).join(' · ') : 'We stemmen de eerstvolgende mogelijkheid graag met je af.';
  } catch { $('pickupDates').textContent='De data konden niet worden opgehaald. Controleer ze in het aanvraagformulier.'; }
}

function loadBooking() {
  clearTimeout(bookingTimer);
  bookingStarted=true; bookingReady=false; frame.hidden=false;
  $('bookingLoadStatus').textContent='Het aanvraagformulier wordt geladen…';
  frame.src=`${SITE}/?app=klant`;
  bookingTimer=setTimeout(() => {
    if (!bookingReady) $('bookingLoadStatus').textContent='Het formulier reageert nog niet. Controleer je verbinding, laad opnieuw of gebruik de link naar de website hieronder.';
  },15000);
}
frame.addEventListener('load', () => frame.contentWindow?.postMessage({type:'lattenspecialist:hello'},SITE));
function sendPrefill() {
  if (bookingReady && bookingPrefill) {
    frame.contentWindow.postMessage({type:'lattenspecialist:prefill',values:bookingPrefill},SITE);
    bookingPrefill=null;
  }
}
window.addEventListener('message', event => {
  if (event.origin !== SITE || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'lattenspecialist:ready') {
    bookingReady=true; clearTimeout(bookingTimer); frame.hidden=false;
    $('bookingLoadStatus').textContent=''; sendPrefill();
  }
  if (event.data.type === 'lattenspecialist:height' && Number.isFinite(event.data.height)) frame.style.height=`${Math.max(600,Math.min(10000,event.data.height))}px`;
  if (event.data.type === 'lattenspecialist:booked' && /^LS-\d{4}-[A-Z2-9]{6}$/.test(event.data.reference || '')) {
    $('bookingLoadStatus').textContent=`Aanvraag ontvangen: ${event.data.reference}. De planning wordt persoonlijk bevestigd.`;
    $('bookingLoadStatus').scrollIntoView({block:'center'});
  }
  if (event.data.type === 'lattenspecialist:external') {
    try {
      const url = new URL(event.data.url);
      if (url.origin === SITE && ['/privacy.html','/service.html'].includes(url.pathname)) openExternal(url.href);
    } catch {}
  }
});
$('reloadBooking').addEventListener('click', loadBooking);
function requestBooking(values) { bookingPrefill=values; if(activeScreen==='aanvragen') sendPrefill(); else location.hash='aanvragen'; }
$('requestRental').addEventListener('click', () => requestBooking({service:'Verhuur'}));

async function loadOffers() {
  const request=++offersRequest;
  $('packages').innerHTML='<p>Pakketten ophalen…</p>';
  $('inventory').innerHTML='<p>Verhuuraanbod ophalen…</p>';
  await Promise.allSettled([
    (async () => {
      try {
        const html=await fetchResource(`${SITE}/`,false);
        if(request!==offersRequest)return;
        const site=new DOMParser().parseFromString(html,'text/html');
        const cards=[...site.querySelectorAll('#pakketten .package-card')];
        if(!cards.length) throw new Error();
        $('packages').innerHTML=cards.map(card => {
          const tier=card.querySelector('.tier')?.textContent.trim() || '';
          const name=card.querySelector('h3')?.textContent || tier;
          const prices=[...card.querySelectorAll('.price-row > div')].map(p=>`<div><small>${escape(p.querySelector('small')?.textContent)}</small><strong>${escape(p.querySelector('strong')?.textContent)}</strong></div>`).join('');
          const points=[...card.querySelectorAll('li')].map(li=>`<li>${escape(li.textContent)}</li>`).join('');
          return `<article class="card"><span class="tag">${escape(tier)}</span><h2>${escape(name)}</h2><div class="price-row">${prices}</div><ul class="package-features">${points}</ul><p class="muted">Inclusief btw.</p><button class="button dark" type="button" data-package="${escape(tier)}">${escape(tier)} aanvragen</button></article>`;
        }).join('');
      } catch { if(request===offersRequest)$('packages').innerHTML=fail('De actuele pakketten en prijzen zijn niet bereikbaar. Vernieuw het aanbod of bekijk de website.'); }
    })(),
    (async () => {
      try {
        const data=await fetchResource(`${SITE}/data/aanbod.json`);
        if(request!==offersRequest)return;
        if(!Array.isArray(data.items))throw new Error();
        $('inventory').innerHTML=data.items.length ? data.items.map(item=>`<article class="card"><span class="eyebrow">${escape(item.type)}</span><h3>${escape(item.title)}</h3><p>${escape(item.details)}</p><span class="availability ${item.available?'':'unavailable'}">${item.available?'Beschikbaar':'Verhuurd'}</span></article>`).join('') : '<div class="card"><h3>Wat heb je nodig?</h3><p>Er staat nu geen vast openbaar aanbod online. Geef je maat, niveau en reisperiode door. We bekijken wat beschikbaar is of geregeld kan worden.</p></div>';
      } catch { if(request===offersRequest)$('inventory').innerHTML=fail('Het actuele verhuuraanbod is tijdelijk niet beschikbaar. Je kunt wel een aanvraag doen.'); }
    })()
  ]);
}
$('packages').addEventListener('click', event => {
  const button=event.target.closest('[data-package]');
  if(button)requestBooking({service:'Onderhoud',package:button.dataset.package});
});
$('refreshOffers').addEventListener('click',loadOffers);

function getSavedTrip() { try { return readTrip(JSON.parse(storage.get(TRIP_KEY))); } catch { return null; } }
function showTrip(trip, saved = true) {
  $('tripResult').hidden=false;
  const weather=`https://www.google.com/search?q=${encodeURIComponent(`weer sneeuw ${trip.destination} skigebied`)}`;
  $('tripResult').innerHTML=`<span class="tag">${saved?'Bewaard op dit toestel':'Reis ingevuld'}</span><h2>${escape(trip.destination)}</h2><p>Eerste skidag: ${escape(formatDate(trip.skidate))}</p><p>${escape(trip.conditions)}</p>${trip.skidate<today()?'<p class="error">Deze reisdatum is voorbij. Pas de datum aan voor een nieuwe aanvraag.</p>':''}<a class="text-link" href="${escape(weather)}">Bekijk weer en sneeuwverwachting ↗</a>`;
}
$('skiDate').min=today();
const savedTrip=getSavedTrip();
if(savedTrip){ for(const [name,value] of Object.entries(savedTrip)) $('tripForm').elements[name].value=value; showTrip(savedTrip); }
$('tripForm').addEventListener('submit', event => {
  event.preventDefault();
  const trip=readTrip(Object.fromEntries(new FormData($('tripForm'))));
  if(trip)showTrip(trip,storage.set(TRIP_KEY,JSON.stringify(trip)));
});
$('tripBooking').addEventListener('click', () => {
  if(!$('tripForm').reportValidity())return;
  const trip=readTrip(Object.fromEntries(new FormData($('tripForm'))));
  if(trip)requestBooking({...trip,service:'Onderhoud'});
});
$('clearTrip').addEventListener('click', () => {storage.remove(TRIP_KEY); $('tripForm').reset(); $('tripResult').hidden=false; $('tripResult').textContent='De reis is van dit toestel verwijderd.';});

async function openExternal(url) {
  try {
    if(Capacitor.isNativePlatform()) await Browser.open({url, toolbarColor:'#0b0b0c'});
    else window.open(url,'_blank','noopener,noreferrer');
  } catch { $('offlineNotice').hidden=false; $('offlineNotice').textContent='De link kon niet worden geopend. Probeer het opnieuw.'; }
}
document.addEventListener('click', event => {
  const a=event.target.closest('a[href^="https://"]');
  if(!a)return;
  event.preventDefault(); openExternal(a.href);
});
function navigate(focus = true) {
  let hash=location.hash.slice(1);
  if (hash.toLowerCase().startsWith('status=')) {
    const code=codeFromStatusHash(location.hash);
    if (code) openPersonalStatus(code);
    else {
      ++statusRequest; currentCode=''; $('statusSubmit').disabled=false;
      $('serviceCode').value=''; $('statusResult').innerHTML=''; showCodeForm();
      $('codeFeedback').textContent='Deze persoonlijke link is niet geldig. Gebruik de onderhoudscode uit je bericht of vraag ons om een nieuwe link.';
      history.replaceState(null, '', `${location.pathname}${location.search}#onderhoud`);
    }
    hash='onderhoud';
  }
  const page=({status:'onderhoud',waxplanner:'reis'})[hash] || hash;
  activeScreen=pages.includes(page)?page:'home';
  for(const id of pages)$(id).hidden=id!==activeScreen;
  for(const link of document.querySelectorAll('.bottom-nav a')) {
    if(link.hash===`#${activeScreen}`)link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  }
  if(focus){window.scrollTo(0,0); $(activeScreen).querySelector('h1')?.focus({preventScroll:true});}
  if(activeScreen==='home')loadDates();
  if(activeScreen==='onderhoud' && currentCode)loadStatus(currentCode);
  if(activeScreen==='aanvragen'){if(!bookingStarted)loadBooking();else sendPrefill();}
  if(activeScreen==='aanbod')loadOffers();
}
window.addEventListener('hashchange',() => navigate());
const savedCode=normalizeCode(storage.get(CODE_KEY));
if(validCode(savedCode)){currentCode=savedCode;$('serviceCode').value=savedCode;$('rememberCode').checked=true;}
updateSavedCode();
function updateConnection(){ $('offlineNotice').hidden=navigator.onLine; if(!navigator.onLine)$('offlineNotice').textContent='Je bent offline. Voor actuele voortgang, aanbod en aanvragen is internet nodig.'; }
window.addEventListener('online',() => {updateConnection(); if(activeScreen==='onderhoud'&&currentCode)loadStatus(currentCode);if(activeScreen==='home')loadDates();});
window.addEventListener('offline',updateConnection);
document.addEventListener('visibilitychange',() => {if(!document.hidden&&activeScreen==='onderhoud'&&currentCode)loadStatus(currentCode);});
if(Capacitor.isNativePlatform()) {
  const openAppLink = url => {
    const code=codeFromAppLink(url);
    if (!code) return;
    openPersonalStatus(code); navigate();
  };
  App.addListener('appUrlOpen', ({url}) => openAppLink(url));
  App.getLaunchUrl().then(result => { if(result?.url)openAppLink(result.url); }).catch(() => {});
  App.addListener('backButton',() => { if(activeScreen!=='home')location.hash='home';else App.exitApp(); });
  App.addListener('appStateChange',({isActive}) => {if(isActive&&activeScreen==='onderhoud'&&currentCode)loadStatus(currentCode);});
}
updateConnection();navigate(false);
