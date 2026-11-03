(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const price = value => Number(value).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
  const rates = () => window.LATTEN_SELECTION.treatmentPrices;
  const waxes = {alpha:['AlphaMix Yellow','Voor zachte, nieuwe sneeuw'],ultra:['UltraMix Blue','Voor koude, oudere sneeuw'],performance:['Performance Purple','Voor de fijnproever: onze meest luxe waxafwerking, als extra op de rode basis. Slijtvaste wax voor sneeuw van 0 tot -12 °C, met weinig vuilopname']};
  const skuKey = value => ({'24101':'alpha','24121':'ultra','27933':'performance','24057':'beta'})[String(value)] || '';
  const filing = ['Staalkanten controleren.','Handmatig slijpen op de afgesproken hoek.','Bramen verwijderen, kanten tunen en het resultaat nalopen.'];
  const waxing = ['Normale voorbereiding: belag beoordelen, afnemen en borstelen.','BetaMix Red als rode basiswax aanbrengen.','Afkoelen en overtollige wax afschrapen.','Bestaande structuur vrijborstelen en belag polijsten.'];
  function group(scope) {
    const standard=[],extra=[];
    if(scope.filing)standard.push(...filing);
    if(scope.wax)standard.push(...waxing);
    if(scope.structure&&!scope.wax)standard.push('Bestaande structuur vrijborstelen en belag polijsten.');
    if(scope.repair)standard.push('Afgesproken kleine, oppervlakkige belagreparaties beoordelen, vullen en vlak afwerken.');
    if(scope.storageWax)standard.push('Belag controleren en normaal voorbereiden.','Een beschermende waxlaag aanbrengen en laten afkoelen.','De waxlaag laten zitten: niet afschrapen en niet uitborstelen.');
    if(scope.premiumIncluded)standard.push('Premium slijpen inbegrepen: na de basisbewerking fijn afwerken met World Cup-diamant medium, daarna Racing File S, op dezelfde afgesproken hoek.');
    if(scope.premium&&!scope.premiumIncluded)extra.push({title:'Premium slijpen',fee:price(rates().premiumFiling)+' per materiaal',steps:['Na de standaardbewerking afwerken met World Cup-diamant medium.','Daarna fijn afwerken met Racing File S.','Dezelfde afgesproken hoek aanhouden; geen automatische hoekwijziging.']});
    if(waxes[scope.finishWax])extra.push({title:'Extra eindwax · '+waxes[scope.finishWax][0],fee:'ski’s '+price(rates().extraEndWaxSki)+' · snowboard '+price(rates().extraEndWaxSnowboard),steps:['Eerst de rode basis aanbrengen, laten afkoelen en overtollige wax afschrapen. Bestaande structuur vrijborstelen en belag polijsten.','Daarna de gekozen eindwax aanbrengen, laten afkoelen en overtollige wax afschrapen. Bestaande structuur vrijborstelen en belag polijsten.',waxes[scope.finishWax][1]+'.']});
    if(scope.intensive)extra.push({title:'Extra waxreiniging',fee:'ski’s '+price(rates().intensiveCleaningSki)+' · snowboard '+price(rates().intensiveCleaningSnowboard),steps:['Aanbevolen vóór het waxen; je kiest zelf voor welke materialen. De normale voorbereiding blijft inbegrepen.','Met warme wax verwijderen we zoveel mogelijk oude waxresten en vuil vóór de nieuwe waxbeurt.']});
    return {title:scope.title||'Gekozen behandeling',standard,extra,training:!!scope.training,yellowPractice:!!scope.yellowPractice};
  }
  function selection(value,{intensiveCount=0}={}) {
    if(!value)return[];
    const groups=Object.entries(value.p||{}).filter(([,item])=>item.s+item.b>0).map(([id,item])=>group({title:window.LATTEN_SELECTION.packages[id],filing:id!=='brons',wax:id!=='slijpen',premium:!!item.f,premiumIncluded:['goud','platinum'].includes(id),finishWax:item.w,intensive:item.c>0,repair:id==='platinum'||item.r>0}));
    for(const [id,item]of Object.entries(value.e||{}))if(['storageSki','storageSnowboard'].includes(id)&&item.q>0)groups.push(group({title:`Opslagwax · ${item.q} ${item.m==='ski'?'paar ski’s':'snowboard'+(item.q===1?'':'s')}`,storageWax:true}));
    if(intensiveCount>0){const extra=group({title:'Intensieve reiniging · '+intensiveCount+' materiaal',intensive:true});groups.push(extra);}
    return groups;
  }
  function workflow(value) {
    const steps=value.steps||[],has=code=>steps.some(step=>step.code===code),material=value.material||{};
    const storageWax=material.packageCode==='storage_wax'||material.storageWax||has('storage_cool');
    const wax=steps.find(step=>['practice_finish_wax','wax'].includes(step.code));
    const finish=skuKey(wax?.waxDetails?.sku || wax?.requiredItems?.find(i=>skuKey(i.sku))?.sku || '') || (/alpha|yellow/i.test(material.waxType||'')?'alpha':/ultra|blue/i.test(material.waxType||'')?'ultra':/purple|performance/i.test(material.waxType||'')?'performance':'beta');
    const base=has('base_wax')||steps.some(step=>['practice_wax','wax'].includes(step.code)&&(step.waxDetails?.sku==='24057'||step.requiredItems?.some(i=>i.sku==='24057')));
    const result=group({title:material.package||'Deze opdracht',filing:has('filing')||has('practice_filing'),wax:base&&!storageWax,storageWax,premium:has('premium_file')||has('premium_diamond'),premiumIncluded:!!material.premiumIncluded,finishWax:!storageWax&&finish!=='beta'&&wax?finish:'',intensive:has('deep_clean'),structure:has('structure'),repair:has('repair')||has('practice_repair'),training:!!value.isTraining||!!value.summary?.isTraining,yellowPractice:has('practice_clean')});
    // Historical workplans describe their actual stored steps, never promise a newly inserted base layer.
    if(wax&&!base&&!storageWax)result.standard.push('Voer de vastgelegde waxbewerking uit volgens de bewaarde instructie bij deze stap.');
    return result.standard.length||result.extra.length||result.yellowPractice?[result]:[];
  }
  function offer(id){
    const groups=selection({p:{[id]:{s:1,b:0,w:id==='slijpen'?'none':'beta',u:false}},e:{},u:false});const item=groups[0];if(!item)return[];
    if(['slijpen','zilver'].includes(id))item.extra.push(...group({premium:true}).extra);
    if(id!=='slijpen'){for(const finishWax of ['alpha','ultra','performance'])item.extra.push(...group({finishWax}).extra);item.extra.push(...group({intensive:true}).extra);}
    if(!['slijpen','platinum'].includes(id))item.extra.push({title:'Kleine belagreparaties',fee:'vanaf '+price(rates().repair)+' per beschadiging',steps:['Kleine, oppervlakkige beschadigingen beoordelen, vullen en handmatig vlak afwerken. Grotere schade en de definitieve prijs bespreken we vooraf.']});
    item.extra.push({title:'Spoedonderhoud',fee:price(rates().urgent)+' per gekozen pakket',steps:['Spoed in overleg, minimaal twee werkdagen vooraf en na bevestiging. Je brengt en haalt het materiaal zelf in Wamel.']});return groups;
  }
  function render(groups,{open=false,extraHeading='Gekozen extra’s',publicOffer=false}={}) {
    if(!groups?.length)return '';
    return `<details class="treatment-overview"${open?' open':''}><summary>Standaard werkzaamheden en gekozen extra’s</summary><div class="treatment-overview-body">${groups.map(g=>`<article><h4>${escape(g.title)}</h4><div class="treatment-scope-columns"><div><strong>Standaard inbegrepen</strong><ul>${g.standard.map(text=>`<li>${escape(text)}</li>`).join('')||'<li>Volg de vastgelegde afzonderlijke handeling.</li>'}</ul></div><div><strong>${escape(extraHeading)}</strong>${g.extra.length?g.extra.map(item=>`<section><b>${escape(item.title)}</b><small>${g.training?'Klanttoeslag ter informatie: ':''}${escape(item.fee)}</small><ol>${item.steps.map(text=>`<li>${escape(text)}</li>`).join('')}</ol></section>`).join(''):'<p>Geen extra afwerking gekozen. Voeg geen betaald meerwerk toe zonder akkoord.</p>'}</div></div>${g.yellowPractice?'<p class="treatment-scope-note">Deze oefening bevat bewust een gele reinigingsgang en daarna rode basiswax. Bij klantwerk is intensieve reiniging een afzonderlijk gekozen extra; de normale voorbereiding blijft inbegrepen.</p>':''}${g.training?'<p class="treatment-scope-note">Oefenen maakt geen klantfactuur. Tijd, gereedschap en werkelijk materiaalverbruik worden wel geregistreerd.</p>':''}</article>`).join('')}<p class="treatment-scope-note">Gele reinigingswax is iets anders dan gele eindwax. Een materiaal is één paar ski’s of één snowboard. We voeren het werk uit zoals afgesproken op de bevestigde aanvraag.</p></div></details>`;
  }
  window.LSTreatmentOverview={selection,workflow,offer,render};
})();
