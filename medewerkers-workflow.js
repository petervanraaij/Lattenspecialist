(() => {
  const endpoint = String(window.LATTENSPECIALIST_BOOKING?.endpoint || '').replace(/\/$/, '');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const statusKey = value => String(value || 'pending').toLowerCase().replace(/[\s-]+/g, '_');
  const completed = step => ['done','completed','complete','finished','afgerond'].includes(statusKey(step.status));
  const active = step => ['active','started','in_progress','running','bezig'].includes(statusKey(step.status));
  const paused = step => ['paused','pause','gepauzeerd'].includes(statusKey(step.status));
  const waxStep = step => Boolean(step.needsStartWeight) || ['base_wax','wax','practice_wax'].includes(statusKey(step.code));
  const cleaningStep = step => /clean|reinig/.test(`${step.code || ''} ${step.procedure || ''} ${step.title || ''}`.toLowerCase());
  const repairStep = step => /repair|repar/.test(`${step.code || ''} ${step.procedure || ''} ${step.title || ''}`.toLowerCase());
  const formatDuration = seconds => {
    const amount = Math.max(0, Math.round(number(seconds)));
    const hours = Math.floor(amount / 3600), minutes = Math.floor((amount % 3600) / 60), rest = amount % 60;
    return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}` : `${minutes}:${String(rest).padStart(2,'0')}`;
  };
  const money = value => number(value).toLocaleString('nl-NL', {style:'currency', currency:'EUR'});

  async function request(path, options = {}, host) {
    if (!endpoint) throw new Error('De werkplaats is nog niet verbonden.');
    const admin=host?.dataset.ownerWorkflow==='true';
    const token = admin?(sessionStorage.getItem('lattenspecialist-admin-token')||localStorage.getItem('lattenspecialist-admin-token')||''):sessionStorage.getItem('ls-team-session') || '';
    if(admin){path=path.replace('/api/team/operations/','/api/admin/operations/').replace('/api/team/practice','/api/admin/workplace/practice');if(options.method==='POST'){if(!host.dataset.executionMemberId)throw new Error('Kies eerst wie deze werkzaamheden uitvoert.');options={...options,body:JSON.stringify({...JSON.parse(options.body||'{}'),executionMemberId:host.dataset.executionMemberId})};}}
    if (!token) throw new Error('Log opnieuw in om werkstappen te gebruiken.');
    const response = await fetch(endpoint + path, {
      ...options,
      headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...(options.headers || {})},
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {const error=new Error(data.message || 'De werkstap kon niet worden bijgewerkt.');error.activeWork=data.activeWork;throw error;}
    return data;
  }

  function parseRequirements(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }

  function normalizeStep(raw, index) {
    const requirements = parseRequirements(raw.requirements ?? raw.requiredItems ?? raw.required ?? raw.required_items ?? raw.requirements_json);
    return {
      ...raw,
      id: raw.id,
      order: number(raw.order ?? raw.stepOrder ?? raw.step_order ?? index + 1),
      code: raw.code ?? raw.stepCode ?? raw.step_code ?? '',
      title: raw.title ?? raw.name ?? `Werkstap ${index + 1}`,
      instruction: raw.instruction ?? raw.instructions ?? raw.description ?? '',
      procedure: raw.procedure ?? raw.activity ?? raw.category ?? '',
      status: raw.status ?? 'pending',
      startedAt: raw.startedAt ?? raw.started_at ?? '',
      endedAt: raw.endedAt ?? raw.ended_at ?? '',
      completedAt: raw.completedAt ?? raw.completed_at ?? raw.endedAt ?? raw.ended_at ?? '',
      durationSeconds: number(raw.durationSeconds ?? raw.duration_seconds ?? raw.elapsedSeconds ?? raw.elapsed_seconds),
      startWeight: number(raw.startWeight ?? raw.start_weight ?? raw.startWeightGrams ?? raw.start_weight_grams),
      endWeight: number(raw.endWeight ?? raw.end_weight ?? raw.endWeightGrams ?? raw.end_weight_grams),
      usage: raw.usage ?? raw.consumption ?? raw.consumptions ?? [],
      cost: number(raw.cost ?? raw.cost_eur ?? raw.totalCost ?? raw.total_cost),
      needsStartWeight: Boolean(raw.needsStartWeight ?? raw.needs_start_weight),
      requirements
    };
  }

  function normalizeWorkflow(data) {
    const workflow = data?.workflow || data?.job || data || {};
    const source = workflow.steps || data?.steps || [];
    const steps = (Array.isArray(source) ? source : []).map(normalizeStep).sort((left, right) => left.order - right.order);
    const isTraining = Boolean(workflow.isTraining ?? workflow.is_training ?? workflow.summary?.isTraining ?? workflow.summary?.is_training ?? data?.isTraining ?? data?.is_training ?? data?.material?.isTraining ?? data?.material?.is_training);
    return {
      ...workflow,
      material: data?.material || workflow.material || {},
      isTraining,
      title: workflow.title || workflow.name || (isTraining ? 'Oefensessie' : 'Werkplan'),
      summary: workflow.summary || {},
      steps
    };
  }

  function requirementLabel(item) {
    if (typeof item === 'string') return item;
    const label = item.label || item.name || item.title || item.sku || item.itemSku || item.item_sku || 'Benodigd materiaal';
    const quantity = item.quantity ?? item.amount ?? item.defaultQuantity ?? item.default_quantity;
    const unit = item.unit || item.unitLabel || item.unit_label || '';
    const available = item.onHand ?? item.on_hand;
    return `${label}${quantity !== undefined && quantity !== null && quantity !== '' ? ` · ${quantity}${unit ? ` ${unit}` : ''}` : ''}${available !== undefined && available !== null ? ` · voorraad ${Number(available).toLocaleString('nl-NL')}${unit ? ` ${unit}` : ''}` : ''}`;
  }

  function timing(step) {
    if (active(step)) return `<span>Looptijd <b class="workflow-live-time" data-started="${escape(step.startedAt)}" data-seconds="${step.durationSeconds}">${formatDuration(step.durationSeconds)}</b></span>`;
    if (paused(step)) return `<span>Gepauzeerd na <b>${formatDuration(step.durationSeconds)}</b></span>`;
    if (completed(step)) return `<span>Gewerkt <b>${formatDuration(step.durationSeconds)}</b></span>`;
    return '';
  }

  function stamp(value) {
    const time=new Date(value).getTime();
    return value&&Number.isFinite(time)?new Date(time).toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  }

  function lockStep(form) {
    if(form.dataset.submitting)return null;
    form.dataset.submitting='true';
    const controls=[...form.closest('.workflow-step').querySelectorAll('button,input,select,textarea')].map(element=>({element,disabled:element.disabled}));
    controls.forEach(({element})=>element.disabled=true);
    return ()=>{if(form.isConnected){delete form.dataset.submitting;controls.forEach(({element,disabled})=>element.disabled=disabled);}};
  }

  function startForm(step) {
    const resume = paused(step);
    const wax=step.waxDetails,info=wax?`<aside class="wax-weight-hint" style="border-left:6px solid ${{Geel:'#e1bb35',Rood:'#bc3838',Blauw:'#2d71af',Paars:'#80519c'}[wax.color]||'#666'}"><strong>${escape(wax.color)} · ${escape(wax.name)}</strong><p>${wax.lastMeasuredWeight!==null?`Richtgewicht vóór start: <b>${Number(wax.lastMeasuredWeight).toLocaleString('nl-NL')} gram</b> · laatst gemeten ${escape(stamp(wax.measuredAt))}`:'Nog geen eerder eindgewicht bekend.'}</p><small>Dit is het laatst gewogen blok van deze wax, niet de totale voorraad. Gebruik je een ander of nieuw blok, dan kan het gewicht afwijken. Weeg altijd zelf.</small></aside>`:'';
    const weight = waxStep(step) && !step.startWeight ? `<label>Gewicht waxblok vóór start (gram)<input name="startWeight" type="number" inputmode="decimal" min="0.1" max="5000" step="0.01" required placeholder="bijv. 182,40"></label><p class="workflow-help">${step.cleaningWaxSku?"Reiniging: gebruik altijd Alpha Mix Yellow. Dit verbruik staat los van de volgende glijwax.":"Weeg het gekozen waxblok zonder losse verpakking."} Na afloop weeg je hetzelfde blok opnieuw.</p>` : '';
    return `<div class="workflow-actions"><form data-workflow-action="start" data-guide-version-start="${escape(step.guide?.version||'')}" data-step-id="${escape(step.id)}">${info}${weight}<button type="submit" class="primary">${resume?'Hervat stap':'Start stap'}</button><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
  }

  document.addEventListener('change',event=>{const input=event.target;if(input.name==='toolSkus'){const select=input.closest('fieldset')?.querySelector(`[name="asset_${CSS.escape(input.value)}"]`);if(select)select.disabled=!input.checked;}});

  function toolChoices(step) {
    const tools = step.requirements.filter(item => item && typeof item === 'object' && ['tool','equipment'].includes(String(item.trackingMode || item.tracking_mode || '').toLowerCase()));
    if (!tools.length) return '';
    return `<fieldset class="workflow-tool-choices"><legend>Welke gereedschappen heb je echt gebruikt?</legend>${tools.map(item => `<label><input type="checkbox" name="toolSkus" value="${escape(item.sku)}" checked><span>${escape(item.name || item.sku)}</span></label>${item.assets?.length>1?`<label>Gebruikt exemplaar van ${escape(item.name||item.sku)}<select name="asset_${escape(item.sku)}" required><option value="">Kies exemplaar</option>${item.assets.map(a=>`<option value="${escape(a.id)}">${escape(a.label)}</option>`).join('')}</select></label>`:''}`).join('')}<small>Alleen aangevinkte gereedschappen tellen mee voor levensduur en kosten.</small></fieldset>`;
  }

  function finishFormFields(step) {
    const tools = toolChoices(step), toolFlag = tools ? ' data-has-tool-choices="true"' : '';
    if (waxStep(step)) return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}" data-start-weight="${step.startWeight || ''}"${toolFlag}><label>Gewicht waxblok na afloop (gram)<input name="endWeight" type="number" inputmode="decimal" min="0" max="5000" step="0.01" required${step.startWeight ? ` max="${step.startWeight}"` : ''} placeholder="lager dan het begingewicht"></label>${tools}<button type="button" data-workflow-pause>Pauzeer timer</button><button class="primary" type="submit">Stap afronden</button><p class="workflow-help">Begingewicht: <strong>${step.startWeight ? `${step.startWeight.toLocaleString('nl-NL')} g` : 'nog niet ontvangen'}</strong>. Het verschil gaat automatisch van de voorraad af.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    if (cleaningStep(step)) return `<div class="workflow-actions"><form class="workflow-consumption-form" data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><label>Cleaner gebruikt (ml)<input name="cleanerMl" type="number" inputmode="decimal" min="0" max="1000" step="0.1" value="0"></label><label>Fleece gebruikt (cm)<input name="fleeceCm" type="number" inputmode="decimal" min="0" max="1000" step="0.1" value="0"></label>${tools}<button type="button" data-workflow-pause>Pauzeer timer</button><button class="primary" type="submit">Stap afronden</button><p class="workflow-help">Vul het echte verbruik in; ook bij een oefening wordt dit van de voorraad afgeboekt.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    if (repairStep(step)) return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><label>Reparatiestrips gebruikt (stuks)<input name="repairStrips" type="number" inputmode="numeric" min="0" max="50" step="1" value="0"></label><label>Kleur reparatiestrip<select name="repairColor"><option value="transparent">Transparant</option><option value="black">Zwart</option></select></label>${tools}<button type="button" data-workflow-pause>Pauzeer timer</button><button class="primary" type="submit">Stap afronden</button><p class="workflow-help">Boek alleen de werkelijk gebruikte strips.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><p class="workflow-help">De tijd en het gebruik van toegewezen gereedschappen worden bij afronden vastgelegd.</p>${tools}<button type="button" data-workflow-pause>Pauzeer timer</button><button class="primary" type="submit">Stap afronden</button><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
  }

  function finishForm(step) {
    const actions=step.guide?.steps||[];
    const checklist=actions.length?`<fieldset class="guide-checks workflow-action-checklist"><legend>Uitvoering</legend>${actions.map(text=>`<label><input type="checkbox" required><span>${escape(text)}</span></label>`).join('')}</fieldset>`:'';
    return finishFormFields(step).replace(/(<form\b[^>]*>)/,match=>match+checklist+(window.LSMaintenanceGuide?.checks(step)||''));

  }

  function stepCard(step, actionable) {
    if(completed(step)){
      const finishedAt=step.completedAt && stamp(step.completedAt);
      const time=finishedAt?` <time datetime="${escape(step.completedAt)}">${escape(finishedAt)}</time>`:'';
      return `<article class="workflow-step is-completed workflow-step-compact" data-step-id="${escape(step.id)}"><div class="workflow-step-main"><h4>${escape(step.title)}</h4><span>Afgerond${time}</span></div></article>`;
    }
    const running=active(step), resumed=paused(step);
    const state=running||resumed?'is-active':actionable?'is-next':'is-locked';
    const title=`<div class="workflow-step-head"><h4>${escape(step.title)}</h4><span>${running?'Bezig':resumed?'Gepauzeerd':actionable?'Volgende stap':'Wacht'}</span></div>`;
    const supplies=[...step.requirements.map(requirementLabel),...(step.guide?.supplies||[])];
    const needs=supplies.length?`<div class="workflow-needs" aria-label="Benodigdheden"><strong>Nodig</strong>${[...new Set(supplies)].map(item=>`<span>${escape(item)}</span>`).join('')}</div>`:'';
    const instructions=running?`<p class="workflow-instruction">${escape(step.instruction)}</p>${needs}${window.LSMaintenanceGuide?.instruction(step)||''}<div class="workflow-timing">${timing(step)}</div><details data-step-warehouse><summary>Uit magazijn gepakt</summary><div data-step-warehouse-content></div></details>${finishForm(step)}`:'';
    return `<article class="workflow-step ${state}" data-step-id="${escape(step.id)}"><div class="workflow-step-main">${title}${running?instructions:actionable||resumed?startForm(step):''}</div></article>`;
  }

  function render(host, data, materialId) {
    const workflow = normalizeWorkflow(data);
    const inspectionOnly = host.dataset.inspectionOnly === 'true';
    const focused = host.dataset.focusedWorkflow === 'true';
    const steps = inspectionOnly ? workflow.steps.filter(step => step.code === 'inspection') : workflow.steps;
    const finished = steps.filter(completed).length;
    const runningIndex = steps.findIndex(step => active(step) || paused(step));
    const nextIndex = runningIndex >= 0 ? runningIndex : steps.findIndex(step => !completed(step));
    const material = workflow.material || {};
    const title = inspectionOnly ? 'Inspecteren bij ontvangst' : workflow.isTraining && material.displayCode ? `Oefenopdracht ${material.displayCode}` : workflow.title || 'Werkplan';
    host.dataset.materialId = materialId || material.id || '';
    host.className = 'workflow-shell';
    if (!steps.length) {
      host.innerHTML = `<div class="workflow-empty"><strong>Nog geen werkstappen beschikbaar.</strong><p>Ontvang het materiaal of vernieuw dit scherm. Bij een oude aanvraag kan het werkplan bij de eerste start worden aangemaakt.</p></div>`;
      return;
    }
    const summary = workflow.summary || {}, totalCost = number(summary.totalCost ?? summary.total_cost), totalSeconds = number(summary.totalSeconds ?? summary.total_seconds);
    host.innerHTML = `<div class="workflow-head"><div><span class="eyebrow">${workflow.isTraining ? 'OEFENKLANT' : 'STAPPENPLAN'}</span><h3>${escape(title)}</h3>${workflow.isTraining ? `<p>${escape([material.kind==='Ski'?"Ski’s (paar)":material.kind,material.package].filter(Boolean).join(' · '))}</p>` : ''}<p>${finished} van ${steps.length} stappen afgerond${totalSeconds ? ` · ${formatDuration(totalSeconds)} gewerkt` : ''}${totalCost ? ` · ${money(totalCost)} geregistreerd` : ''}</p></div><div class="workflow-badges">${workflow.isTraining ? '<span class="workflow-badge is-training">Buiten productiecijfers</span>' : ''}<span class="workflow-badge">Verbruik boeken bij afronden</span></div></div><div class="workflow-progress" aria-label="${finished} van ${steps.length} stappen afgerond"><i style="width:${steps.length ? finished / steps.length * 100 : 0}%"></i></div>${window.LSTreatmentOverview?window.LSTreatmentOverview.render(window.LSTreatmentOverview.workflow(workflow),{open:true}):''}${window.LSMaintenanceGuide?.preparation(workflow)||''}<div class="workflow-list">${steps.map((step, index) => stepCard(step, index === nextIndex)).join('')}</div>`;
    let context;
    if(focused){
      const list=host.querySelector('.workflow-list');
      if(nextIndex>=0)list.prepend(list.children[nextIndex]);
      const head=host.querySelector('.workflow-head');
      head.innerHTML=`<p>${finished} van ${steps.length} stappen afgerond</p>`;
      context=document.createElement('details');
      context.className='material-photo-disclosure';
      context.innerHTML='<summary>Opdrachtgegevens en innamefoto’s</summary>';
      for(const item of [...host.children]){
        if(item!==head&&item!==list&&!item.matches('.workflow-progress'))context.append(item);
      }
      list.after(context);
    }
    if(!inspectionOnly&&(!workflow.isTraining||material.fullPractice)&&window.LSMaterialPhotos){
      const deliveryAvailable=finished===steps.length||(material.fullPractice&&steps[nextIndex]?.code==='practice_delivery');
      const details=document.createElement('details');
      details.className='material-photo-disclosure';
      details.innerHTML=`<summary>${deliveryAvailable?'Foto’s bij binnenkomst en oplevering':'Foto’s bij binnenkomst'}</summary><div data-material-photos></div>`;
      const intakeActions=document.createElement('div');
      intakeActions.className='workflow-photo-shortcuts';
      intakeActions.innerHTML='<button type="button" data-photo-stage="intake">📷 Binnenkomstfoto maken</button>';
      if(focused)context.append(details);
      else host.querySelector('.workflow-head').after(intakeActions,details);
      const mount=()=>{
        const target=details.querySelector('[data-material-photos]');
        if(!target.children.length)window.LSMaterialPhotos.mount(target,materialId,{admin:host.dataset.ownerWorkflow==='true',intakeOnly:!deliveryAvailable});
        return target;
      };
      const openCamera=stage=>{
        details.open=true;
        const target=mount(),select=target.querySelector('[name="stage"]');
        if(select)select.value=stage;
        target.querySelector('[data-photo-camera]')?.click();
      };
      details.addEventListener('toggle',()=>{if(details.open)mount();});
      intakeActions.querySelector('button').onclick=()=>openCamera('intake');
      const delivery=document.createElement('section');
      delivery.className='workflow-delivery';
      delivery.innerHTML=deliveryAvailable?'<h4>Opleverfoto’s</h4><button type="button" class="btn btn-gold">📷 Opleverfoto maken</button>':'<h4>Opleverfoto’s</h4><p>Maak de opleverfoto’s na de laatste onderhoudsstap.</p>';
      if(deliveryAvailable)delivery.querySelector('button').onclick=()=>{
        if(focused)delivery.append(details);
        openCamera('delivery');
      };
      const practiceDelivery=material.fullPractice&&steps[nextIndex]?.code==='practice_delivery';
      if(practiceDelivery){
        const last=host.querySelectorAll('.workflow-step')[nextIndex];
        last.querySelector('.workflow-actions')?.before(delivery);
      }else{
        host.append(delivery);
        if(deliveryAvailable&&!focused)delivery.append(details);
      }
    }
    const warehouse=host.querySelector('[data-step-warehouse]');
    warehouse?.addEventListener('toggle',()=>{
      const target=warehouse.querySelector('[data-step-warehouse-content]');
      if(!warehouse.open||target.hasChildNodes())return;
      const owner=host.dataset.ownerWorkflow==='true';
      const token=()=>owner?(sessionStorage.getItem('lattenspecialist-admin-token')||localStorage.getItem('lattenspecialist-admin-token')):sessionStorage.getItem('ls-team-session');
      const auth=token();
      const warehouseApi=(path,options)=>request(path,options,host);
      window.LSWarehouse?.open(warehouseApi,target,{owner,memberId:host.dataset.executionMemberId,onPicked:async()=>{
        if(!host.isConnected||!auth||auth!==token()||!warehouse.isConnected)return;
        const form=host.querySelector('[data-workflow-action=finish]');
        const checks=[...form.querySelectorAll('input[type=checkbox]:not([name=toolSkus])')].map(input=>input.checked);
        const measurements=[...form.querySelectorAll('input[type=number]')].map(input=>[input.name,input.value]);
        await loadInto(host,materialId);
        const updated=host.querySelector('[data-workflow-action=finish]');
        if(!updated)return;
        updated.querySelectorAll('input[type=checkbox]:not([name=toolSkus])').forEach((input,index)=>input.checked=Boolean(checks[index]));
        for(const [name,value] of measurements){if(updated.elements.namedItem(name))updated.elements.namedItem(name).value=value;}
        updated.querySelector('.workflow-message').textContent='Uitgifte uit magazijn opgeslagen.';
      }});
    });
    updateTimers();
  }

  async function loadInto(host, materialId, initialData) {
    const auth=()=>host.dataset.ownerWorkflow==='true'?(sessionStorage.getItem('lattenspecialist-admin-token')||localStorage.getItem('lattenspecialist-admin-token')):sessionStorage.getItem('ls-team-session');
    const expectedToken=auth();
    host.className = 'workflow-shell';
    host.dataset.materialId = materialId;
    host.innerHTML = '<p>Werkstappen laden…</p>';
    try {
      const data = initialData && (initialData.steps || initialData.workflow?.steps || initialData.job?.steps) ? initialData : await request(`/api/team/operations/materials/${encodeURIComponent(materialId)}/workflow`,{},host);
      if(!host.isConnected||host.dataset.materialId!==materialId||auth()!==expectedToken)return;
      render(host, data, materialId);
    } catch (error) {
      host.innerHTML = `<p class="workflow-message is-error">${escape(error.message)}</p>`;
    }
  }

  function updateTimers() {
    document.querySelectorAll('.workflow-live-time').forEach(target => {
      const started = new Date(target.dataset.started).getTime();
      const base = number(target.dataset.seconds);
      const seconds = base + (Number.isFinite(started) ? Math.max(0, (Date.now() - started) / 1000) : 0);
      target.textContent = formatDuration(seconds);
    });
  }

  async function submitStep(form) {
    if(form.dataset.submitting||!form.reportValidity())return;
    const button = form.querySelector('button[type=submit]'), message = form.querySelector('.workflow-message');
    const action = form.dataset.workflowAction, formData = new FormData(form), values = Object.fromEntries(formData);
    const body = {};
    for (const [name, raw] of Object.entries(values)) {
      if (name === 'toolSkus' || name === 'guideChecks' || name.startsWith('asset_')) continue;
      if (name === 'repairColor') { body[name] = String(raw); continue; }
      if (raw === '') continue;
      const value = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(value) || value < 0) { message.textContent = 'Controleer de ingevulde hoeveelheid.'; message.classList.add('is-error'); return; }
      body[name] = value;
    }
    if (form.dataset.hasToolChoices === 'true') body.toolSkus = formData.getAll('toolSkus').map(String);
    body.toolAssets=Object.fromEntries([...formData].filter(([name])=>name.startsWith('asset_')).map(([name,value])=>[name.slice(6),String(value)]));
    if(form.dataset.guideVersionStart)body.guideVersion=form.dataset.guideVersionStart;
    const guide=form.querySelector('[data-guide-version]');
    if(guide)body.guideChecks={version:guide.dataset.guideVersion,checkedIds:formData.getAll('guideChecks').map(String)};
    if (action === 'start' && Object.hasOwn(body, 'startWeight') && body.startWeight <= 0) { message.textContent = 'Vul een begingewicht groter dan 0 gram in.'; message.classList.add('is-error'); return; }
    const startWeight = Number(form.dataset.startWeight);
    if (action === 'finish' && Object.hasOwn(body, 'endWeight') && form.dataset.startWeight && Number.isFinite(startWeight) && body.endWeight > startWeight) { message.textContent = 'Het eindgewicht kan niet hoger zijn dan het begingewicht.'; message.classList.add('is-error'); return; }
    const unlock=lockStep(form);if(!unlock)return;
    button.disabled = true; message.classList.remove('is-error'); message.textContent = action === 'start' ? 'Timer starten…' : 'Verbruik en tijd opslaan…';
    try {
      await request(`/api/team/operations/steps/${encodeURIComponent(form.dataset.stepId)}/${action}`, {method:'POST', body:JSON.stringify(body)},form.closest('.workflow-shell'));
      const host = form.closest('.workflow-shell');
      await loadInto(host, host.dataset.materialId);
    } catch (error) {
      message.textContent = error.message; message.classList.add('is-error');
      if(error.activeWork){const work=error.activeWork,button=document.createElement('button');button.type='button';button.textContent=`Open actieve opdracht: ${work.displayCode} · ${work.kind} · ${work.stepTitle}`;button.onclick=()=>document.dispatchEvent(new CustomEvent('ls-open-material',{detail:{token:work.token}}));message.append(document.createElement('br'),button);}
    } finally {
      unlock();
    }
  }

  async function pauseStep(button) {
    const form = button.closest('[data-workflow-action]'), message = form.querySelector('.workflow-message');
    const unlock=lockStep(form);if(!unlock)return;
    button.disabled = true; message.classList.remove('is-error'); message.textContent = 'Timer pauzeren…';
    try {
      await request(`/api/team/operations/steps/${encodeURIComponent(form.dataset.stepId)}/pause`, {method:'POST', body:'{}'},form.closest('.workflow-shell'));
      const host = form.closest('.workflow-shell');
      await loadInto(host, host.dataset.materialId);
    } catch (error) {
      message.textContent = error.message; message.classList.add('is-error');
      if(error.activeWork){const work=error.activeWork,button=document.createElement('button');button.type='button';button.textContent=`Open actieve opdracht: ${work.displayCode} · ${work.kind} · ${work.stepTitle}`;button.onclick=()=>document.dispatchEvent(new CustomEvent('ls-open-material',{detail:{token:work.token}}));message.append(document.createElement('br'),button);}
    } finally {
      unlock();
    }
  }

  function mountPracticePackage(form) {
    const host = form.querySelector('[data-practice-full]');
    const model = window.LATTEN_SELECTION;
    if (!host || !model) return;
    const options = entries => entries.map(([key,label]) => `<option value="${escape(key)}">${escape(label)}</option>`).join('');
    host.innerHTML = `<legend>Pakket en extra werkzaamheden</legend>
      <label>Pakket<select name="practicePackage">${options(Object.entries(model.packages))}</select></label>
      <label>Eindwax<select name="practiceEndWax">${options(Object.entries(model.waxes).filter(([key]) => key !== 'none'))}</select></label>
      <label><input type="checkbox" name="practiceCleaning"> Warme waxreiniging</label>
      <label><input type="checkbox" name="practicePremium"> Premium slijpen</label>
      <label><input type="checkbox" name="practiceBindings"> Snowboardbindingen demonteren en terugplaatsen</label>
      <label>Kleine belagreparaties<input type="number" name="practiceRepairs" min="0" max="20" step="1" value="0"></label>`;
    const fields = form.elements;
    fields.practicePackage.value = 'zilver';

    function enable(name, enabled) {
      fields[name].disabled = !enabled;
      fields[name].closest('label').hidden = !enabled;
      if (!enabled && fields[name].type === 'checkbox') fields[name].checked = false;
    }

    return () => {
      const full = fields.activity.value === 'full';
      host.hidden = !full;
      host.disabled = !full;
      const selected = fields.practicePackage.value;
      enable('practiceEndWax', selected !== 'slijpen');
      enable('practiceCleaning', selected !== 'slijpen');
      enable('practicePremium', ['slijpen','zilver'].includes(selected));
      enable('practiceBindings', fields.kind.value === 'Snowboard');
    };
  }

  function practicePanel(result, memberId, name, materialId) {
    const current = [...result.children].find(panel => panel.dataset.practiceMember === memberId);
    if (current?.dataset.practiceMaterial === materialId) return current;
    const panel = document.createElement('article');
    panel.dataset.practiceMember = memberId;
    panel.dataset.practiceMaterial = materialId;
    const heading = document.createElement('h3');
    heading.textContent = 'Uitvoerder: ' + name;
    panel.append(heading, document.createElement('section'));
    if (current) current.replaceWith(panel);
    else result.append(panel);
    return panel;
  }

  async function createPractice(form) {
    const status = document.getElementById('practiceStatus'), result = document.getElementById('practiceResult'), button = form.querySelector('button[type=submit]');
    const values = Object.fromEntries(new FormData(form));
    const memberName = form.elements.executionMemberId?.selectedOptions[0]?.textContent;
    if (values.activity === 'full') {
      values.maintenanceSelection = {
        p: {[values.practicePackage]: {
          s: Number(values.kind !== 'Snowboard'), b: Number(values.kind === 'Snowboard'),
          w: values.practiceEndWax || 'none', c: Number(Boolean(values.practiceCleaning)),
          f: Boolean(values.practicePremium), d: Number(Boolean(values.practiceBindings)),
          r: Number(values.practiceRepairs), u: false
        }},
        e: {}, u: false
      };
      for (const key of Object.keys(values).filter(key => key.startsWith('practice'))) delete values[key];
    }
    values.premiumFiling = values.activity === 'filing' && form.elements.premiumFiling?.checked === true;
    if (values.activity === 'wax') values.waxProtocol = 'yellow-red'; else delete values.finishWax;
    if (values.activity !== 'wax') delete values.waxSku;
    button.disabled = true; status.classList.remove('is-error'); status.textContent = 'Oefenopdracht aanmaken…'; if(form.dataset.ownerPractice!=='true')result.replaceChildren();
    try {
      const owner=form.dataset.ownerPractice==='true', context=owner?form:undefined;
      if(owner){form.dataset.ownerWorkflow='true';form.dataset.executionMemberId=values.executionMemberId;}
      const data = await request('/api/team/practice', {method:'POST', body:JSON.stringify(values)},context);
      const material = data.material || data.workflow?.material || {};
      if (!material.id) throw new Error('De oefening is aangemaakt, maar kon niet worden geopend. Vernieuw en probeer opnieuw.');
      status.textContent = 'Oefening klaar. Start hieronder de eerste stap.';
      const panel = owner ? practicePanel(result, values.executionMemberId, memberName, material.id) : null;
      const host = panel ? panel.lastElementChild : document.createElement('section');
      if(owner){host.dataset.ownerWorkflow='true';host.dataset.executionMemberId=values.executionMemberId;}
      else result.append(host);
      await loadInto(host, material.id, data);
      if(owner)document.dispatchEvent(new CustomEvent('ls-practice-created',{detail:{id:material.id}}));
    } catch (error) {
      status.textContent = error.message; status.classList.add('is-error');
    } finally { button.disabled = false; }
  }

  function watchScans() {
    const result = document.getElementById('scanResult');
    if (!result) return;
    const openWorkflow = () => {
      const card = result.querySelector('.scan-detail[data-id]');
      if (!card || card.dataset.workflowRequested === 'true') return;
      card.dataset.workflowRequested = 'true';
      const host = document.createElement('section');
      card.append(host);
      loadInto(host, card.dataset.id,card.workflowData);
    };
    new MutationObserver(openWorkflow).observe(result, {childList:true, subtree:true});
    openWorkflow();
  }

  const practiceForm = document.getElementById('practiceForm');
  if (practiceForm) {
    const activity = practiceForm.elements.activity, wax = practiceForm.querySelector('[data-practice-wax]');
    const updatePackage = mountPracticePackage(practiceForm);
    const update = () => { updatePackage?.();const visible=activity.value==='wax';wax.hidden=!visible;const cleaning=practiceForm.querySelector('[data-practice-clean]');if(cleaning)cleaning.hidden=activity.value!=='warm_clean';const premium=practiceForm.querySelector('[data-practice-premium]');if(premium)premium.hidden=activity.value!=='filing';practiceForm.elements.waxSku.disabled=!visible;if(practiceForm.elements.finishWax)practiceForm.elements.finishWax.disabled=!visible;
      const preview=document.getElementById('practiceTreatmentOverview');if(preview)preview.hidden=activity.value==='full';if(preview&&window.LSTreatmentOverview){const finish=practiceForm.elements.finishWax?.value||'none',sku={alpha:'24101',ultra:'24121',performance:'27933'}[finish],steps=visible?[{code:'practice_clean'},{code:'practice_wax',waxDetails:{sku:'24057'}}]:[{code:activity.value==='warm_clean'?'practice_clean':activity.value==='filing'?'practice_filing':'practice_repair'}];if(visible&&sku)steps.push({code:'practice_finish_wax',waxDetails:{sku}});if(activity.value==='filing'&&practiceForm.elements.premiumFiling?.checked)steps.push({code:'premium_file'},{code:'premium_diamond'});preview.innerHTML=window.LSTreatmentOverview.render(window.LSTreatmentOverview.workflow({steps,isTraining:true,material:{package:'Deze oefening'}}),{open:true});}
    };
    document.querySelectorAll('[data-practice-activity]').forEach(button => button.addEventListener('click', () => { activity.value = button.dataset.practiceActivity; update(); }));
    practiceForm.addEventListener('change', update); update();
    practiceForm.addEventListener('submit', event => { event.preventDefault(); createPractice(practiceForm); });
  }
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-workflow-action]');
    if (!form) return;
    event.preventDefault(); submitStep(form);
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-workflow-pause]');
    if (button) pauseStep(button);
  });
  window.LSWorkflows={practicePanel,open(host,materialId,{admin=false,memberId='',inspectionOnly=false,focused=false}={}){host.dataset.focusedWorkflow=String(focused);host.dataset.inspectionOnly=String(inspectionOnly);host.dataset.ownerWorkflow=String(admin);host.dataset.executionMemberId=memberId;return loadInto(host,materialId);}};
  watchScans();
  setInterval(updateTimers, 1000);
})();
