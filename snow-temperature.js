(() => {
  const root = document.querySelector('#snowLive');
  if (!root) return;

  const grid = document.querySelector('#snowResortGrid');
  const status = document.querySelector('#snowLiveStatus');
  const indoorGrid = document.querySelector('#snowIndoorGrid');
  const searchForm = document.querySelector('#snowSearchForm');
  const searchInput = document.querySelector('#snowSearchInput');
  const searchResult = document.querySelector('#snowSearchResult');
  const resorts = [
    {name:'Sölden', country:'Oostenrijk', elevation:2850, latitude:46.92, longitude:10.93},
    {name:'Ischgl', country:'Oostenrijk', elevation:2500, latitude:46.98, longitude:10.31},
    {name:'Gerlos', country:'Oostenrijk', elevation:2300, latitude:47.23, longitude:12.02},
    {name:'Val Thorens', country:'Frankrijk', elevation:2500, latitude:45.30, longitude:6.58},
    {name:'Tignes', country:'Frankrijk', elevation:2700, latitude:45.45, longitude:6.90},
    {name:'Zermatt', country:'Zwitserland', elevation:2900, latitude:45.99, longitude:7.74}
  ];
  const indoorSlopes = ['Landgraaf','Zoetermeer','Amsterdam','Rucphen-Breda','Terneuzen'];
  const endpoint = 'https://api.open-meteo.com/v1/dwd-icon';
  const geocodingEndpoint = 'https://geocoding-api.open-meteo.com/v1/search';
  const cacheKey = 'lattenspecialist-snow-conditions-v1';
  const formatTemperature = value => `${new Intl.NumberFormat('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} °C`;
  const formatDepth = value => `${Math.round(value * 100)} cm sneeuwdek`;
  const includedWaxAdvice = temperature => temperature < -14 ? 'UltraMix Blue' : temperature < -4 ? 'BetaMix Red' : 'AlphaMix Yellow';
  const element = (name,className,text) => {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function addWaxMatch(card,estimatedSnow) {
    const includedWax = includedWaxAdvice(estimatedSnow);
    const waxMatch = element('div','snow-resort-wax-match');
    waxMatch.append(element('span','snow-resort-wax-label','Waxmatch bij deze sneeuw'));
    if (estimatedSnow >= -12) {
      waxMatch.append(element('strong','snow-resort-wax snow-resort-wax--performance','Performance Purple · + € 7,50'));
      waxMatch.append(element('span','snow-resort-wax-included',`Inbegrepen alternatief: ${includedWax}`));
    } else {
      waxMatch.append(element('strong','snow-resort-wax snow-resort-wax--included',includedWax));
      waxMatch.append(element('span','snow-resort-wax-included','Inbegrepen bij ieder waxpakket'));
    }
    const waxLink = element('a','snow-resort-wax-link',estimatedSnow >= -12 ? 'Kies Performance bij je pakket →' : `Kies ${includedWax} bij je pakket →`);
    waxLink.href = '#pakketten';
    waxMatch.append(waxLink);
    card.append(waxMatch);
  }
  function createResortCard(resort,current) {
    const card = element('article','snow-resort-card');
    card.append(element('h4','',resort.name));
    card.append(element('span','snow-resort-location',`${resort.country} · modelpunt ${Math.round(resort.elevation)} m`));
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.snow_depth)) {
      card.append(element('strong','snow-resort-temperature is-no-snow','Geen actuele data'));
      card.append(element('span','snow-resort-meta','Probeer het later opnieuw.'));
    } else if (current.snow_depth < 0.01) {
      card.append(element('strong','snow-resort-temperature is-no-snow','Geen sneeuwdek in model'));
      card.append(element('span','snow-resort-meta',`Lucht ${formatTemperature(current.temperature_2m)}`));
    } else {
      const estimatedSnow = Math.min(0,current.temperature_2m);
      card.append(element('span','snow-resort-location','Geschatte sneeuwtemperatuur'));
      card.append(element('strong','snow-resort-temperature',`≈ ${formatTemperature(estimatedSnow)}`));
      card.append(element('span','snow-resort-meta',`Lucht ${formatTemperature(current.temperature_2m)} · ${formatDepth(current.snow_depth)}`));
      addWaxMatch(card,estimatedSnow);
    }
    return card;
  }
  function renderIndoorSlopes() {
    if (!indoorGrid) return;
    indoorGrid.replaceChildren(...indoorSlopes.map(name => {
      const card = element('article','snow-indoor-card');
      card.append(element('h5','',`SnowWorld ${name}`));
      card.append(element('span','','Indoor · echte sneeuw'));
      card.append(element('span','snow-indoor-temperature','-5 °C op de piste'));
      const wax = element('div','snow-indoor-wax');
      wax.append(element('strong','','Performance Purple'));
      wax.append(element('span','', 'Inbegrepen alternatief: BetaMix Red'));
      card.append(wax);
      return card;
    }));
  }
  function render(payload, cached = false) {
    const rows = Array.isArray(payload) ? payload : [payload];
    grid.replaceChildren();
    resorts.forEach((resort,index) => {
      grid.append(createResortCard(resort,rows[index]?.current));
    });
    const times = rows.map(row => row.current?.time).filter(Boolean).sort();
    const time = times.at(-1)?.split('T')[1] || '';
    status.className = 'snow-live-status';
    status.textContent = cached ? `Laatste beschikbare modelgegevens${time ? ` van ${time} uur` : ''}; live verversen lukt momenteel niet.` : `Live modelgegevens bijgewerkt${time ? ` om ${time} uur` : ''}.`;
    grid.setAttribute('aria-busy','false');
  }
  function cachedPayload() {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      return cached && Date.now() - cached.savedAt < 3 * 60 * 60 * 1000 ? cached.payload : null;
    } catch { return null; }
  }
  async function refresh() {
    grid.setAttribute('aria-busy','true');
    const url = new URL(endpoint);
    url.searchParams.set('latitude',resorts.map(item => item.latitude).join(','));
    url.searchParams.set('longitude',resorts.map(item => item.longitude).join(','));
    url.searchParams.set('elevation',resorts.map(item => item.elevation).join(','));
    url.searchParams.set('current','temperature_2m,snow_depth');
    url.searchParams.set('timezone','Europe/Amsterdam');
    try {
      const response = await fetch(url,{cache:'no-store'});
      if (!response.ok) throw new Error('Weather request failed');
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length !== resorts.length) throw new Error('Incomplete weather data');
      try { localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),payload})); } catch {}
      render(payload);
    } catch {
      const cached = cachedPayload();
      if (cached) return render(cached,true);
      grid.replaceChildren(element('article','snow-resort-card is-loading','Live sneeuwgegevens zijn tijdelijk niet beschikbaar.'));
      grid.setAttribute('aria-busy','false');
      status.className = 'snow-live-status is-error';
      status.textContent = 'De waxkeuze hierboven blijft beschikbaar; probeer de live condities later opnieuw.';
    }
  }
  async function searchDestination(event) {
    event.preventDefault();
    const query = searchInput?.value.trim();
    if (!query || !searchResult) return;
    const button = searchForm.querySelector('button');
    button.disabled = true;
    searchResult.hidden = false;
    searchResult.setAttribute('aria-busy','true');
    searchResult.replaceChildren(element('p','snow-search-message',`We zoeken ${query} en halen de actuele sneeuwcondities op…`));
    try {
      const geocodingUrl = new URL(geocodingEndpoint);
      geocodingUrl.searchParams.set('name',query);
      geocodingUrl.searchParams.set('count','1');
      geocodingUrl.searchParams.set('language','nl');
      geocodingUrl.searchParams.set('format','json');
      const locationResponse = await fetch(geocodingUrl,{cache:'no-store'});
      if (!locationResponse.ok) throw new Error('Location request failed');
      const locationPayload = await locationResponse.json();
      const place = locationPayload.results?.[0];
      if (!place) {
        searchResult.replaceChildren(element('p','snow-search-message',`Geen bestemming gevonden voor “${query}”. Probeer de plaatsnaam of het skigebied.`));
        return;
      }
      const weatherUrl = new URL(endpoint);
      weatherUrl.searchParams.set('latitude',place.latitude);
      weatherUrl.searchParams.set('longitude',place.longitude);
      if (Number.isFinite(place.elevation)) weatherUrl.searchParams.set('elevation',place.elevation);
      weatherUrl.searchParams.set('current','temperature_2m,snow_depth');
      weatherUrl.searchParams.set('timezone','Europe/Amsterdam');
      const weatherResponse = await fetch(weatherUrl,{cache:'no-store'});
      if (!weatherResponse.ok) throw new Error('Weather request failed');
      const weatherPayload = await weatherResponse.json();
      const resort = {
        name:place.name,
        country:[place.admin1,place.country].filter(Boolean).join(', '),
        elevation:Number.isFinite(place.elevation) ? place.elevation : 0
      };
      searchResult.replaceChildren(createResortCard(resort,weatherPayload.current));
    } catch {
      searchResult.replaceChildren(element('p','snow-search-message','Deze bestemming kan nu niet worden opgehaald. Controleer de spelling of probeer het later opnieuw.'));
    } finally {
      searchResult.setAttribute('aria-busy','false');
      button.disabled = false;
    }
  }
  renderIndoorSlopes();
  searchForm?.addEventListener('submit',searchDestination);
  refresh();
  window.setInterval(refresh,15 * 60 * 1000);
})();
