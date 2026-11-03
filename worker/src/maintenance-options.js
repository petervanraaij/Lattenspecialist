const quantity = value => Number.isInteger(value) && value >= 0 && value <= 20;

// Old links only contain c. Their original material order was ski pairs, then boards.
export function packageCleaningCounts(item) {
  const split = item.cs !== undefined || item.cb !== undefined;
  const total = item.c === undefined ? (split ? (item.cs ?? 0) + (item.cb ?? 0) : 0) : item.c;
  const ski = split ? (item.cs ?? 0) : Math.min(total,item.s);
  const snowboard = split ? (item.cb ?? 0) : total - ski;
  if (!quantity(total) || !quantity(ski) || !quantity(snowboard) || total !== ski + snowboard || ski > item.s || snowboard > item.b) return null;
  return {ski,snowboard,total};
}

export function requestCleaningCounts(selection, extras = {}) {
  const value = typeof selection === 'string' ? (selection ? JSON.parse(selection) : null) : selection;
  const available = {ski:0,snowboard:0}, selected = {ski:0,snowboard:0}, ordered = [];
  let explicitPackageCleaning = false;
  if (value) {
    for (const [id,item] of Object.entries(value.p)) {
      const counts=packageCleaningCounts(item);
      if(!counts || (id==='slijpen'&&counts.total))throw new Error('Controleer de aantallen voor waxreiniging.');
      if(id==='slijpen')continue;
      available.ski+=item.s;available.snowboard+=item.b;
      selected.ski+=counts.ski;selected.snowboard+=counts.snowboard;
      explicitPackageCleaning ||= item.cs!==undefined||item.cb!==undefined;
      for(const[kind,amount,count]of [['ski',item.s,counts.ski],['snowboard',item.b,counts.snowboard]])for(let index=0;index<amount;index+=1)ordered.push({kind,selected:index<count});
    }
  } else if (!/brons|slijp/i.test(extras.package || '')) {
    // Compatibility with older direct forms that did not send a selection object.
    const amount=Number(extras.amount || 0);
    if(quantity(amount)){
      const kind=/snowboard/i.test(extras.material || '') ? 'snowboard' : 'ski';available[kind]=amount;
      for(let index=0;index<amount;index+=1)ordered.push({kind,selected:false});
    }
  }
  const split=extras.firstWaxSkiCount!==undefined||extras.firstWaxSnowboardCount!==undefined;
  let ski=selected.ski,snowboard=selected.snowboard;
  if(split) {
    ski=Number(extras.firstWaxSkiCount ?? 0);snowboard=Number(extras.firstWaxSnowboardCount ?? 0);
    if(!quantity(ski)||!quantity(snowboard)||(extras.firstWaxCount!==undefined&&Number(extras.firstWaxCount)!==ski+snowboard)||ski<selected.ski||snowboard<selected.snowboard)throw new Error('Controleer de verdeling van de waxreiniging over ski’s en snowboards.');
  } else {
    const legacy=Number(extras.firstWaxCount || 0);
    if(!quantity(legacy)||legacy>available.ski+available.snowboard)throw new Error('Kies niet meer waxreinigingen dan materialen met een waxbeurt.');
    let remaining=Math.max(0,legacy-ski-snowboard);
    // Historical firstWaxCount marked the first N wax plans in package order,
    // independently of package-local c. Preserve that union for old payloads.
    // Explicit material selections only receive genuinely additional cleaning.
    for(const[itemIndex,item]of ordered.entries()){
      if(!explicitPackageCleaning){if(itemIndex<legacy)item.selected=true;}
      else if(!item.selected&&remaining>0){item.selected=true;remaining-=1;}
    }
    ski=ordered.filter(item=>item.selected&&item.kind==='ski').length;
    snowboard=ordered.filter(item=>item.selected&&item.kind==='snowboard').length;
  }
  if(ski>available.ski||snowboard>available.snowboard||ski+snowboard>20)throw new Error('Kies niet meer waxreinigingen dan materialen met een waxbeurt.');
  return {ski,snowboard,total:ski+snowboard};
}
