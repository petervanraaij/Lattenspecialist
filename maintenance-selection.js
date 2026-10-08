(() => {
  const packages = {brons:'Brons', zilver:'Zilver', goud:'Goud', platinum:'Platinum'};
  const waxes = {beta:'BetaMix Red', alpha:'AlphaMix Yellow', ultra:'UltraMix Blue', performance:'Performance Purple (+ € 7,50)'};
  const extras = {edges:'Kanten slijpen en tunen', repair:'Kleine, oppervlakkige belagreparaties', complex:'Grotere of complexere reparaties', bindings:'Snowboardbindingen demonteren + monteren'};
  const extraNotes = {edges:'Kanten slijpen/tunen', repair:'Kleine belagreparaties', complex:'Complexe reparaties (prijs in overleg)', bindings:'Bindingen demonteren + monteren'};
  const own = (map, key) => Object.prototype.hasOwnProperty.call(map, key);
  const quantity = value => Number.isInteger(value) && value >= 0 && value <= 20;
  const empty = () => ({p:{}, e:{}, u:false});
  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !value.p || !value.e || typeof value.p !== 'object' || typeof value.e !== 'object' || Array.isArray(value.p) || Array.isArray(value.e) || typeof value.u !== 'boolean') return null;
    const result = empty();
    for (const [id, item] of Object.entries(value.p)) {
      if (!own(packages,id) || !item || !quantity(item.s) || !quantity(item.b) || !own(waxes,item.w) || typeof item.u !== 'boolean') return null;
      if (item.s + item.b) result.p[id] = {s:item.s,b:item.b,w:item.w,u:item.u};
    }
    for (const [id, item] of Object.entries(value.e)) {
      if (!own(extras,id) || !item || !quantity(item.q) || !['ski','snowboard'].includes(item.m) || (id === 'bindings' && item.m !== 'snowboard')) return null;
      if (item.q) result.e[id] = {q:item.q,m:item.m};
    }
    if (Object.values(result.p).reduce((sum,item) => sum + item.s + item.b,0) > 20) return null;
    result.u = Object.keys(result.e).length > 0 && value.u;
    return result;
  }
  const hasItems = value => Object.keys(value.p).length > 0 || Object.keys(value.e).length > 0;
  function parse(text) {
    if (!text || text.length > 5000) return null;
    try { return normalize(JSON.parse(text)); } catch { return null; }
  }
  function describe(value) {
    const lines = [];
    for (const [id,name] of Object.entries(packages)) {
      const item = value.p[id];
      if (!item) continue;
      const materials = [item.s ? `${item.s}× ski's (paar)` : '',item.b ? `${item.b}× snowboard` : ''].filter(Boolean).join(' + ');
      lines.push(`${name}: ${materials} · ${waxes[item.w]}${item.u ? ' · Spoed + € 10,00 (indien mogelijk)' : ''}`);
    }
    for (const [id,name] of Object.entries(extras)) {
      const item = value.e[id];
      if (item) lines.push(`${item.q}× ${name} · ${item.m === 'ski' ? "ski's" : 'snowboard'}`);
    }
    if (value.u) lines.push('Spoed bij losse werkzaamheden: + € 10,00, indien mogelijk en in overleg.');
    return lines;
  }
  // Keep the complete selection within the existing booking API's notes limit.
  function notes(value) {
    const lines = ['Onderhoudskeuze:'];
    for (const [id,name] of Object.entries(packages)) {
      const item = value.p[id];
      if (!item) continue;
      const materials = [item.s ? `${item.s}x ski (paar)` : '',item.b ? `${item.b}x snowboard` : ''].filter(Boolean).join(' + ');
      lines.push(`${name}: ${materials}; ${waxes[item.w]}${item.u ? '; spoed +€10' : ''}`);
    }
    for (const [id,name] of Object.entries(extraNotes)) {
      const item = value.e[id];
      if (item) lines.push(`Los: ${item.q}x ${name} (${item.m})`);
    }
    if (value.u) lines.push('Losse werkzaamheden: spoed +€10.');
    if (value.u || Object.values(value.p).some(item => item.u)) lines.push('Spoed alleen indien mogelijk, in overleg.');
    return lines.join(' | ');
  }
  function legacy(value) {
    const materials = new Set();
    let amount = 0;
    for (const item of Object.values(value.p)) {
      if (item.s) materials.add('Ski');
      if (item.b) materials.add('Snowboard');
      amount += item.s + item.b;
    }
    for (const item of Object.values(value.e)) materials.add(item.m === 'ski' ? 'Ski' : 'Snowboard');
    const names = Object.keys(value.p);
    return {
      material:materials.size === 1 ? [...materials][0] : 'Meerdere / combinatie',
      amount:String(amount || Math.max(1,...Object.values(value.e).map(item => item.q))),
      package:names.length === 1 && !Object.keys(value.e).length ? packages[names[0]] : names.length ? 'Meerdere pakketten / losse werkzaamheden' : 'Losse werkzaamheden / advies',
      urgent:value.u || Object.values(value.p).some(item => item.u) ? 'Ja, zie onderhoudskeuze (indien mogelijk, in overleg)' : 'Nee'
    };
  }
  window.LATTEN_SELECTION = {packages,waxes,extras,empty,normalize,hasItems,parse,describe,notes,legacy};
})();
