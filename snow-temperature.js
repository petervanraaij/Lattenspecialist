(() => {
  const root = document.querySelector('#snowLive');
  if (!root) return;

  const grid = document.querySelector('#snowResortGrid');
  const status = document.querySelector('#snowLiveStatus');
  const resorts = [
    {name:'Sölden', country:'Oostenrijk', elevation:2850, latitude:46.92, longitude:10.93},
    {name:'Ischgl', country:'Oostenrijk', elevation:2500, latitude:46.98, longitude:10.31},
    {name:'Gerlos', country:'Oostenrijk', elevation:2300, latitude:47.23, longitude:12.02},
    {name:'Val Thorens', country:'Frankrijk', elevation:2500, latitude:45.30, longitude:6.58},
    {name:'Tignes', country:'Frankrijk', elevation:2700, latitude:45.45, longitude:6.90},
    {name:'Zermatt', country:'Zwitserland', elevation:2900, latitude:45.99, longitude:7.74}
  ];
  const endpoint = 'https://api.open-meteo.com/v1/dwd-icon';
  const cacheKey = 'lattenspecialist-snow-conditions-v1';
  const formatTemperature = value => `${new Intl.NumberFormat('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} °C`;
  const formatDepth = value => `${Math.round(value * 100)} cm sneeuwdek`;
  const waxAdvice = temperature => temperature < -14 ? 'UltraMix Blue' : temperature < -12 ? 'BetaMix Red' : 'Performance Purple';
  const element = (name,className,text) => {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function render(payload, cached = false) {
    const rows = Array.isArray(payload) ? payload : [payload];
    grid.replaceChildren();
    resorts.forEach((resort,index) => {
      const current = rows[index]?.current;
      const card = element('article','snow-resort-card');
      card.append(element('h4','',resort.name));
      card.append(element('span','snow-resort-location',`${resort.country} · modelpunt ${resort.elevation} m`));
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
        card.append(element('span','snow-resort-wax',`Waxadvies: ${waxAdvice(estimatedSnow)}`));
      }
      grid.append(card);
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
  refresh();
  window.setInterval(refresh,15 * 60 * 1000);
})();
