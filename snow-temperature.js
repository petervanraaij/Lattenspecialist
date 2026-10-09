(() => {
  const root = document.querySelector('#snowLive');
  if (!root) return;

  const grid = document.querySelector('#snowResortGrid');
  const status = document.querySelector('#snowLiveStatus');
  const searchForm = document.querySelector('#snowSearchForm');
  const searchInput = document.querySelector('#snowSearchInput');
  const searchResult = document.querySelector('#snowSearchResult');
  const resorts = [
    {name:'Sölden', country:'Oostenrijk', elevation:2850, latitude:46.92, longitude:10.93},
    {name:'Ischgl', country:'Oostenrijk', elevation:2500, latitude:46.98, longitude:10.31},
    {name:'Gerlos', country:'Oostenrijk', elevation:2300, latitude:47.23, longitude:12.02},
    {name:'Val Thorens', country:'Frankrijk', elevation:2500, latitude:45.30, longitude:6.58},
    {name:'Tignes', country:'Frankrijk', elevation:2700, latitude:45.45, longitude:6.90},
    {name:'Zermatt', country:'Zwitserland', elevation:2900, latitude:45.99, longitude:7.74},
    {name:'Winterberg', country:'Duitsland', elevation:800, latitude:51.20, longitude:8.53}
  ];
  const endpoint = 'https://api.open-meteo.com/v1/dwd-icon';
  const geocodingEndpoint = 'https://geocoding-api.open-meteo.com/v1/search';
  const cacheKey = 'lattenspecialist-snow-conditions-v3';
  let selectedResortIndex = 0;
  const formatTemperature = value => `${new Intl.NumberFormat('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} °C`;
  const formatDepth = value => `${Math.round(value * 100)} cm sneeuwdek`;
  const includedWaxAdvice = temperature => temperature < -14 ? 'UltraMix Blue' : temperature < -4 ? 'BetaMix Red' : 'AlphaMix Yellow';
  const finiteValues = values => Array.isArray(values) ? values.filter(Number.isFinite) : [];
  const element = (name,className,text) => {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function addWaxMatch(card,estimatedSnow) {
    const includedWax = includedWaxAdvice(estimatedSnow);
    const waxMatch = element('div','snow-resort-wax-match');
    waxMatch.append(element('span','snow-resort-wax-label','Waxsuggestie bij deze temperatuur'));
    const waxOptions = element('div','snow-resort-wax-options');
    waxOptions.append(element('strong','snow-resort-wax snow-resort-wax--included',`${includedWax} · inbegrepen`));
    if (estimatedSnow >= -12) {
      waxOptions.append(element('strong','snow-resort-wax snow-resort-wax--performance','Performance Purple · ski + € 5,00 · snowboard + € 7,50'));
    }
    waxMatch.append(waxOptions);
    card.append(waxMatch);
  }
  function addForecast(card,daily) {
    const lows = finiteValues(daily?.temperature_2m_min).slice(0,7);
    const highs = finiteValues(daily?.temperature_2m_max).slice(0,7);
    const snowfall = finiteValues(daily?.snowfall_sum).slice(0,7);
    const forecast = element('div','snow-resort-forecast');
    forecast.append(element('span','','Weersindicatie komende 7 dagen'));
    if (!lows.length || !highs.length) {
      forecast.append(element('strong','','Nog niet beschikbaar'));
    } else {
      const minimum = Math.min(...lows);
      const maximum = Math.max(...highs);
      const snowTotal = snowfall.reduce((total,value) => total + value,0);
      forecast.append(element('strong','',`${formatTemperature(minimum)} tot ${formatTemperature(maximum)}`));
      forecast.append(element('small','',snowTotal >= .1 ? `${new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}).format(snowTotal)} cm nieuwe sneeuw in het model` : 'Geen nieuwe sneeuw in het model'));
    }
    card.append(forecast);
  }
  function createResortCard(resort,current,daily) {
    const card = element('article','snow-resort-card');
    const heading = element('div','snow-resort-heading');
    heading.append(element('h4','',resort.name));
    heading.append(element('span','snow-resort-location',`${resort.country} · modelpunt ${Math.round(resort.elevation)} m`));
    card.append(heading);
    const currentBlock = element('div','snow-resort-current');
    currentBlock.append(element('span','snow-resort-current-label','Nu op het modelpunt'));
    let estimatedSnow = null;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.snow_depth)) {
      currentBlock.append(element('strong','snow-resort-temperature is-no-snow','Geen actuele data'));
      currentBlock.append(element('span','snow-resort-meta','Probeer het later opnieuw.'));
    } else if (current.snow_depth < 0.01) {
      currentBlock.append(element('strong','snow-resort-temperature is-no-snow','Geen sneeuwdek in model'));
      currentBlock.append(element('span','snow-resort-meta',`Lucht ${formatTemperature(current.temperature_2m)}`));
    } else {
      estimatedSnow = Math.min(0,current.temperature_2m);
      currentBlock.append(element('strong','snow-resort-temperature',`Sneeuw ≈ ${formatTemperature(estimatedSnow)}`));
      currentBlock.append(element('span','snow-resort-meta',`Lucht ${formatTemperature(current.temperature_2m)} · ${formatDepth(current.snow_depth)}`));
    }
    card.append(currentBlock);
    if (estimatedSnow !== null) {
      addWaxMatch(card,estimatedSnow);
    } else {
      const waxMatch = element('div','snow-resort-wax-match is-unavailable');
      waxMatch.append(element('span','snow-resort-wax-label','Waxkeuze'));
      waxMatch.append(element('strong','snow-resort-wax snow-resort-wax--included','Nog niet te bepalen'));
      waxMatch.append(element('span','snow-resort-wax-included','Zonder sneeuwdek kies je op voorkeur en verwacht gebruik.'));
      card.append(waxMatch);
    }
    addForecast(card,daily);
    return card;
  }
  function createIndoorCard() {
    const card = element('article','snow-resort-card snow-resort-card--indoor');
    const heading = element('div','snow-resort-heading');
    heading.append(element('h4','','Indoor skihallen'));
    heading.append(element('span','snow-resort-location','Nederland en Bottrop'));
    card.append(heading);
    const currentBlock = element('div','snow-resort-current');
    currentBlock.append(element('span','snow-resort-current-label','Vaste binnentemperatuur'));
    currentBlock.append(element('strong','snow-resort-temperature','Circa -4 °C tot -5 °C'));
    currentBlock.append(element('span','snow-resort-meta','Geen live weerdata nodig'));
    card.append(currentBlock);
    addWaxMatch(card,-5);
    const locations = element('div','snow-resort-forecast snow-resort-indoor-locations');
    locations.append(element('span','','Indoorlocaties'));
    locations.append(element('strong','','Landgraaf · Zoetermeer · Amsterdam'));
    locations.append(element('small','','Rucphen-Breda · Terneuzen · Bottrop'));
    card.append(locations);
    return card;
  }
  function render(payload, cached = false) {
    const rows = Array.isArray(payload) ? payload : [payload];
    grid.replaceChildren();
    const tabs = element('div','snow-resort-tabs');
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Kies een skigebied of indoorhal');
    const panel = element('div','snow-resort-panel');
    panel.id = 'snowResortPanel';
    panel.setAttribute('role','tabpanel');
    const choices = [...resorts,{name:'Indoor',indoor:true}];
    const buttons = choices.map((resort,index) => {
      const button = element('button','snow-resort-tab',resort.name);
      button.type = 'button';
      button.setAttribute('role','tab');
      button.setAttribute('aria-controls',panel.id);
      button.addEventListener('click',() => {
        selectedResortIndex = index;
        panel.replaceChildren(resort.indoor ? createIndoorCard() : createResortCard(resort,rows[index]?.current,rows[index]?.daily));
        buttons.forEach((item,itemIndex) => {
          const selected = itemIndex === index;
          item.classList.toggle('is-active',selected);
          item.setAttribute('aria-selected',String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
      });
      return button;
    });
    tabs.append(...buttons);
    grid.append(tabs,panel);
    buttons[Math.min(selectedResortIndex,buttons.length - 1)]?.click();
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
    url.searchParams.set('daily','temperature_2m_min,temperature_2m_max,snowfall_sum');
    url.searchParams.set('forecast_days','7');
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
      weatherUrl.searchParams.set('daily','temperature_2m_min,temperature_2m_max,snowfall_sum');
      weatherUrl.searchParams.set('forecast_days','7');
      weatherUrl.searchParams.set('timezone','Europe/Amsterdam');
      const weatherResponse = await fetch(weatherUrl,{cache:'no-store'});
      if (!weatherResponse.ok) throw new Error('Weather request failed');
      const weatherPayload = await weatherResponse.json();
      const resort = {
        name:place.name,
        country:[place.admin1,place.country].filter(Boolean).join(', '),
        elevation:Number.isFinite(place.elevation) ? place.elevation : 0
      };
      searchResult.replaceChildren(createResortCard(resort,weatherPayload.current,weatherPayload.daily));
    } catch {
      searchResult.replaceChildren(element('p','snow-search-message','Deze bestemming kan nu niet worden opgehaald. Controleer de spelling of probeer het later opnieuw.'));
    } finally {
      searchResult.setAttribute('aria-busy','false');
      button.disabled = false;
    }
  }
  searchForm?.addEventListener('submit',searchDestination);
  refresh();
  window.setInterval(refresh,15 * 60 * 1000);
})();
