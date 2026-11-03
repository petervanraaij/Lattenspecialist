(() => {
  const packages = {slijpen:'Brons', brons:'Koper', zilver:'Zilver', goud:'Goud', platinum:'Platinum'};
  const waxes = {none:'Geen wax', beta:'BetaMix Red', alpha:'AlphaMix Yellow (ski + € 5,00 · snowboard + € 7,50)', ultra:'UltraMix Blue (ski + € 5,00 · snowboard + € 7,50)', performance:'Performance Purple (ski + € 5,00 · snowboard + € 7,50)'};
  const waxNotes = {none:'', beta:'BetaMix Red', alpha:'Yellow +€5 ski/+€7,50 sb', ultra:'Blue +€5 ski/+€7,50 sb', performance:'Purple +€5 ski/+€7,50 sb'};
  const extras = {edges:'Kanten slijpen en tunen', repair:'Kleine, oppervlakkige belagreparaties', complex:'Grotere of complexere reparaties', bindings:'Snowboardbindingen demonteren + monteren', storageSki:'Opslagwax', storageSnowboard:'Opslagwax'};
  const extraNotes = {edges:'Kanten slijpen', repair:'Kleine reparaties', complex:'Complexe reparaties (prijs in overleg)', bindings:'Bindingen dem./mont.', storageSki:'Opslagwax, niet afschrapen', storageSnowboard:'Opslagwax, niet afschrapen'};
  const storageMaterials = {storageSki:'ski',storageSnowboard:'snowboard'};
  const prices = {
    brons:{s:19.95,b:24.95},
    slijpen:{s:24.95,b:24.95},
    zilver:{s:34.95,b:39.95},
    goud:{s:42.45,b:47.45},
    platinum:{s:49.95,b:54.95}
  };
  const treatmentPrices=Object.freeze({premiumFiling:7.5,extraEndWaxSki:5,extraEndWaxSnowboard:7.5,purpleSki:5,purpleSnowboard:7.5,intensiveCleaningSki:2.5,intensiveCleaningSnowboard:5,storageWaxSki:7.5,storageWaxSnowboard:10,urgent:10,repair:7.5,bindings:7.5});
  const own = (map, key) => Object.prototype.hasOwnProperty.call(map, key);
  const quantity = value => Number.isInteger(value) && value >= 0 && value <= 20;
  const empty = () => ({p:{}, e:{}, u:false});
  const bindingPrice = count => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(count * treatmentPrices.bindings);
  const formatPrice = amount => new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(amount);
  const storagePrice = id => id === 'storageSki' ? treatmentPrices.storageWaxSki : treatmentPrices.storageWaxSnowboard;
  function itemCleaning(item) {
    const split = item.cs !== undefined || item.cb !== undefined;
    const c = item.c === undefined ? (split ? (item.cs || 0) + (item.cb || 0) : 0) : item.c;
    const ski = split ? (item.cs ?? 0) : Math.min(c,item.s);
    const snowboard = split ? (item.cb ?? 0) : c - ski;
    if (!quantity(c) || !quantity(ski) || !quantity(snowboard) || c !== ski + snowboard || ski > item.s || snowboard > item.b) return null;
    return {ski,snowboard,total:c};
  }
  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !value.p || !value.e || typeof value.p !== 'object' || typeof value.e !== 'object' || Array.isArray(value.p) || Array.isArray(value.e) || typeof value.u !== 'boolean') return null;
    const result = empty();
    for (const [id, item] of Object.entries(value.p)) {
      if (!own(packages,id) || !item || !quantity(item.s) || !quantity(item.b) || !own(waxes,item.w) || typeof item.u !== 'boolean') return null;
      if ((id === 'slijpen' && item.w !== 'none') || (id !== 'slijpen' && item.w === 'none')) return null;
      if (item.f !== undefined && typeof item.f !== 'boolean') return null;
      if (item.f && id === 'brons') return null;
      const bindings = item.d === undefined ? 0 : item.d;
      if (!quantity(bindings) || bindings > item.b) return null;
      const repairs = item.r === undefined ? 0 : item.r;
      if (!quantity(repairs) || (repairs && id === 'slijpen')) return null;
      const cleaning = itemCleaning(item);
      if (!cleaning || (cleaning.total && id === 'slijpen')) return null;
      if (item.s + item.b) {
        result.p[id] = {s:item.s,b:item.b,d:bindings,w:item.w,u:item.u};
        if (item.f) result.p[id].f = true;
        if (repairs) result.p[id].r = repairs;
        if (cleaning.total) Object.assign(result.p[id],{c:cleaning.total,cs:cleaning.ski,cb:cleaning.snowboard});
      }
    }
    for (const [id, item] of Object.entries(value.e)) {
      if (!own(extras,id) || !item || !quantity(item.q) || !['ski','snowboard'].includes(item.m) || (id === 'bindings' && item.m !== 'snowboard')) return null;
      if (own(storageMaterials,id) && item.m !== storageMaterials[id]) return null;
      if (item.q) result.e[id] = {q:item.q,m:item.m};
    }
    const storageAmount = Object.entries(result.e).reduce((sum,[id,item]) => sum + (own(storageMaterials,id) ? item.q : 0),0);
    if (Object.values(result.p).reduce((sum,item) => sum + item.s + item.b,storageAmount) > 20) return null;
    result.u = Object.keys(result.e).length > 0 && value.u;
    return result;
  }
  const hasItems = value => Object.keys(value.p).length > 0 || Object.keys(value.e).length > 0;
  const cleaningCounts = value => Object.values(normalize(value)?.p || {}).reduce((sum,item) => ({ski:sum.ski + (item.cs || 0),snowboard:sum.snowboard + (item.cb || 0)}),{ski:0,snowboard:0});
  const cleaningCount = value => { const counts=cleaningCounts(value);return counts.ski+counts.snowboard; };
  const withoutCleaning = value => {
    const result = normalize(value);
    if (result) Object.values(result.p).forEach(item => { delete item.c; delete item.cs; delete item.cb; });
    return result;
  };
  function estimate(value) {
    const normalized = normalize(value);
    if (!normalized) return null;
    let amount = 0, cents = 0, needsAssessment = Object.keys(normalized.e).some(id => !own(storageMaterials,id));
    for (const [id,item] of Object.entries(normalized.p)) {
      const packagePrice = prices[id];
      amount += item.s + item.b;
      cents += item.s * Math.round(packagePrice.s*100) + item.b * Math.round(packagePrice.b*100);
      if (['alpha','ultra','performance'].includes(item.w)) cents += item.s * 500 + item.b * 750;
      if (item.f && !['goud','platinum'].includes(id)) cents += (item.s + item.b) * 750;
      if (item.u) cents += 1000;
      cents += item.d * 750 + (item.cs || 0) * 250 + (item.cb || 0) * 500;
      if (item.r) { cents += item.r * 750; needsAssessment = true; }
    }
    for (const [id,item] of Object.entries(normalized.e)) if (own(storageMaterials,id)) { amount += item.q; cents += item.q * Math.round(storagePrice(id)*100); }
    if (normalized.u) cents += 1000;
    const total=cents/100;
    return {amount,total,formatted:formatPrice(total),needsAssessment};
  }
  function parse(text) {
    if (!text || text.length > 5000) return null;
    try { return normalize(JSON.parse(text)); } catch { return null; }
  }
  function describe(value) {
    value=normalize(value);
    if(!value)return [];
    const lines = [];
    for (const [id,name] of Object.entries(packages)) {
      const item = value.p[id];
      if (!item) continue;
      const materials = [item.s ? `${item.s}× ski's (paar)` : '',item.b ? `${item.b}× snowboard` : ''].filter(Boolean).join(' + ');
      lines.push(`${name}: ${materials}${item.w === 'none' ? '' : ` · ${waxes[item.w]}`}${item.u ? ' · Spoed + € 10,00 · zelf brengen en ophalen · minimaal 2 werkdagen vooraf' : ''}${item.d ? ` · ${item.d}× bindingen demonteren + monteren (+ ${bindingPrice(item.d)})` : ''}${item.r ? ` · ${item.r}× kleine belagreparaties in totaal (vanaf € 7,50 per reparatie; definitieve prijs na beoordeling)` : ''}`);
      if (['goud','platinum'].includes(id)) lines.push(`${name}: premium slijpen inbegrepen (diamant medium, daarna Racing File S)`);
      else if (item.f) lines.push(`${name}: premium slijpen (diamant medium, daarna Racing File S), ${item.s + item.b}× € 7,50 = ${formatPrice((item.s + item.b)*7.5)}`);
      if (item.cs) lines.push(`${name}: waxreiniging ski’s ${item.cs}× € 2,50 = ${formatPrice(item.cs * 2.5)}`);
      if (item.cb) lines.push(`${name}: waxreiniging snowboard ${item.cb}× € 5,00 = ${formatPrice(item.cb * 5)}`);
    }
    for (const [id,name] of Object.entries(extras)) {
      const item = value.e[id];
      if (item) lines.push(`${item.q}× ${name} · ${item.m === 'ski' ? "ski's (paar)" : 'snowboard'}${own(storageMaterials,id) ? ` · ${formatPrice(storagePrice(id))} per materiaal · wax laten zitten, niet afschrapen` : ''}`);
    }
    if (value.u) lines.push('Spoed bij losse werkzaamheden: + € 10,00 · zelf brengen en ophalen · minimaal 2 werkdagen vooraf.');
    return lines;
  }
  // Keep the complete selection within the existing booking API's notes limit.
  function notes(value) {
    value=normalize(value);
    if(!value)return '';
    const lines = ['Onderhoudskeuze:'];
    for (const [id,name] of Object.entries(packages)) {
      const item = value.p[id];
      if (!item) continue;
      const materials = [item.s ? `${item.s}x ski` : '',item.b ? `${item.b}x snowboard` : ''].filter(Boolean).join('+');
      lines.push(`${name}: ${materials}${waxNotes[item.w] ? `; ${waxNotes[item.w]}` : ''}${item.u ? '; spoed+€10' : ''}${item.d ? `; bindingen ${item.d}x à€7,50` : ''}${item.r ? `; kleine rep. ${item.r}x v.a.€7,50/st.` : ''}`);
      if (item.f && !['goud','platinum'].includes(id)) lines.push(`${name}: premium ${item.s + item.b}x EUR7,50`);
      if (item.c) lines.push(`${name}: reiniging ${[item.cs?`${item.cs}x ski à€2,50`:'',item.cb?`${item.cb}x sb à€5`:''].filter(Boolean).join('+')}`);
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
    value=normalize(value);
    if(!value)return null;
    const materials = new Set();
    let amount = 0;
    for (const item of Object.values(value.p)) {
      if (item.s) materials.add('Ski');
      if (item.b) materials.add('Snowboard');
      amount += item.s + item.b;
    }
    for (const [id,item] of Object.entries(value.e)) { materials.add(item.m === 'ski' ? 'Ski' : 'Snowboard'); if(own(storageMaterials,id))amount+=item.q; }
    const names = Object.keys(value.p);
    return {
      material:materials.size === 1 ? [...materials][0] : 'Meerdere / combinatie',
      amount:String(amount || Math.max(1,...Object.values(value.e).map(item => item.q))),
      package:names.length === 1 && !Object.keys(value.e).length ? packages[names[0]] : names.length ? 'Meerdere pakketten / losse werkzaamheden' : 'Losse werkzaamheden / advies',
      urgent:value.u || Object.values(value.p).some(item => item.u) ? 'Ja, in overleg; minimaal 2 werkdagen vooraf; zelf brengen en ophalen' : 'Nee'
    };
  }
  window.LATTEN_SELECTION = {treatmentPrices,packages,waxes,extras,empty,normalize,hasItems,parse,describe,notes,legacy,bindingPrice,estimate,cleaningCounts,cleaningCount,withoutCleaning};
})();
