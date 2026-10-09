(() => {
  const packages = {slijpen:'Brons', brons:'Koper', zilver:'Zilver', goud:'Goud', platinum:'Platinum'};
  const waxes = {none:'Geen wax', beta:'BetaMix Red', alpha:'AlphaMix Yellow', ultra:'UltraMix Blue', performance:'Performance Purple (ski + € 5,00 · snowboard + € 7,50)'};
  const waxNotes = {none:'', beta:'BetaMix Red', alpha:'AlphaMix Yellow', ultra:'UltraMix Blue', performance:'Perf. +€5 ski/+€7,50 sb'};
  const extras = {edges:'Kanten slijpen en tunen', repair:'Kleine, oppervlakkige belagreparaties', complex:'Grotere of complexere reparaties', bindings:'Snowboardbindingen demonteren + monteren'};
  const extraNotes = {edges:'Kanten slijpen', repair:'Kleine reparaties', complex:'Complexe reparaties (prijs in overleg)', bindings:'Bindingen dem./mont.'};
  const prices = {
    brons:{s:19.95,b:24.95},
    slijpen:{s:24.95,b:29.95},
    zilver:{s:34.95,b:39.95},
    goud:{s:44.95,b:49.95},
    platinum:{s:52.5,b:57.5}
  };
  const performanceSkiPrice = 5, performanceSnowboardPrice = 7.5, urgentPrice = 10, repairPrice = 7.5;
  const own = (map, key) => Object.prototype.hasOwnProperty.call(map, key);
  const quantity = value => Number.isInteger(value) && value >= 0 && value <= 20;
  const empty = () => ({p:{}, e:{}, u:false});
  const bindingPrice = count => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(count * 7.5);
  const formatPrice = amount => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(amount);
  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !value.p || !value.e || typeof value.p !== 'object' || typeof value.e !== 'object' || Array.isArray(value.p) || Array.isArray(value.e) || typeof value.u !== 'boolean') return null;
    const result = empty();
    for (const [id, item] of Object.entries(value.p)) {
      if (!own(packages,id) || !item || !quantity(item.s) || !quantity(item.b) || !own(waxes,item.w) || typeof item.u !== 'boolean') return null;
      if ((id === 'slijpen' && item.w !== 'none') || (id !== 'slijpen' && item.w === 'none')) return null;
      const bindings = item.d === undefined ? 0 : item.d;
      if (!quantity(bindings) || bindings > item.b) return null;
      const repairs = item.r === undefined ? 0 : item.r;
      if (!quantity(repairs) || (repairs && id === 'slijpen')) return null;
      if (item.s + item.b) {
        result.p[id] = {s:item.s,b:item.b,d:bindings,w:item.w,u:item.u};
        if (repairs) result.p[id].r = repairs;
      }
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
  function estimate(value) {
    const normalized = normalize(value);
    if (!normalized) return null;
    let amount = 0, total = 0, needsAssessment = Object.keys(normalized.e).length > 0;
    for (const [id,item] of Object.entries(normalized.p)) {
      const packagePrice = prices[id];
      amount += item.s + item.b;
      total += item.s * packagePrice.s + item.b * packagePrice.b;
      if (item.w === 'performance') total += item.s * performanceSkiPrice + item.b * performanceSnowboardPrice;
      if (item.u) total += urgentPrice;
      total += item.d * 7.5;
      if (item.r) { total += item.r * repairPrice; needsAssessment = true; }
    }
    return {amount,total,formatted:formatPrice(total),needsAssessment};
  }
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
      lines.push(`${name}: ${materials}${item.w === 'none' ? '' : ` · ${waxes[item.w]}`}${item.u ? ' · Spoed + € 10,00 · zelf brengen en ophalen · minimaal 2 werkdagen vooraf' : ''}${item.d ? ` · ${item.d}× bindingen demonteren + monteren (+ ${bindingPrice(item.d)})` : ''}${item.r ? ` · ${item.r}× kleine belagreparaties in totaal (vanaf € 7,50 per reparatie; definitieve prijs na beoordeling)` : ''}`);
    }
    for (const [id,name] of Object.entries(extras)) {
      const item = value.e[id];
      if (item) lines.push(`${item.q}× ${name} · ${item.m === 'ski' ? "ski's" : 'snowboard'}`);
    }
    if (value.u) lines.push('Spoed bij losse werkzaamheden: + € 10,00 · zelf brengen en ophalen · minimaal 2 werkdagen vooraf.');
    return lines;
  }
  // Keep the complete selection within the existing booking API's notes limit.
  function notes(value) {
    const lines = ['Onderhoudskeuze:'];
    for (const [id,name] of Object.entries(packages)) {
      const item = value.p[id];
      if (!item) continue;
      const materials = [item.s ? `${item.s}x ski` : '',item.b ? `${item.b}x snowboard` : ''].filter(Boolean).join('+');
      lines.push(`${name}: ${materials}${waxNotes[item.w] ? `; ${waxNotes[item.w]}` : ''}${item.u ? '; spoed+€10' : ''}${item.d ? `; bindingen ${item.d}x à€7,50` : ''}${item.r ? `; kleine rep. ${item.r}x v.a.€7,50/st.` : ''}`);
    }
    for (const [id,name] of Object.entries(extraNotes)) {
      const item = value.e[id];
      if (item) lines.push(`Los: ${item.q}x ${name} (${item.m})`);
    }
    if (value.u) lines.push('Los: spoed+€10.');
    if (value.u || Object.values(value.p).some(item => item.u)) lines.push('Spoed: 2 werkd.; zelf brengen/halen.');
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
      urgent:value.u || Object.values(value.p).some(item => item.u) ? 'Ja, voor komend weekend; minimaal 2 werkdagen vooraf; zelf brengen en ophalen' : 'Nee'
    };
  }
  window.LATTEN_SELECTION = {packages,waxes,extras,empty,normalize,hasItems,parse,describe,notes,legacy,bindingPrice,estimate};
})();
