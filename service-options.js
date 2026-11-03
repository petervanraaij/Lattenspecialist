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
      select.append(new Option(label(value),value));
    }
    select.append(new Option('Op afspraak · moment in overleg','In overleg'));
    if ([...select.options].some(o=>o.value===chosen)) select.value=chosen;
  }
  function read(form, waxMaterials) {
    const materials=typeof waxMaterials==='object' ? waxMaterials : form.elements.material?.value==='Snowboard' ? {ski:0,snowboard:Number(waxMaterials)||0} : {ski:Number(waxMaterials)||0,snowboard:0};
    const clean=form.elements.firstWaxCount, ski=form.elements.firstWaxSkiCount, snowboard=form.elements.firstWaxSnowboardCount, sticks=form.elements.waxstickCount;
    const skiMax=Math.max(0,Number(materials.ski)||0), snowboardMax=Math.max(0,Number(materials.snowboard)||0), waxAmount=skiMax+snowboardMax;
    let cs=0,cb=0,valid=true;
    if(ski&&snowboard){
      for(const [field,max,label]of [[ski,skiMax,'paar ski’s'],[snowboard,snowboardMax,'snowboards']]){
        field.max=String(max);field.disabled=max===0;
        if(!max)field.value='0';
        const count=Number(field.value),good=Number.isInteger(count)&&count>=0&&count<=max;
        field.setCustomValidity(good?'':`Kies 0 t/m ${max} ${label} met een waxbeurt.`);
        valid=valid&&good&&field.checkValidity();
      }
      cs=Number(ski.value);cb=Number(snowboard.value);
      clean.value=String(cs+cb);
    }else{
      // Older embedded clients still have one total field; preserve their ski-first allocation.
      if(!waxAmount)clean.value='0';
      const count=Number(clean.value);
      valid=Number.isInteger(count)&&count>=0&&count<=waxAmount;
      clean.setCustomValidity(valid?'':`Kies 0 t/m ${waxAmount} materialen met een waxbeurt.`);
      cs=Math.min(count,skiMax);cb=count-cs;
    }
    clean.max=String(waxAmount);clean.disabled=waxAmount===0;
    const k=Number(sticks.value),stickValid=Number.isInteger(k)&&k>=0&&k<=20;
    sticks.setCustomValidity(stickValid?'':'Kies 0 t/m 20 waxsticks.');
    valid=valid&&stickValid&&sticks.checkValidity();
    const rates=window.LATTEN_SELECTION?.treatmentPrices||{},skiPrice=rates.intensiveCleaningSki??2.5,snowboardPrice=rates.intensiveCleaningSnowboard??5;
    const total=valid?cs*skiPrice+cb*snowboardPrice+k*17.5:0;
    const lines=[];
    if(cs)lines.push(`Extra waxreiniging ski’s: ${cs}× ${price(skiPrice)} = ${price(cs*skiPrice)}`);
    if(cb)lines.push(`Extra waxreiniging snowboard: ${cb}× ${price(snowboardPrice)} = ${price(cb*snowboardPrice)}`);
    if(k)lines.push(`Holmenkol Natural Skiwax Stick 50 g: ${k}× € 17,50 = ${price(k*17.5)} · meenemen bij ophalen`);
    const cleaningNotes=[cs?`ski ${cs}x à€2,50`:'',cb?`snowboard ${cb}x à€5`:''].filter(Boolean).join(', ');
    const note=valid?`${cleaningNotes?`Extra waxreiniging ${cleaningNotes}`:waxAmount?'Standaard reiniging; normale voorbereiding inbegrepen':'Geen waxreiniging gekozen'}${k?`; Natural Skiwax Stick 50g ${k}x à€17,50; afhalen`:''}`:'';
    return {valid,total,lines,note,cleaning:{ski:cs,snowboard:cb}};
  }
  const compactNote = text => text.length <= 550 ? text : text.replaceAll('Onderhoudskeuze:','Keuze:').replaceAll('snowboard','sb').replaceAll('bindingen','bind.').replaceAll('kleine rep.','rep.').replaceAll('v.a.€7,50/st.','v.a.€7,50').replaceAll('Complexe reparaties (prijs in overleg)','Complex (overleg)').replaceAll('Bindingen dem./mont.','Bind. dem./mont.').replaceAll('Spoed: 2 werkd.; zelf brengen/halen.','Spoed: 2 werkd.');
  window.LATTEN_SERVICE={price,label,plusWeek,dates,read,compactNote};
})();
