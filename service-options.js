(() => {
  const price = value => new Intl.NumberFormat('nl-NL', {style:'currency',currency:'EUR'}).format(value);
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const label = value => new Intl.DateTimeFormat('nl-NL', {timeZone:'Europe/Amsterdam',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${value}T12:00:00Z`));
  const plusWeek = value => { const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10); };
  function dates(select) {
    const chosen=select.value, start=new Date(`${today()}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate()+((3-start.getUTCDay()+7)%7 || 7));
    select.replaceChildren(new Option('Kies een woensdag of op afspraak',''));
    for(let i=0;i<8;i++) {
      const d=new Date(start);d.setUTCDate(d.getUTCDate()+i*7);
      const value=d.toISOString().slice(0,10);
      select.append(new Option(`${label(value)} · ophalen ${label(plusWeek(value))}`,value));
    }
    select.append(new Option('Op afspraak · moment in overleg','In overleg'));
    if ([...select.options].some(o=>o.value===chosen)) select.value=chosen;
  }
  function read(form, waxAmount) {
    const clean=form.elements.firstWaxCount, sticks=form.elements.waxstickCount;
    clean.max=String(waxAmount);clean.disabled=waxAmount===0;
    if(!waxAmount)clean.value='0';
    const c=Number(clean.value), k=Number(sticks.value);
    clean.setCustomValidity(Number.isInteger(c)&&c>=0&&c<=waxAmount ? '' : `Kies 0 t/m ${waxAmount} materialen met een waxbeurt.`);
    sticks.setCustomValidity(Number.isInteger(k)&&k>=0&&k<=20 ? '' : 'Kies 0 t/m 20 waxsticks.');
    const valid=clean.checkValidity()&&sticks.checkValidity();
    const total=valid?c*5+k*17.5:0;
    const lines=[];
    if(c) lines.push(`Extra waxreiniging: ${c}× € 5,00 = ${price(c*5)}`);
    if(k) lines.push(`Holmenkol Natural Skiwax Stick 50 g: ${k}× € 17,50 = ${price(k*17.5)} · meenemen bij ophalen`);
    const note=valid ? `${c ? `Extra waxreiniging ${c}x à€5` : waxAmount ? 'Standaard reiniging; nieuwe wax over aanwezige wax' : 'Geen waxreiniging gekozen'}${k ? `; Natural Skiwax Stick 50g ${k}x à€17,50; afhalen` : ''}` : '';
    return {valid,total,lines,note};
  }
  const compactNote = text => text.length <= 550 ? text : text.replaceAll('Onderhoudskeuze:','Keuze:').replaceAll('snowboard','sb').replaceAll('bindingen','bind.').replaceAll('kleine rep.','rep.').replaceAll('v.a.€7,50/st.','v.a.€7,50').replaceAll('Complexe reparaties (prijs in overleg)','Complex (overleg)').replaceAll('Bindingen dem./mont.','Bind. dem./mont.').replaceAll('Spoed: 2 werkd.; zelf brengen/halen.','Spoed: 2 werkd.');
  window.LATTEN_SERVICE={price,label,plusWeek,dates,read,compactNote};
})();
