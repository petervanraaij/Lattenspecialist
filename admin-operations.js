(() => {
 let api,getRecords,receiptWhatsAppUrl,members=[],hrmPin='',scanner,initialised=false,dashboardPeriod=30,wallboardRefreshTimer,wallboardMeterTimer;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>Number(value||0).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
 const duration=seconds=>`${Math.round(Number(seconds||0)/60)} min`;
 const plannedHours=minutes=>`${(Number(minutes||0)/60).toLocaleString('nl-NL',{maximumFractionDigits:1})} uur`;
 const workHours=seconds=>`${(Number(seconds||0)/3600).toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1})} uur`;
 const recordMinutes=record=>Number.isInteger(Number(record.plannedMinutes))?Number(record.plannedMinutes):(record.service==='Onderhoud'?Math.max(1,Number(record.amount)||1)*60:0);
 const openPlanningRecords=()=>getRecords().filter(record=>!record.closedAt&&Number(record.currentStep||1)<8);
 const isoLocal=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const weekDates=()=>{const today=new Date(),monday=new Date(today);monday.setHours(12,0,0,0);monday.setDate(today.getDate()-((today.getDay()+6)%7));return Array.from({length:7},(_,index)=>{const date=new Date(monday);date.setDate(monday.getDate()+index);return isoLocal(date);});};
 const shiftMinutes=item=>{if(!item.start_time||!item.end_time)return 480;const [startHour,startMinute]=item.start_time.split(':').map(Number),[endHour,endMinute]=item.end_time.split(':').map(Number);return Math.max(0,(endHour*60+endMinute)-(startHour*60+startMinute));};
 const longDay=value=>new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`));
 const liveTime=seconds=>{const value=Math.max(0,Math.round(seconds)),hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),rest=value%60;return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:`${minutes}:${String(rest).padStart(2,'0')}`;};
 function requestTimeOverview(records){return `<section class="request-time-panel"><div><span class="eyebrow">WERKVOORRAAD</span><h3>Benodigde tijd per aanvraag</h3></div><div class="request-time-list">${records.map(record=>`<div><span><b>${escape(record.name||'Naam onbekend')}</b><small>${escape(record.reference)} · ${escape(record.amount||1)}× ${escape(record.material||record.rentaltype||'materiaal')} · ${escape(record.status||'Open')}</small></span><strong>${plannedHours(recordMinutes(record))}</strong></div>`).join('')||'<p>Er zijn geen open aanvragen.</p>'}</div></section>`;}
 function weekPlanningOverview(availability,requiredMinutes){const dates=weekDates(),today=isoLocal(new Date()),usable=(availability||[]).filter(item=>dates.includes(item.work_date)&&item.preference!=='unavailable'),byDate=new Map(dates.map(date=>[date,usable.filter(item=>item.work_date===date)])),daily=dates.map(date=>({date,items:byDate.get(date),minutes:(byDate.get(date)||[]).reduce((sum,item)=>sum+shiftMinutes(item),0)})),future=daily.filter(day=>day.date>=today&&day.minutes>0);let remaining=requiredMinutes,daysNeeded=0;for(const day of future){if(remaining<=0)break;remaining-=day.minutes;daysNeeded+=1;}const totalCapacity=future.reduce((sum,day)=>sum+day.minutes,0),peopleForOneDay=requiredMinutes?Math.ceil(requiredMinutes/480):0,personDays=requiredMinutes/480,coverage=requiredMinutes===0?'Geen open werk':remaining<=0?`${daysNeeded} werkdag${daysNeeded===1?'':'en'} met de huidige beschikbaarheid`:`Nog ${plannedHours(remaining)} capaciteit tekort deze week`;return `<section class="week-planning-panel"><div class="week-planning-head"><div><span class="eyebrow">PERSONEELSPLANNING</span><h3>Wie is deze week beschikbaar?</h3><p>${escape(coverage)}</p></div><div class="staffing-advice"><span><b>${peopleForOneDay}</b> medewerker${peopleForOneDay===1?'':'s'} voor 1 volle dag</span><span><b>${personDays.toLocaleString('nl-NL',{maximumFractionDigits:1})}</b> personeelsdagen nodig</span><span><b>${plannedHours(totalCapacity)}</b> beschikbaar deze week</span></div></div><div class="week-availability-grid">${daily.map(day=>`<article class="${day.date===today?'is-today':''}"><header><b>${escape(longDay(day.date))}</b><strong>${day.minutes?plannedHours(day.minutes):'0 uur'}</strong></header>${day.items.length?day.items.map(item=>`<span><b>${escape(item.name)}</b><small>${item.start_time&&item.end_time?`${escape(item.start_time)}–${escape(item.end_time)}`:'09:00–17:00 (standaard)'} · ${item.preference==='preferred'?'voorkeur':'beschikbaar'}</small></span>`).join(''):'<small>Niemand beschikbaar gemeld</small>'}</article>`).join('')}</div></section>`;}
 const dayLabel=value=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`));
 function periodDays(amount){const days=[];for(let offset=amount-1;offset>=0;offset-=1){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-offset);days.push(date.toISOString().slice(0,10));}return days;}
 function flowChart(flow,period){const days=periodDays(period),received=new Map((flow.received||[]).map(item=>[item.day,Number(item.count)||0])),completed=new Map((flow.completed||[]).map(item=>[item.day,Number(item.count)||0])),maximum=Math.max(1,...days.flatMap(day=>[received.get(day)||0,completed.get(day)||0]));return `<div class="flow-bars" style="--flow-columns:${days.length}">${days.map((day,index)=>`<div class="flow-day" title="${escape(dayLabel(day))}: ${received.get(day)||0} binnen, ${completed.get(day)||0} klaar"><div class="flow-columns"><i class="received" style="height:${Math.max(2,(received.get(day)||0)/maximum*100)}%"></i><i class="completed" style="height:${Math.max(2,(completed.get(day)||0)/maximum*100)}%"></i></div>${index===0||index===days.length-1?`<small>${escape(dayLabel(day))}</small>`:'<small></small>'}</div>`).join('')}</div>`;}
 function turnaroundChart(flow,period){const days=periodDays(period),values=new Map((flow.turnaround||[]).map(item=>[item.day,Number(item.seconds)||0])),points=days.map((day,index)=>({day,index,value:values.get(day)||0})).filter(item=>item.value>0),maximum=Math.max(60,...points.map(item=>item.value)),coordinates=points.map(item=>`${points.length===1?50:item.index/(days.length-1)*100},${94-item.value/maximum*82}`).join(' ');return `<div class="turnaround-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gemiddelde doorlooptijd per dag">${coordinates?`<polyline points="${coordinates}" vector-effect="non-scaling-stroke"></polyline>${points.map(item=>`<circle cx="${points.length===1?50:item.index/(days.length-1)*100}" cy="${94-item.value/maximum*82}" r="1.8"><title>${escape(dayLabel(item.day))}: ${duration(item.value)}</title></circle>`).join('')}`:''}</svg><div><small>${escape(dayLabel(days[0]))}</small><strong>${points.length?`Hoogste ${duration(maximum)}`:'Nog geen afgeronde materialen'}</strong><small>${escape(dayLabel(days.at(-1)))}</small></div></div>`;}
 const navigation = {
  orders: {label:'Aanvragen en statussen', sections:[]},
  workplace: {label:'Werkplaats', sections:[['overview','Overzicht'],['planning-work','Planning'],['availability','Beschikbaarheid'],['practice','Oefenen'],['instructions','Instructies en gereedschap'],['warehouse','Magazijn'],['wallboard','Groot scherm']]},
  inventory: {label:'Beheer', sections:[['inventory','Voorraadbeheer'],['customers','Klanten & materiaal'],['website','Websitecijfers']]}
 };
 const groupFor = name => Object.keys(navigation).find(group => group === name ||
   navigation[group].sections.some(([section]) => section === name));

 function updateNavigation(name){
  const group=groupFor(name);
  document.querySelectorAll('#adminTabs button').forEach(button=>{
   const selected=button.dataset.tab===group;
   button.classList.toggle('active',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
  for(const menu of document.querySelectorAll('[data-admin-subnav]')){
   menu.hidden=menu.dataset.adminSubnav!==group;
   menu.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===name)));
  }
 }

 const workshopViews = {workplace:'practice','planning-work':'planning',availability:'availability',practice:'practice',warehouse:'warehouse'};
 async function setTab(name){
  const workshopView=workshopViews[name];
  const panelName=workshopView?'workplace':name;
  const selectedTab=name==='workplace'?'practice':name;
  if(workshopView)name='workplace';
if(window.AdminSecurity?.locked&&!['orders','instructions','workplace'].includes(name)){void window.AdminSecurity.open();return;}const tools=document.querySelector('.admin-tools');if(tools)tools.hidden=name!=='orders';const heading=document.querySelector('.admin-toolbar h1');if(heading)heading.textContent=navigation[groupFor(selectedTab)]?.label||'Beheer';clearInterval(wallboardRefreshTimer);clearInterval(wallboardMeterTimer);wallboardRefreshTimer=null;wallboardMeterTimer=null;updateNavigation(selectedTab);document.querySelector('#adminSummary').hidden=groupFor(selectedTab)!=='workplace';document.querySelectorAll('[data-admin-panel]').forEach(panel=>panel.hidden=panel.dataset.adminPanel!==panelName);if(workshopView)window.LSAdminWorkplace.open(api,document.querySelector('[data-admin-panel=workplace]'),workshopView);if(name==='customers')window.LSDossiers?.open(api,document.querySelector('[data-admin-panel=customers]'));if(name==='overview')loadDashboard();if(name==='wallboard'){loadWallboard();wallboardRefreshTimer=setInterval(loadWallboard,60000);}if(name==='instructions')window.LattenspecialistGuides.open(api,document.querySelector('[data-admin-panel=instructions]'),!window.AdminSecurity?.locked,false,true);if(name==='inventory')window.LattenspecialistInventory?.open(api,document.querySelector('#inventoryPanel'),'inventory');if(name==='suppliers')window.LattenspecialistInventory?.open(api,document.querySelector('#suppliersPanel'),'suppliers');if(name==='creditors')window.LattenspecialistInventory?.open(api,document.querySelector('#creditorsPanel'),'creditors');if(name==='debtors')window.LattenspecialistInventory?.open(api,document.querySelector('#debtorsPanel'),'debtors');if(name==='planning')loadRoutes();if(name==='hrm')showHrmLock();}
 function prepareLayout(){if(initialised)return;initialised=true;const dashboard=document.querySelector('#adminDashboard'),tabs=document.querySelector('#adminTabs');tabs.innerHTML=Object.entries(navigation).map(([id,{label}])=>`<button type="button" data-tab="${id}">${label}</button>`).join('');
  const secondary=document.createElement('div');
  secondary.innerHTML=Object.entries(navigation).filter(([,item])=>item.sections.length).map(([id,{label,sections}])=>
   `<nav class="workplace-tabs" data-admin-subnav="${id}" aria-label="${label} onderdelen" hidden>${sections.map(([section,title])=>`<button type="button" data-tab="${section}">${title}</button>`).join('')}</nav>`).join('');
  dashboard.prepend(secondary);
  const workshopSummary=document.querySelector('#adminSummary');
  workshopSummary.hidden=true;
  secondary.after(workshopSummary);
  secondary.addEventListener('click',event=>{const button=event.target.closest('button[data-tab]');if(button)setTab(button.dataset.tab);});
  const platformLink=document.createElement('a');platformLink.href='https://app.pierfinity.nl/';platformLink.target='_blank';platformLink.rel='noopener';platformLink.className='btn btn-gold';platformLink.dataset.sensitive='true';platformLink.textContent='Bedrijfsadministratie en HRM in Pierfinity ↗';secondary.querySelector('[data-admin-subnav=inventory]').append(platformLink);
  const panels={};for(const name of ['overview','wallboard','orders','workplace','inventory','instructions','customers','suppliers','creditors','debtors','planning','hrm','website']){const panel=document.createElement('div');panel.dataset.adminPanel=name;panel.hidden=name!=='orders';dashboard.append(panel);panels[name]=panel;}
  panels.inventory.id='inventoryPanel';
  panels.suppliers.id='suppliersPanel';
  panels.creditors.id='creditorsPanel';
  panels.debtors.id='debtorsPanel';
  panels.wallboard.id='wallboardPanel';panels.wallboard.innerHTML='<section class="wallboard-shell"><p>Groot-schermdashboard laden…</p></section>';
  panels.overview.append(document.querySelector('#operationsDashboard'));
  panels.website.append(document.querySelector('.website-stats'));
  const scanner=document.createElement('details');scanner.className='availability-admin';scanner.innerHTML='<summary>Materiaal scannen</summary><div class="availability-admin-head"><div><h2>Materiaal ontvangen of afleveren</h2></div><button id="adminStartScanner" class="btn btn-gold" type="button">QR-camera openen</button></div><form id="adminManualScan" class="team-create"><label>Aanvraagcode, materiaalcode of QR-link<input name="scan" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><button class="btn btn-dark" type="submit">Open aanvraag of materiaal</button></form><div id="adminQrReader" hidden></div><div id="adminScanResult"></div>';panels.orders.append(scanner,document.querySelector('.admin-order-filters'),document.querySelector('.admin-list-status'),document.querySelector('#adminList'));
  const teamPanel=document.querySelector('#teamPanel');teamPanel.hidden=true;panels.planning.append(document.querySelector('.availability-admin'),document.querySelector('#routeManager'));panels.hrm.append(document.querySelector('#hrmAdminPanel'),teamPanel);
  tabs.onclick=event=>{const button=event.target.closest('[data-tab]');if(button)setTab(button.dataset.tab);};document.querySelector('#adminStartScanner').onclick=toggleScanner;document.querySelector('#adminManualScan').onsubmit=event=>{event.preventDefault();openAdminScan(new FormData(event.target).get('scan'));};document.querySelector('#adminScanResult').onclick=event=>{const button=event.target.closest('[data-admin-action]');if(button)adminAction(button);};
 }
 async function loadDashboard(){
  const target=document.querySelector('#operationsDashboard');target.innerHTML='<p>Bedrijfsresultaten laden…</p>';
  try{
   const [result,availabilityResult]=await Promise.all([api('/api/admin/operations/dashboard'),api('/api/admin/operations/availability').catch(()=>({availability:[]}))]),m=result.materials||{},t=result.times||{},f=result.feedback||{},r=result.routes||{},trend=result.trend||{},onTime=result.onTime||{},forecast=result.forecast||{},flow=result.flow||{},planningRecords=openPlanningRecords(),requiredMinutes=planningRecords.reduce((sum,record)=>sum+recordMinutes(record),0);
   const turnaroundDelta=Number(forecast.turnaroundDeltaPercent||0),turnaroundDirection=turnaroundDelta<0?'sneller':turnaroundDelta>0?'langzamer':'gelijk';
   target.innerHTML=`<div class="operations-title"><div><span class="eyebrow">BEDRIJFSDASHBOARD</span><h2>Instroom, snelheid en planning</h2><p>Van binnenkomst tot gereed, met vergelijking met de vorige periode.</p></div><div class="dashboard-controls"><label>Periode<select id="operationsPeriod"><option value="7"${dashboardPeriod===7?' selected':''}>7 dagen</option><option value="30"${dashboardPeriod===30?' selected':''}>30 dagen</option><option value="90"${dashboardPeriod===90?' selected':''}>90 dagen</option></select></label><button class="btn btn-dark" type="button" id="reloadOperations">Vernieuwen</button></div></div>
   <div class="trend-grid"><article><span>Materiaal actief</span><strong>${m.active||0}</strong><small>${m.ready||0} klaar · ${m.delivered||0} afgeleverd</small></article><article><span>Totaal benodigde tijd</span><strong>${plannedHours(requiredMinutes)}</strong><small>${planningRecords.length} open aanvraag${planningRecords.length===1?'':'en'}</small></article><article><span>Onderhoudswachtrij</span><strong>${forecast.backlog||0}</strong><small>${forecast.estimatedProductionDays?`Circa ${forecast.estimatedProductionDays} productiedag${forecast.estimatedProductionDays===1?'':'en'} nodig`:'Nog geen betrouwbare voorspelling'}</small></article><article><span>Doorlooptijd ontvangst → klaar</span><strong>${duration(forecast.currentTurnaroundSeconds)}</strong><small>${Math.abs(turnaroundDelta)}% ${turnaroundDirection} dan vorige 30 dagen</small></article><article><span>Gemiddeld gereed per productiedag</span><strong>${forecast.dailyRate||0}</strong><small>${escape(forecast.label||'Nog geen vergelijking')}</small></article><article><span>Handmatige werktijd</span><strong>${duration(trend.average_seconds||t.average_seconds)}</strong><small>Mediaan ${duration(trend.median_seconds)} · ${escape(trend.label||'')}</small></article><article><span>Op tijd klaar</span><strong>${onTime.percentage||0}%</strong><small>${onTime.ready||0} afgeronde items</small></article><article><span>Gemiddelde routetijd</span><strong>${duration(r.average_seconds)}</strong><small>${r.completed||0} routes · ${r.items||0} items</small></article><article><span>Klanttevredenheid</span><strong>${Number(f.overall||0).toFixed(1)} / 5</strong><small>${f.responses||0} beoordelingen</small></article></div>
   ${weekPlanningOverview(availabilityResult.availability,requiredMinutes)}${requestTimeOverview(planningRecords)}
   <div class="operations-charts"><article class="chart-card"><div><span class="eyebrow">INSTROOM EN PRODUCTIE</span><h3>Binnengekomen tegenover gereed</h3><p><i class="legend received"></i>Binnengekomen <i class="legend completed"></i>Gereed</p></div>${flowChart(flow,dashboardPeriod)}</article><article class="chart-card"><div><span class="eyebrow">DOORLOOPTIJD</span><h3>Hoe snel is materiaal klaar?</h3><p>Gemiddelde tijd van ontvangst tot gereedmelding.</p></div>${turnaroundChart(flow,dashboardPeriod)}</article></div>
   <h3>Teamproductie</h3><div class="team-performance">${(result.members||[]).map(member=>`<div><span>${escape(member.name)}</span><b>${member.items||0} items</b><small>${duration(member.seconds)}</small></div>`).join('')||'<p>Nog geen productiegegevens.</p>'}</div>`;
   document.querySelector('#reloadOperations').onclick=loadDashboard;document.querySelector('#operationsPeriod').onchange=event=>{dashboardPeriod=Number(event.target.value)||30;loadDashboard();};
  }catch(error){target.innerHTML=`<p class="admin-record-message is-error">${escape(error.message)}</p>`;}
 }
 function startWallboardMeters(target){clearInterval(wallboardMeterTimer);const update=()=>{let totalElapsed=0,totalPlanned=0;target.querySelectorAll('.wallboard-timer[data-started]').forEach(card=>{const completed=Number(card.dataset.completed)||0,started=new Date(card.dataset.started).getTime(),planned=Math.max(1,Number(card.dataset.planned)||1),elapsed=completed+Math.max(0,(Date.now()-started)/1000),percent=Math.round(elapsed/planned*100),dial=card.querySelector('.wallboard-timer-dial'),value=card.querySelector('[data-live-value]'),status=card.querySelector('[data-live-status]');totalElapsed+=elapsed;totalPlanned+=planned;card.classList.toggle('is-near',percent>80&&percent<=100);card.classList.toggle('is-over',percent>100);dial.style.setProperty('--meter-angle',`${Math.min(100,percent)*3.6}deg`);value.textContent=`${liveTime(elapsed)} / ${liveTime(planned)}`;status.textContent=percent>100?`${percent-100}% over tijd`:percent>80?'Tijdgrens nadert':`${100-percent}% tijd over`;});const overall=target.querySelector('[data-overall-timer]');if(overall){const percent=totalPlanned?Math.round(totalElapsed/totalPlanned*100):0;overall.classList.toggle('is-near',percent>80&&percent<=100);overall.classList.toggle('is-over',percent>100);overall.querySelector('.wallboard-timer-dial').style.setProperty('--meter-angle',`${Math.min(100,percent)*3.6}deg`);overall.querySelector('[data-live-percent]').textContent=`${percent}%`;overall.querySelector('[data-live-total]').textContent=totalPlanned?`${liveTime(totalElapsed)} van ${liveTime(totalPlanned)}`:'Geen onderhoud actief';}};update();wallboardMeterTimer=setInterval(update,1000);}
 async function loadWallboard(){
  const target=document.querySelector('#wallboardPanel .wallboard-shell');if(!target)return;
  try{
   const [result,availabilityResult]=await Promise.all([api('/api/admin/operations/dashboard'),api('/api/admin/operations/availability').catch(()=>({availability:[]}))]),records=openPlanningRecords(),requiredMinutes=records.reduce((sum,record)=>sum+recordMinutes(record),0),availability=availabilityResult.availability||[],dates=weekDates(),today=isoLocal(new Date()),usable=availability.filter(item=>dates.includes(item.work_date)&&item.work_date>=today&&item.preference!=='unavailable'),availableMinutes=usable.reduce((sum,item)=>sum+shiftMinutes(item),0),staffCount=new Set(usable.map(item=>item.member_id)).size,coverage=requiredMinutes?Math.round(availableMinutes/requiredMinutes*100):100,gauge=Math.min(100,coverage),m=result.materials||{},forecast=result.forecast||{},feedback=result.feedback||{},flow=result.flow||{},onTime=result.onTime||{},activeWork=result.activeWork||[],maximumRequest=Math.max(1,...records.map(record=>recordMinutes(record))),turnaroundDelta=Number(forecast.turnaroundDeltaPercent||0),nowLabel=new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date());
   target.innerHTML=`<header class="wallboard-header"><div><span>DE LATTENSPECIALIST</span><h2>Werkplaatsdashboard</h2></div><div><small>Bijgewerkt ${escape(nowLabel)}</small><button id="refreshWallboard" type="button" aria-label="Vernieuwen">↻</button><button id="fullscreenWallboard" type="button">Volledig scherm</button></div></header>
   <div class="wallboard-kpis"><article><span>Open aanvragen</span><strong>${records.length}</strong><small>${m.active||0} materialen actief</small></article><article><span>Benodigde werktijd</span><strong>${plannedHours(requiredMinutes)}</strong><small>${(requiredMinutes/480).toLocaleString('nl-NL',{maximumFractionDigits:1})} personeelsdagen</small></article><article><span>Beschikbaar deze week</span><strong>${plannedHours(availableMinutes)}</strong><small>${staffCount} medewerker${staffCount===1?'':'s'} ingepland</small></article><article><span>Klanttevredenheid</span><strong>${Number(feedback.overall||0).toFixed(1)}</strong><small>${feedback.responses||0} beoordelingen · op tijd ${onTime.percentage||0}%</small></article></div>
   <section class="wallboard-live"><header><div><span class="wallboard-label">LIVE ONDERHOUDSTIJD</span><h3>Lopen we binnen de geplande tijd?</h3></div><p><i></i> Op schema <i></i> Tijdgrens nadert <i></i> Over tijd</p></header><div class="wallboard-live-grid"><article class="wallboard-timer wallboard-timer-overall" data-overall-timer><div class="wallboard-timer-dial"><strong data-live-percent>0%</strong><small>totaal gebruikt</small></div><h4>Hele werkplaats</h4><p data-live-total>Wordt berekend…</p></article>${activeWork.map(item=>`<article class="wallboard-timer" data-started="${escape(item.started_at)}" data-completed="${Number(item.completed_seconds)||0}" data-planned="${Math.max(1,Number(item.planned_seconds)||3600)}"><div class="wallboard-timer-dial"><strong>${escape(item.display_code)}</strong><small>${escape(item.kind||'Materiaal')}</small></div><h4>${escape(item.member_name||'Medewerker')}</h4><p data-live-value>Berekenen…</p><span data-live-status>Op schema</span></article>`).join('')||'<article class="wallboard-no-live"><strong>Geen onderhoud actief</strong><span>De meters verschijnen zodra een medewerker onderhoud start.</span></article>'}</div></section>
   <div class="wallboard-grid"><article class="wallboard-card wallboard-capacity"><div><span class="wallboard-label">CAPACITEITSDEKKING</span><h3>Werk versus personeel</h3></div><div class="wallboard-gauge" style="--gauge:${gauge*3.6}deg"><div><strong>${coverage}%</strong><small>gedekt</small></div></div><p class="${coverage>=100?'is-good':'is-warning'}">${coverage>=100?'Voldoende uren beschikbaar':'Nog '+plannedHours(Math.max(0,requiredMinutes-availableMinutes))+' tekort'}</p></article><article class="wallboard-card wallboard-flow"><div><span class="wallboard-label">LAATSTE 14 DAGEN</span><h3>Binnengekomen en gereed</h3><p><i class="legend received"></i>Binnen <i class="legend completed"></i>Gereed</p></div>${flowChart(flow,14)}<footer><b>${forecast.dailyRate||0}</b><span>gemiddeld gereed per productiedag</span><b class="${turnaroundDelta<=0?'is-good':'is-warning'}">${Math.abs(turnaroundDelta)}% ${turnaroundDelta<0?'sneller':turnaroundDelta>0?'langzamer':'gelijk'}</b></footer></article><article class="wallboard-card wallboard-week"><div><span class="wallboard-label">DEZE WEEK</span><h3>Beschikbare medewerkers</h3></div><div>${dates.map(date=>{const dayItems=availability.filter(item=>item.work_date===date&&item.preference!=='unavailable');return `<section class="${date===today?'is-today':''}"><header><b>${escape(longDay(date))}</b><strong>${plannedHours(dayItems.reduce((sum,item)=>sum+shiftMinutes(item),0))}</strong></header>${dayItems.map(item=>`<span><b>${escape(item.name)}</b><small>${escape(item.start_time||'09:00')}–${escape(item.end_time||'17:00')}</small></span>`).join('')||'<small>Niemand gemeld</small>'}</section>`;}).join('')}</div></article><article class="wallboard-card wallboard-work"><div><span class="wallboard-label">WERKVOORRAAD</span><h3>Tijd per aanvraag</h3></div><div>${records.slice(0,8).map(record=>`<section><header><b>${escape(record.reference)}</b><strong>${plannedHours(recordMinutes(record))}</strong></header><span>${escape(record.amount||1)}× ${escape(record.material||record.rentaltype||'materiaal')} · ${escape(record.status||'Open')}</span><i style="--work:${Math.max(4,recordMinutes(record)/maximumRequest*100)}%"></i></section>`).join('')||'<p>Geen open aanvragen.</p>'}</div>${records.length>8?`<small>+ ${records.length-8} overige aanvragen</small>`:''}</article></div>`;
   target.querySelector('#refreshWallboard').onclick=loadWallboard;target.querySelector('#fullscreenWallboard').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else target.requestFullscreen?.();};startWallboardMeters(target);
  }catch(error){target.innerHTML=`<p class="admin-record-message is-error">${escape(error.message)}</p>`;}
 }
 function scanToken(value){
  const text=String(value||'').trim();
  const pattern=/^(?:[a-f0-9]{48}|LSM-[A-F0-9]{6}|LS-\d{4}-[A-Z0-9]{2,12})$/i;
  if(pattern.test(text))return text;
  try{
   const url=new URL(text);
   const hash=new URLSearchParams(url.hash.slice(1));
   return [...hash.values(),...url.searchParams.values(),...url.pathname.split('/')].find(part=>pattern.test(part))||'';
  }catch{return '';}
 }
 async function toggleScanner(){const target=document.querySelector('#adminQrReader'),button=document.querySelector('#adminStartScanner');if(scanner){await scanner.stop().catch(()=>{});scanner.clear();scanner=null;target.hidden=true;button.textContent='QR-camera openen';return;}target.hidden=false;scanner=new Html5Qrcode('adminQrReader');try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},async value=>{await toggleScanner();openAdminScan(value);});button.textContent='Camera sluiten';}catch{scanner=null;target.hidden=true;document.querySelector('#adminScanResult').textContent='Geef cameratoegang of voer de QR-link handmatig in.';}}
 async function openAdminScan(value){
  const target=document.querySelector('#adminScanResult');
  const code=String(value||'').trim().toUpperCase();
  if(/^LS-\d{4}-[A-Z0-9]+$/.test(code)){
   const record=getRecords().find(item=>item.reference?.toUpperCase()===code && !item.deletedAt);
   if(record){
   target.textContent='';
   void setTab('orders');
   window.dispatchEvent(new CustomEvent('lattenspecialist:show-request',{detail:{reference:record.reference}}));
   return;
   }
  }
  const token=scanToken(value);
  if(!token){target.textContent='Voer een geldige aanvraagcode, materiaalcode of QR-link in.';return;}target.closest('details').open=true;target.textContent='Materiaal laden…';try{const {material,record}=await api('/api/admin/operations/scan/'+token);const actions=[];if(material.internalStatus==='label_created')actions.push(['pickup_depart','Onderweg ophalen'],['receive','Ontvangen']);if(material.internalStatus==='pickup_underway')actions.push(['receive','Ontvangen']);if(material.internalStatus==='ready')actions.push(['delivery_depart','Onderweg terugbrengen'],['delivered','Afgeleverd']);if(material.internalStatus==='delivery_underway')actions.push(['delivered','Afgeleverd']);target.innerHTML=`<article class="admin-scan-card" data-id="${material.id}" data-token="${material.token}"><div><strong>${escape(material.displayCode)}</strong><span>${escape(material.customerStatus)}</span></div><h3>${escape(material.kind)} · ${escape(material.package)}</h3><p>${escape(record.name)}<br>${escape(record.address||'')}</p><div>${actions.map(([action,label])=>`<button class="btn btn-dark" type="button" data-admin-action="${action}">${label}</button>`).join('')||'Onderhoud loopt via de medewerkersapp.'}</div><button type="button" class="btn btn-dark" data-owner-workplan="${escape(material.id)}">Bekijk onderhoudsplan</button><div data-owner-workplan-result="${escape(material.id)}"></div></article>`;}catch(error){target.textContent=/^LS-\d{4}-[A-Z0-9]{6}$/.test(code)?'Geen aanvraag gevonden met deze code.':error.message;}}
 async function adminAction(button){const card=button.closest('.admin-scan-card');button.disabled=true;try{await api(`/api/admin/operations/materials/${card.dataset.id}/action`,{method:'POST',body:JSON.stringify({action:button.dataset.adminAction})});await openAdminScan(card.dataset.token);loadDashboard();}catch(error){button.disabled=false;card.insertAdjacentHTML('beforeend',`<p class="admin-record-message is-error">${escape(error.message)}</p>`);}}
 async function openOwnerWorkplan(button){
  const id=button.dataset.ownerWorkplan;if(!/^[a-f0-9-]{36}$/.test(id))return;
  const card=button.closest('.admin-record');
  const host=card?.querySelector('[data-request-workplans]');
  let target=(card||button.parentElement).querySelector('[data-owner-workplan-result="'+id+'"]');
  if(!target)return;
  if(host){
   const panel=document.createElement('details');
   panel.className='admin-request-fields';
   panel.open=true;
   const summary=document.createElement('summary');
   summary.textContent='Onderhoud en verbruik · '+(button.closest('[data-issued-set]')?.querySelector('input')?.value||button.parentElement.querySelector('input')?.value||'set');
   const previous=target.parentElement;
   panel.append(summary,target);
   if(previous.parentElement===host)previous.remove();
   host.append(panel);
   if(host.closest('.admin-info')?.hidden)card.querySelector('[data-edit-request]')?.click();
   summary.scrollIntoView({block:'nearest'});
  }
  button.disabled=true;
  target.textContent='Onderhoudsplan laden…';
  try{
   const data=await api('/api/admin/operations/materials/'+id+'/workflow');
   if(!target.isConnected)return;
   const used=new Map();
   for(const step of data.workflow?.steps||[]){
    for(const entry of step.usage||[]){
     const key=JSON.stringify([entry.sku,entry.unit]);
     const total=used.get(key)||{...entry,quantity:0};
     total.quantity+=entry.quantity;
     used.set(key,total);
    }
   }
   const format=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3});
   const usage=[...used.values()].map(entry=>`<li>${escape(entry.name)} · ${format.format(entry.quantity)} ${escape(entry.unit)}</li>`).join('');
   const completed=(data.workflow?.steps||[]).filter(step=>step.status==='completed');
   const stepList=completed.map(step=>{
    const duration=step.durationSeconds>0?format.format(step.durationSeconds/60)+' min':'';
    const materials=(step.usage||[]).map(entry=>escape(entry.name)+' '+format.format(entry.quantity)+' '+escape(entry.unit));
    return `<li><strong>${escape(step.title)}</strong>${[duration,...materials].map(detail=>' · '+detail).join('')}</li>`;
   }).join('');
   target.innerHTML=`${stepList?`<h4>Uitgevoerde stappen</h4><ul>${stepList}</ul>`: ''}<h4>Geregistreerd verbruik</h4>${usage?'<ul>'+usage+'</ul>':'<p>Nog geen verbruik geregistreerd voor deze set.</p>'}<details class="admin-request-fields"><summary>Werkstappen en instructies</summary>${window.LSMaintenanceGuide?.preview(data)||'De werkinstructies konden niet worden weergegeven.'}</details>`;
   const photos=document.createElement('section'),dossier=document.createElement('section');
   photos.className='dossier-section';dossier.className='dossier-section';
   target.append(photos,dossier);
   window.LSMaterialPhotos?.mount(photos,id,{admin:true});
   window.LSDossiers?.material(dossier,id,api);
  }catch(error){if(target.isConnected)target.textContent=error.message;}
  finally{if(button.isConnected)button.disabled=false;}

 }
 async function labels(reference,create=true){const path='/api/admin/operations/materials'+(create?'':'?reference='+encodeURIComponent(reference));return api(path,create?{method:'POST',body:JSON.stringify({reference})}:{});}
 function printLabels(items){let sheet=document.querySelector('#qrPrintSheet');if(!sheet){sheet=document.createElement('div');sheet.id='qrPrintSheet';document.body.append(sheet);}sheet.replaceChildren();for(const item of items){const label=document.createElement('article'),brand=document.createElement('em'),code=document.createElement('strong'),qr=document.createElement('div'),meta=document.createElement('span');brand.textContent='DE LATTENSPECIALIST';code.textContent=item.displayCode;const image=qrcode(0,'M');image.addData(item.qrValue);image.make();qr.innerHTML=image.createSvgTag(4,1);meta.textContent=`${item.kind} · ${item.package} · ${item.reference}`;label.append(brand,code,qr,meta);sheet.append(label);}document.body.classList.add('printing-labels');window.print();setTimeout(()=>document.body.classList.remove('printing-labels'),500);}
 async function handleLabelButton(button,create=true){
  const card=button.closest('.admin-record'),reference=card.dataset.reference,target=card.querySelector('.material-labels');
  button.disabled=true;target.textContent='Onderhoudscodes laden…';
  try{
   const result=await labels(reference,create);
   const count=card.querySelector('[data-ski-count]');
   if(count&&result.materials.length&&count.value===count.defaultValue){
    count.defaultValue=String(result.materials.filter(item=>item.kind==='Ski').length);
    count.value=count.defaultValue;
   }

   button.textContent=result.materials.length?'Ontbrekende codes maken':'Onderhoudscodes en QR-stickers maken';
   target.innerHTML=`<div class="material-label-list">${result.materials.map(item=>`<div data-material-code-row>
    <label>Set ${item.itemNumber} · ${escape(item.kind)} · ${escape(item.package)}
    <input data-material-code value="${escape(item.displayCode)}" maxlength="10" autocapitalize="characters" autocomplete="off"></label>
    <button type="button" class="btn btn-dark" data-save-material-code>Code vervangen</button>
    <button type="button" class="btn btn-dark" data-owner-workplan="${escape(item.id)}">Bekijk onderhoudsplan</button>
    <label>Pakket <select data-set-package>
    ${[...new Set([item.package,'Koper','Brons','Zilver','Goud','Platinum'])].map(name=>`<option${name===item.package?' selected':''}>${escape(name)}</option>`).join('')}
    </select></label>
    <button type="button" class="btn btn-dark" data-save-set-package>Pakket wijzigen</button>
    <button type="button" class="btn btn-dark" data-remove-set>Set verwijderen</button>
    <p data-code-message role="status"></p><div data-owner-workplan-result="${escape(item.id)}"></div>
   </div>`).join('')}</div><button type="button" class="btn btn-gold print-labels">Print ${result.materials.length} sticker(s)</button>${result.materials.length?'':'<p>Er zijn geen actieve sets met een onderhoudscode.</p>'}`;
   if(!create&&!result.materials.length)card.querySelector('.edit-maintenance-options').open=true;
   const print=target.querySelector('.print-labels');
   print.hidden=!result.materials.length;print.onclick=()=>printLabels(result.materials);
   [...target.querySelectorAll('[data-material-code-row]')].forEach((row,index)=>{
    const input=row.querySelector('[data-material-code]'),save=row.querySelector('[data-save-material-code]'),message=row.querySelector('[data-code-message]');
    input.addEventListener('input',()=>{input.value=input.value.toUpperCase().replace(/\s+/g,'');});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save.click();}});
    async function changeSet(remove){
     if(card.hasAttribute('data-unsaved')){message.textContent='Sla eerst je andere wijzigingen aan de aanvraag op.';return;}
     const item=result.materials[index],packageName=row.querySelector('[data-set-package]').value;
     if(!remove&&packageName===item.package)return;
     if(remove&&!confirm(`Set ${item.itemNumber} (${item.displayCode}) verwijderen uit deze aanvraag?`))return;
     const controls=[...row.querySelectorAll('button')];
     controls.forEach(control=>control.disabled=true);
     message.textContent=remove?'Set verwijderen…':'Pakket opslaan…';
     try{
      const data=await api('/api/admin/operations/materials/'+item.id+'/set',{method:remove?'POST':'PATCH',body:JSON.stringify({package:packageName})});
      if(data.record)card.dispatchEvent(new CustomEvent('ls-issued-set-changed',{bubbles:true,detail:data.record}));
     }catch(error){message.textContent=error.message;}
     finally{controls.forEach(control=>control.disabled=false);}
    }
    row.querySelector('[data-save-set-package]').onclick=()=>changeSet(false);
    row.querySelector('[data-remove-set]').onclick=()=>changeSet(true);
    save.onclick=async()=>{
     const item=result.materials[index];
     if(input.value===item.displayCode)return;
     save.disabled=true;message.textContent='Code opslaan…';
     try{
      const response=await api('/api/admin/operations/materials/'+item.id+'/code',{method:'PATCH',body:JSON.stringify({code:input.value,previousCode:item.displayCode})});
      result.materials[index]=response.material;input.value=response.material.displayCode;message.textContent='Onderhoudscode vervangen.';
     }catch(error){message.textContent=error.message;}
     finally{save.disabled=false;}
    };
   });
  }catch(error){target.textContent=error.message;}finally{button.disabled=false;}
 }
 async function loadRoutes(){const target=document.querySelector('#routeManager');target.innerHTML='<p>Routes laden…</p>';try{const [routesResult,membersResult,availabilityResult]=await Promise.all([api('/api/admin/operations/routes'),api('/api/admin/team/members'),api('/api/admin/operations/availability')]);members=membersResult.members||[];const records=getRecords().filter(record=>!record.closedAt&&record.address),available=availabilityResult.availability||[];target.innerHTML=`<div class="operations-title"><div><span class="eyebrow">AUTOMATISCHE ROUTEPLANNING</span><h2>Ophaalroute maken</h2><p>Adressen worden automatisch in een efficiënte volgorde gezet.</p></div></div><div class="availability-overview"><h3>Beschikbaarheid medewerkers</h3>${available.map(item=>`<span><b>${escape(item.work_date)}</b> · ${escape(item.name)} · ${item.preference==='preferred'?'Voorkeur':item.preference==='available'?'Beschikbaar':'Niet beschikbaar'}${item.start_time&&item.end_time?` · ${escape(item.start_time)}–${escape(item.end_time)}`:''}</span>`).join('')||'<p>Nog geen beschikbaarheid ingevuld.</p>'}</div><form id="routeForm" class="route-form"><label>Datum<input type="date" name="date" required></label><label>Medewerker<select name="assignedTo" required><option value="">Kies medewerker</option>${members.filter(m=>m.active).map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('')}</select></label><fieldset><legend>Ophaaladressen</legend>${records.map(record=>`<label><input type="checkbox" name="reference" value="${escape(record.reference)}"><span><b>${escape(record.name)}</b><small>${escape(record.address)} · ${escape(record.amount||1)} item(s)</small></span></label>`).join('')||'<p>Geen open aanvragen met adres.</p>'}</fieldset><button class="btn btn-gold" type="submit">Route optimaliseren</button><p id="routeMessage"></p></form><div class="route-admin-list">${routesResult.routes.map(route=>`<article><div><b>${escape(route.route_date)}</b><span>${escape(route.status)}</span></div><ol>${route.stops.map(stop=>`<li>${escape(stop.customer_name)} · ${escape(stop.address)}</li>`).join('')}</ol>${route.maps_url?`<a class="btn btn-dark" target="_blank" rel="noopener" href="${escape(route.maps_url)}">Open routekaart</a>`:''}</article>`).join('')}</div>`;document.querySelector('#routeForm').onsubmit=createRoute;}catch(error){target.textContent=error.message;}}
 async function createRoute(event){event.preventDefault();const form=event.target,message=document.querySelector('#routeMessage'),values=new FormData(form),references=values.getAll('reference');message.textContent='Route berekenen…';try{await api('/api/admin/operations/routes',{method:'POST',body:JSON.stringify({date:values.get('date'),assignedTo:values.get('assignedTo'),references})});await loadRoutes();}catch(error){message.textContent=error.message;}}
 async function showHrmLock(message=''){const target=document.querySelector('#hrmAdminPanel'),teamPanel=document.querySelector('#teamPanel');teamPanel.hidden=true;let configured=true;try{configured=Boolean((await api('/api/admin/hrm/status')).configured);}catch{}target.innerHTML=`<div class="hrm-lock"><aside class="hrm-lock-visual"><div class="hrm-shield" aria-hidden="true"><span>◆</span><b>✓</b></div><strong>Privé blijft privé</strong><p>Een tweede beveiligingslaag voor de gevoelige gegevens van je team.</p><div class="hrm-lock-tags"><span>IBAN</span><span>Loon</span><span>Contract</span></div></aside><section class="hrm-lock-content"><span class="eyebrow">EXTRA BEVEILIGD</span><h2>${configured?'HRM ontgrendelen':'HRM-pincode instellen'}</h2><p>${configured?'Voer je aparte HRM-pincode in. Daarna kun je medewerkers, uren, verdiensten en afspraken beheren.':'Kies één aparte pincode voor medewerkersgegevens, bankrekening, loon en contracten.'}</p><div class="hrm-lock-points"><span><i>✓</i> Persoonsgegevens afgeschermd</span><span><i>✓</i> Loon en contracten extra beveiligd</span></div>${configured?'<form id="adminHrmUnlock" class="hrm-unlock-form"><label><span>HRM-pincode</span><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••" required></label><button class="btn btn-gold" type="submit">Ontgrendelen <b>→</b></button></form>':'<form id="adminHrmSetup" class="hrm-unlock-form"><label><span>Nieuwe pincode (4–12 cijfers)</span><input name="pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,12}" placeholder="••••" required></label><button class="btn btn-gold" type="submit">Pincode instellen <b>→</b></button></form>'}<p id="adminHrmMessage" class="hrm-lock-message">${escape(message)}</p></section></div>`;document.querySelector('#adminHrmSetup')?.addEventListener('submit',setupHrm);document.querySelector('#adminHrmUnlock')?.addEventListener('submit',unlockHrm);}
 async function setupHrm(event){event.preventDefault();const pin=new FormData(event.target).get('pin');try{await api('/api/admin/hrm/setup',{method:'POST',body:JSON.stringify({pin})});await showHrmLock('Pincode ingesteld. Ontgrendel HRM met je eigen code.');}catch(error){document.querySelector('#adminHrmMessage').textContent=error.message;}}
 async function unlockHrm(event){event.preventDefault();hrmPin=String(new FormData(event.target).get('pin'));try{await loadHrm();}catch(error){document.querySelector('#adminHrmMessage').textContent=error.message;}}
 async function loadHrm(){
  const result=await api('/api/admin/hrm/members',{headers:{'X-HRM-PIN':hrmPin}}),target=document.querySelector('#hrmAdminPanel');
  target.innerHTML=`<div class="operations-title hrm-page-title"><div><span class="eyebrow">HRM</span><h2>Medewerkers & beloning</h2><p>Uren, productie, loonindicatie en persoonlijke afspraken veilig op één plek.</p></div><div class="hrm-security-actions"><button class="btn btn-gold" id="changeAdminCodeToggle" type="button">🗝 Beheercode wijzigen</button><button class="btn btn-gold" id="changeHrmPinToggle" type="button">🔑 HRM-pincode wijzigen</button><button class="btn btn-dark" id="lockHrm" type="button">🔒 Vergrendel HRM</button></div></div><form id="changeAdminCode" class="hrm-pin-change" hidden><div><h3>Beheercode van de app wijzigen</h3><p>Dit is de code waarmee je de beheerapp en het beheer op de computer opent.</p></div><label>Huidige beheercode<input name="currentCode" type="password" autocomplete="current-password" required></label><label>Nieuwe beheercode<input name="newCode" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label>Herhaal nieuwe code<input name="confirmCode" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><button class="btn btn-gold" type="submit">Beheercode opslaan</button><p role="status"></p></form><form id="changeHrmPin" class="hrm-pin-change" hidden><div><h3>Extra HRM-pincode wijzigen</h3><p>Deze tweede code beschermt persoonsgegevens, bankrekening, loon en contracten.</p></div><label>Huidige pincode<input name="currentPin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" required></label><label>Nieuwe pincode<input name="newPin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" required></label><label>Herhaal nieuwe pincode<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" required></label><button class="btn btn-gold" type="submit">HRM-pincode opslaan</button><p role="status"></p></form><div class="hrm-members">${result.members.map(member=>{const totals=member.totals||{},payLabel=member.terms.payType==='item'?`${money(member.terms.itemRate)} per item`:`${money(member.terms.hourlyRate)} per uur`,initials=String(member.name||'?').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();return `<form data-hrm-member="${member.id}" class="hrm-member-card"><div class="hrm-member-title"><div class="hrm-person"><span class="hrm-avatar">${escape(initials)}</span><div><span class="eyebrow">MEDEWERKER</span><h3>${escape(member.name)}</h3><small>${escape(payLabel)}</small></div></div><span class="hrm-pay-highlight"><small>Indicatie deze maand</small><b>${money(totals.monthEarnings)}</b></span></div><div class="hrm-performance"><article class="hours"><i>◷</i><span>Uren deze maand</span><b>${workHours(totals.month_seconds)}</b><small>Geregistreerde onderhoudstijd</small></article><article class="items"><i>◇</i><span>Items deze maand</span><b>${Number(totals.month_items)||0}</b><small>Afgeronde ski's en snowboards</small></article><article class="pay"><i>€</i><span>Loonindicatie</span><b>${money(totals.monthEarnings)}</b><small>Volgens huidige afspraak</small></article><article class="total"><i>↗</i><span>Totaal geregistreerd</span><b>${workHours(totals.seconds)}</b><small>${Number(totals.items)||0} items · indicatie ${money(totals.earnings)}</small></article></div><div class="hrm-editor"><section class="hrm-form-section"><header><span>01</span><div><h4>Persoonsgegevens</h4><p>Contact- en betaalgegevens van de medewerker</p></div></header><div class="hrm-grid"><label><span>Telefoon</span><input name="phone" value="${escape(member.profile.phone||'')}" placeholder="06 12 34 56 78"></label><label><span>E-mail</span><input name="email" type="email" value="${escape(member.profile.email||'')}" placeholder="naam@voorbeeld.nl"></label><label><span>Adres</span><input name="address" value="${escape(member.profile.address||'')}" placeholder="Straat, huisnummer en woonplaats"></label><label><span>IBAN</span><input name="iban" value="${escape(member.profile.iban||'')}" placeholder="NL00 BANK 0000 0000 00"></label></div></section><section class="hrm-form-section"><header><span>02</span><div><h4>Beloning & afspraken</h4><p>Grondslag voor de loonindicatie hierboven</p></div></header><div class="hrm-grid hrm-pay-grid"><label><span>Vergoeding</span><select name="payType"><option value="hourly"${member.terms.payType!=='item'?' selected':''}>Per uur</option><option value="item"${member.terms.payType==='item'?' selected':''}>Per item</option></select></label><label><span>Uurloon (€)</span><input name="hourlyRate" type="number" min="0" step="0.01" value="${escape(member.terms.hourlyRate||'')}"></label><label><span>Bedrag per item (€)</span><input name="itemRate" type="number" min="0" step="0.01" value="${escape(member.terms.itemRate||'')}"></label><label class="hrm-contract"><span>Contract / arbeidsvoorwaarden</span><textarea name="contract" rows="5" placeholder="Leg hier de gemaakte afspraken vast…">${escape(member.terms.contract||'')}</textarea></label></div></section></div><footer class="hrm-form-actions"><p><b>Beveiligde HRM-gegevens</b><small>De bedragen zijn een indicatie; controleer ze vóór uitbetaling.</small></p><button class="btn btn-gold" type="submit">Wijzigingen veilig opslaan</button></footer><p class="hrm-save-status" role="status"></p></form>`;}).join('')}</div>`;
  document.querySelector('#teamPanel').hidden=false;document.querySelector('#lockHrm').onclick=()=>{hrmPin='';showHrmLock();};document.querySelector('#changeAdminCodeToggle').onclick=()=>{const form=document.querySelector('#changeAdminCode');form.hidden=!form.hidden;document.querySelector('#changeHrmPin').hidden=true;};document.querySelector('#changeHrmPinToggle').onclick=()=>{const form=document.querySelector('#changeHrmPin');form.hidden=!form.hidden;document.querySelector('#changeAdminCode').hidden=true;};document.querySelector('#changeAdminCode').onsubmit=changeAdminAccessCode;document.querySelector('#changeHrmPin').onsubmit=changeAdminHrmPin;target.querySelectorAll('.hrm-member-card').forEach(form=>form.onsubmit=saveHrmMember);
  }
 async function changeAdminAccessCode(event){event.preventDefault();const form=event.target,v=Object.fromEntries(new FormData(form)),status=form.querySelector('[role=status]');if(v.newCode!==v.confirmCode){status.textContent='De nieuwe beheercodes zijn niet gelijk.';return;}try{await api('/api/admin/settings/access-code',{method:'POST',body:JSON.stringify({currentCode:v.currentCode,newCode:v.newCode})});window.dispatchEvent(new CustomEvent('lattenspecialist:admin-code-changed',{detail:{code:String(v.newCode)}}));form.reset();form.hidden=true;alert('De beheercode is gewijzigd. Gebruik voortaan je nieuwe code om de beheerapp te openen.');}catch(error){status.textContent=error.message;}}
 async function changeAdminHrmPin(event){event.preventDefault();const form=event.target,v=Object.fromEntries(new FormData(form)),status=form.querySelector('[role=status]');if(v.newPin!==v.confirmPin){status.textContent='De nieuwe pincodes zijn niet gelijk.';return;}try{await api('/api/admin/hrm/change-pin',{method:'POST',headers:{'X-HRM-PIN':v.currentPin},body:JSON.stringify({newPin:v.newPin})});hrmPin=String(v.newPin);form.reset();form.hidden=true;alert('De HRM-pincode is gewijzigd. Gebruik voortaan je nieuwe code.');}catch(error){status.textContent=error.message;}}
 async function saveHrmMember(event){event.preventDefault();const form=event.target,v=Object.fromEntries(new FormData(form));try{await api('/api/admin/hrm/members/'+form.dataset.hrmMember,{method:'PATCH',headers:{'X-HRM-PIN':hrmPin},body:JSON.stringify({profile:{phone:v.phone,email:v.email,address:v.address,iban:v.iban},terms:{payType:v.payType,hourlyRate:Number(v.hourlyRate)||0,itemRate:Number(v.itemRate)||0,contract:v.contract}})});form.querySelector('[role=status]').textContent='Beveiligd opgeslagen.';}catch(error){form.querySelector('[role=status]').textContent=error.message;}}
 async function openWorkorderWorkspace(button){
  const card=button.closest('.admin-record');
  window.dispatchEvent(new CustomEvent('lattenspecialist:workorder-opened',{detail:{reference:card.dataset.reference}}));let target=card.querySelector('.workorder-workspace');if(target?.querySelector('[data-workorder-member]')){target.scrollIntoView({behavior:'smooth',block:'start'});return;}if(!target){target=document.createElement('section');target.className='workorder-workspace';card.append(target);}button.disabled=true;target.textContent='Werkorder en materialen laden…';
  try{const [result,team]=await Promise.all([labels(card.dataset.reference,true),api('/api/admin/team/members')]);const people=(team.members||[]).filter(member=>member.active);target.innerHTML=`<h3>Werkzaamheden en foto’s</h3><p>Kies het materiaal. Daarna kies je in de pop-up wie het onderhoud uitvoert.</p><dialog class="workorder-executor-dialog"><form data-executor-form><h3>Wie voert dit uit?</h3><p>Deze naam gebruiken we voor de werktijd, het verbruik en het logboek.</p><label>Uitvoerder<select data-workorder-member required><option value="">Kies medewerker</option>${people.map(member=>`<option value="${escape(member.id)}">${escape(member.name)}</option>`).join('')}</select></label><div class="admin-save-actions"><button type="button" class="btn btn-dark" data-executor-cancel>Annuleren</button><button type="submit" class="btn btn-gold">Open werkzaamheden</button></div></form></dialog><div class="workorder-materials">${result.materials.map(item=>`<button type="button" class="btn btn-dark" data-execute-material="${escape(item.id)}">${escape(item.displayCode)} · ${escape(item.kind)}</button>`).join('')}</div><p data-workorder-message role="status"></p><section data-workorder-bench></section>`;const chosen=card.querySelector('[name=assignedTo]')?.value;if(people.some(member=>member.id===chosen))target.querySelector('[data-workorder-member]').value=chosen;
   let pendingMaterial='';const dialog=target.querySelector('.workorder-executor-dialog');
   target.addEventListener('click',event=>{const material=event.target.closest('[data-execute-material]');if(!material)return;pendingMaterial=material.dataset.executeMaterial;dialog.showModal();});
   target.querySelector('[data-executor-cancel]').onclick=()=>dialog.close();
   target.querySelector('[data-executor-form]').onsubmit=async event=>{event.preventDefault();if(!event.target.reportValidity())return;const person=target.querySelector('[data-workorder-member]').value;dialog.close();await window.LSWorkflows.open(target.querySelector('[data-workorder-bench]'),pendingMaterial,{admin:true,memberId:person});};
   if(result.materials.length===1)target.querySelector('[data-execute-material]').click();target.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){target.textContent=error.message;}finally{button.disabled=false;}
 }
 let intakeDialog;
 async function openIntake(button){
  if(intakeDialog)return;
  const reference=button.closest('.admin-record').dataset.reference;
  const dialog=document.createElement('dialog');
  intakeDialog=dialog;
  dialog.className='workorder-executor-dialog';
  dialog.innerHTML=`<section data-intake-scan><form data-intake-form>
    <h3>In ontvangst nemen</h3>
    <label>Set<select name="materialId" required><option value="">Sets laden…</option></select></label>
    <button type="button" class="btn btn-dark" data-intake-camera disabled>QR-camera openen</button>
    <div id="intakeQrReader" hidden></div>
    <label>Onderhoudscode op de sticker<input name="label" maxlength="500" autocomplete="off" autocapitalize="characters" required></label>
    <p data-intake-message role="status" aria-live="polite"></p>
    <button type="submit" class="btn btn-gold" disabled>Koppel en ontvang</button>
    <button type="button" class="btn btn-dark" data-intake-close>Sluiten</button>
  </form></section>
  <section data-intake-photos hidden>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem"><h3 data-intake-photo-title></h3><button type="button" class="btn btn-dark" data-intake-photo-close aria-label="Fotovenster sluiten">×</button></div><div data-intake-photo-host></div>
    <div class="admin-save-actions"><button type="button" class="btn btn-dark" data-intake-photo-next>Later toevoegen</button><button type="button" class="btn btn-dark" data-intake-photo-close>× Sluiten</button></div>
  </section>
  <a class="btn message-whatsapp" data-intake-whatsapp hidden>Ontvangst bevestigen via WhatsApp</a>
  <section data-intake-received hidden><h3>Al ontvangen</h3><div data-intake-received-list></div></section>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),select=form.elements.materialId,input=form.elements.label;
  const message=dialog.querySelector('[data-intake-message]'),camera=dialog.querySelector('[data-intake-camera]');
  const reader=dialog.querySelector('#intakeQrReader'),save=form.querySelector('[type=submit]');
  const scanSection=dialog.querySelector('[data-intake-scan]');
  const photos=dialog.querySelector('[data-intake-photos]');
  const photoHost=dialog.querySelector('[data-intake-photo-host]');
  const photoNext=dialog.querySelector('[data-intake-photo-next]');
  const photoCloseButtons=dialog.querySelectorAll('[data-intake-photo-close]');
  for(const close of photoCloseButtons)close.onclick=()=>{if(!photoBusy)dialog.close();};
  const receivedSection=dialog.querySelector('[data-intake-received]');
  let intakeScanner=null,busy=false,cameraStart=null,photoBusy=false,receivedSets=[];
  function showPhotoStep(item,fromReceipt=false){
   scanSection.hidden=true;receivedSection.hidden=true;photos.hidden=false;
   dialog.querySelector('[data-intake-photo-title]').textContent=`Set ${item.itemNumber} · ${item.displayCode}`;
   photoHost.replaceChildren();
   photoNext.textContent=fromReceipt?'Later toevoegen':'Terug naar ontvangst';
   window.LSMaterialPhotos?.mount(photoHost,item.id,{
    admin:true,intakeOnly:true,
    onBusy(value){photoBusy=value;photoNext.disabled=value;for(const close of photoCloseButtons)close.disabled=value;},
    onSaved(){photoNext.textContent='Verder met inname';}
   });
   photoNext.focus();
  }
  photoNext.onclick=()=>{
   if(photoBusy)return;
   photos.hidden=true;photoHost.replaceChildren();scanSection.hidden=false;
   receivedSection.hidden=!receivedSets.length;
   if(!select.disabled)camera.focus();
   else dialog.querySelector('[data-intake-close]').focus();
  };
  receivedSection.onclick=event=>{
   const button=event.target.closest('[data-intake-photo-material]');
   if(button)showPhotoStep(receivedSets.find(item=>item.id===button.dataset.intakePhotoMaterial));
  };
  async function stop(){
   await cameraStart?.catch(()=>{});
   if(intakeScanner){
    await intakeScanner.stop().catch(()=>{});
    try{intakeScanner.clear();}catch{}
    intakeScanner=null;
   }
   reader.hidden=true;camera.textContent='QR-camera openen';
  }
  function showSets(materials){
   const pending=materials.filter(item=>['label_created','pickup_underway'].includes(item.internalStatus));
   select.replaceChildren(...pending.map(item=>new Option(`Set ${item.itemNumber} · ${item.kind} · ${item.package}`,item.id)));
   if(!pending.length)select.add(new Option('Alles is ontvangen'));
   receivedSets=materials.filter(item=>item.receivedAt);
   receivedSection.hidden=!receivedSets.length;
   const receivedList=dialog.querySelector('[data-intake-received-list]');
   receivedList.replaceChildren(...receivedSets.map(item=>{
    const button=document.createElement('button');
    button.type='button';button.className='btn btn-dark';button.dataset.intakePhotoMaterial=item.id;
    button.textContent=`Innamefoto’s · set ${item.itemNumber} · ${item.displayCode}`;
    return button;
   }));
   select.disabled=!pending.length;
   camera.disabled=save.disabled=input.disabled=!pending.length;
   return pending.length;
  }
  async function receive(){
   if(busy||!form.reportValidity())return;
   busy=true;save.disabled=camera.disabled=select.disabled=true;
   message.textContent='Sticker koppelen…';
   try{
    const result=await api('/api/admin/operations/materials/intake',{method:'POST',body:JSON.stringify({reference,materialId:select.value,label:input.value})});
    const received=result.materials.find(item=>item.id===select.value);
    const remaining=showSets(result.materials);
    input.value='';
    message.textContent=`${received.displayCode} ontvangen. ${remaining?'Scan de sticker van de volgende set.':'Alle sets van deze aanvraag zijn ontvangen.'}`;
    document.dispatchEvent(new CustomEvent('ls-intake-updated',{detail:result.record}));
    showPhotoStep(received,true);
    const whatsapp = dialog.querySelector('[data-intake-whatsapp]');
    const url = !remaining && receiptWhatsAppUrl?.(result.record);
    if (url) {
     whatsapp.href = url;
     whatsapp.hidden = false;
    }
   }catch(error){message.textContent=error.message;save.disabled=camera.disabled=select.disabled=false;}
   finally{busy=false;}
  }
  camera.onclick=async()=>{
   if(intakeScanner){await stop();return;}
   if(typeof Html5Qrcode!=='function'){message.textContent='Vul de code op de sticker handmatig in.';return;}
   reader.hidden=false;camera.disabled=true;
   const scannerInstance=new Html5Qrcode(reader.id);
   intakeScanner=scannerInstance;
   let captured=false;
   try{
    cameraStart=scannerInstance.start({facingMode:'environment'},{fps:10},async value=>{
     if(!intakeScanner||busy||captured)return;
     captured=true;input.value=value;
     await stop();
     if(dialog.open){message.textContent='QR-code gelezen. Klik op Koppel en ontvang.';save.focus();}
    });
    await cameraStart;
    camera.textContent='Camera sluiten';
   }catch{await stop();message.textContent='Camera niet beschikbaar. Vul de code op de sticker in.';}
   finally{cameraStart=null;camera.disabled=false;}
  };
  select.onchange=()=>{input.value='';message.textContent='';};
  form.onsubmit=event=>{event.preventDefault();void receive();};
  dialog.querySelector('[data-intake-close]').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(photoBusy||busy)event.preventDefault();});
  dialog.addEventListener('close',async()=>{await stop();dialog.remove();if(intakeDialog===dialog)intakeDialog=null;},{once:true});
  dialog.showModal();
  try{
   const result=await api('/api/admin/operations/materials/intake',{method:'POST',body:JSON.stringify({reference})});
   if(dialog.open&&!showSets(result.materials))message.textContent='Er zijn geen sets meer om in ontvangst te nemen.';
  }catch(error){message.textContent=error.message;}
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-receive-label]');
  if(button)void openIntake(button);
 });
 document.addEventListener('toggle',async event=>{
  const panel=event.target;
  if(!panel.matches?.('[data-inline-intake]')||!panel.open||panel.dataset.loaded)return;
  const target=panel.querySelector('[data-inline-intake-content]');
  const reference=panel.closest('.admin-record').dataset.reference;
  panel.dataset.loaded='true';
  target.textContent='Innamefoto’s laden…';
  try{
   const {materials}=await labels(reference,false);
   if(!panel.isConnected)return;
   target.replaceChildren();
   if(!materials.length){target.textContent='Er zijn nog geen sets gekoppeld.';return;}
   const record = getRecords?.().find(item => item.reference === reference);
   const whatsappUrl = record && materials.every(item => item.receivedAt) && receiptWhatsAppUrl?.(record);
   if (whatsappUrl) {
    const link = document.createElement('a');
    link.className = 'btn message-whatsapp';
    link.href = whatsappUrl;
    link.textContent = 'Ontvangst bevestigen via WhatsApp';
    target.append(link);
   }
   for(const item of materials){
    const set=document.createElement('details');
    const summary=document.createElement('summary');
    const photos=document.createElement('div');
    summary.textContent=`Set ${item.itemNumber} · ${item.kind} · ${item.displayCode}`;
    set.append(summary,photos);
    target.append(set);
    set.addEventListener('toggle',()=>{
     if(set.open&&!photos.hasChildNodes())window.LSMaterialPhotos?.mount(photos,item.id,{admin:true,intakeOnly:true});
    });
    if(materials.length===1)set.open=true;
   }
  }catch(error){
   target.textContent=error.message;
   delete panel.dataset.loaded;
  }
 },true);
 document.addEventListener('ls-open-material',event=>{if(event.detail?.token){void setTab('orders');void openAdminScan(event.detail.token);}});
 document.addEventListener('click',event=>{const button=event.target.closest('.open-workorder-workspace');if(button)void openWorkorderWorkspace(button);});
 document.addEventListener('click',event=>{const workplan=event.target.closest('[data-owner-workplan]');if(workplan){void openOwnerWorkplan(workplan);return;}const button=event.target.closest('.create-material-labels');if(button)handleLabelButton(button);});
 window.LattenspecialistOperations={loadIssuedSets(card){const button=card.querySelector('.create-material-labels');if(button&&!button.disabled)return handleLabelButton(button,false);},async init(client,recordsProvider,receiptLink){api=client;getRecords=recordsProvider;receiptWhatsAppUrl=receiptLink;prepareLayout();if(!document.querySelector('#adminTabs .active')||window.AdminSecurity?.locked)setTab('orders');},clear(){clearInterval(wallboardRefreshTimer);clearInterval(wallboardMeterTimer);wallboardRefreshTimer=null;wallboardMeterTimer=null;hrmPin='';document.querySelector('[data-admin-panel=customers]')?.replaceChildren();document.querySelectorAll('[data-owner-workplan-result]').forEach(host=>host.replaceChildren());window.LattenspecialistInventory?.clear();if(scanner)scanner.stop().catch(()=>{});scanner=null;}};
})();
