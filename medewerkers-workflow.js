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

  async function request(path, options = {}) {
    if (!endpoint) throw new Error('De werkplaats is nog niet verbonden.');
    const token = sessionStorage.getItem('ls-team-session') || '';
    if (!token) throw new Error('Log opnieuw in om werkstappen te gebruiken.');
    const response = await fetch(endpoint + path, {
      ...options,
      headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...(options.headers || {})},
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'De werkstap kon niet worden bijgewerkt.');
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

  function usageValues(step) {
    const values = Array.isArray(step.usage) ? step.usage : step.usage && typeof step.usage === 'object' ? Object.entries(step.usage).map(([label, value]) => ({label, quantity:value})) : [];
    const result = values.map(item => {
      if (typeof item === 'string') return item;
      const label = item.label || item.name || item.sku || item.item_sku || 'Verbruik';
      const quantity = item.quantity ?? item.amount ?? item.used ?? '';
      const unit = item.unit || '';
      return `${label}${quantity !== '' ? `: ${quantity}${unit ? ` ${unit}` : ''}` : ''}`;
    });
    if (step.startWeight && step.endWeight) result.unshift(`Wax gebruikt: ${(step.startWeight - step.endWeight).toLocaleString('nl-NL', {maximumFractionDigits:2})} g`);
    if (step.cost) result.push(`Kosten: ${money(step.cost)}`);
    return result;
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

  function stepPositions(step,actionable) {
    const done=completed(step),running=active(step),resume=paused(step),mayStart=(actionable||resume)&&!running&&!done;
    const startText=done||running?'Gestart':resume?'Hervat stap':'Start stap';
    const startTime=stamp(step.startedAt),endTime=stamp(step.completedAt);
    return `<div class="workflow-step-positions" role="group" aria-label="Start en klaar van ${escape(step.title)}"><div class="workflow-start-position ${startTime?'is-started':''}"><span class="workflow-position-label">1 · START</span><button type="button" data-workflow-start class="${mayStart?'primary':''}"${mayStart?'':' disabled'}><span aria-hidden="true">${startTime?'✓':'▶'}</span> ${startText}</button><small>${startTime?`Gestart ${escape(startTime)}`:done?'Geen starttijd vastgelegd':mayStart?'Start de handeling en de timer':'Eerst de vorige stap afronden'}</small></div><div class="workflow-done-position ${done?'is-done':''}"><span class="workflow-position-label">2 · KLAAR</span><label><input type="checkbox" data-workflow-complete aria-label="${escape(step.title)} klaar"${done?' checked':''}${running?'':' disabled'}><span>Klaar – afvinken</span></label><small>${done?endTime?`Afgerond ${escape(endTime)}`:'Afgerond geregistreerd':running?'Controleer de stap en vink hem af':resume?'Hervat de stap vóór je afvinkt':'Eerst deze stap starten'}</small></div></div>`;
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
    const weight = waxStep(step) && !step.startWeight ? `<label>Gewicht waxblok vóór start (gram)<input name="startWeight" type="number" inputmode="decimal" min="0.1" max="5000" step="0.1" required placeholder="bijv. 182,4"></label><p class="workflow-help">${step.cleaningWaxSku?"Reiniging: gebruik altijd Alpha Mix Yellow. Dit verbruik staat los van de volgende glijwax.":"Weeg het gekozen waxblok zonder losse verpakking."} Na afloop weeg je hetzelfde blok opnieuw.</p>` : `<p class="workflow-help">${resume ? 'De eerder gemeten tijd en het begingewicht blijven bewaard.' : 'De timer start zodra je op de knop drukt. Rond deze stap af voordat je doorgaat.'}</p>`;
    return `<div class="workflow-actions"><form data-workflow-action="start" data-guide-version-start="${escape(step.guide?.version||'')}" data-step-id="${escape(step.id)}">${weight}<button type="submit" hidden>Start stap</button><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
  }

  document.addEventListener('change',event=>{const input=event.target;if(input.name==='toolSkus'){const select=input.closest('fieldset')?.querySelector(`[name="asset_${CSS.escape(input.value)}"]`);if(select)select.disabled=!input.checked;}});

  function toolChoices(step) {
    const tools = step.requirements.filter(item => item && typeof item === 'object' && ['tool','equipment'].includes(String(item.trackingMode || item.tracking_mode || '').toLowerCase()));
    if (!tools.length) return '';
    return `<fieldset class="workflow-tool-choices"><legend>Welke gereedschappen heb je echt gebruikt?</legend>${tools.map(item => `<label><input type="checkbox" name="toolSkus" value="${escape(item.sku)}" checked><span>${escape(item.name || item.sku)}</span></label>${item.assets?.length>1?`<label>Gebruikt exemplaar van ${escape(item.name||item.sku)}<select name="asset_${escape(item.sku)}" required><option value="">Kies exemplaar</option>${item.assets.map(a=>`<option value="${escape(a.id)}">${escape(a.label)}</option>`).join('')}</select></label>`:''}`).join('')}<small>Alleen aangevinkte gereedschappen tellen mee voor levensduur en kosten.</small></fieldset>`;
  }

  function finishFormFields(step) {
    const tools = toolChoices(step), toolFlag = tools ? ' data-has-tool-choices="true"' : '';
    if (waxStep(step)) return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}" data-start-weight="${step.startWeight || ''}"${toolFlag}><label>Gewicht waxblok na afloop (gram)<input name="endWeight" type="number" inputmode="decimal" min="0" max="5000" step="0.1" required${step.startWeight ? ` max="${step.startWeight}"` : ''} placeholder="lager dan het begingewicht"></label>${tools}<button class="primary" type="submit">Afronden &amp; verbruik boeken</button><button type="button" data-workflow-pause>Pauzeer timer</button><p class="workflow-help">Begingewicht: <strong>${step.startWeight ? `${step.startWeight.toLocaleString('nl-NL')} g` : 'nog niet ontvangen'}</strong>. Het verschil gaat automatisch van de voorraad af.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    if (cleaningStep(step)) return `<div class="workflow-actions"><form class="workflow-consumption-form" data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><label>Cleaner gebruikt (ml)<input name="cleanerMl" type="number" inputmode="decimal" min="0" max="1000" step="0.1" value="0"></label><label>Fleece gebruikt (cm)<input name="fleeceCm" type="number" inputmode="decimal" min="0" max="1000" step="0.1" value="0"></label>${tools}<button class="primary" type="submit">Stap afronden</button><button type="button" data-workflow-pause>Pauzeer timer</button><p class="workflow-help">Vul het echte verbruik in; ook bij een oefening wordt dit van de voorraad afgeboekt.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    if (repairStep(step)) return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><label>Reparatiestrips gebruikt (stuks)<input name="repairStrips" type="number" inputmode="numeric" min="0" max="50" step="1" value="0"></label><label>Kleur reparatiestrip<select name="repairColor"><option value="transparent">Transparant</option><option value="black">Zwart</option></select></label>${tools}<button class="primary" type="submit">Stap afronden</button><button type="button" data-workflow-pause>Pauzeer timer</button><p class="workflow-help">Boek alleen de werkelijk gebruikte strips.</p><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
    return `<div class="workflow-actions"><form data-workflow-action="finish" data-step-id="${escape(step.id)}"${toolFlag}><p class="workflow-help">De tijd en het gebruik van toegewezen gereedschappen worden bij afronden vastgelegd.</p>${tools}<button class="primary" type="submit">Stap afronden</button><button type="button" data-workflow-pause>Pauzeer timer</button><p class="workflow-message" role="status" aria-live="polite"></p></form></div>`;
  }

  function finishForm(step) {
    return finishFormFields(step).replace(/<button class="primary" type="submit">[^<]*<\/button>/,'<button type="submit" hidden>Klaar – afvinken</button>').replace(/(<form\b[^>]*>)/,match=>match+(window.LSMaintenanceGuide?.checks(step)||''));
  }

  function stepCard(step, actionable) {
    const state = completed(step) ? 'is-completed' : active(step) || paused(step) ? 'is-active' : actionable ? 'is-next' : 'is-locked';
    const requirements = step.requirements.length ? `<div class="workflow-needs" aria-label="Benodigdheden">${step.requirements.map(item => `<span>${escape(requirementLabel(item))}</span>`).join('')}</div>` : '<div class="workflow-needs"><span>Geen voorraadartikel geregistreerd</span></div>';
    const results = usageValues(step);
    const actions = active(step) ? finishForm(step) : (paused(step) || actionable) && !completed(step) ? startForm(step) : '';
    return `<article class="workflow-step ${state}" data-step-id="${escape(step.id)}"><div class="workflow-step-main"><div class="workflow-step-head"><h4>${escape(step.title)}</h4><span>${completed(step) ? 'Afgerond' : active(step) ? 'Bezig' : paused(step) ? 'Gepauzeerd' : actionable ? 'Volgende stap' : 'Wacht'}</span></div>${stepPositions(step,actionable)}${step.instruction ? `<p class="workflow-instruction">${escape(step.instruction)}</p>` : ''}${requirements}${window.LSMaintenanceGuide?.instruction(step,actionable||active(step)||paused(step))||''}<div class="workflow-timing">${timing(step)}</div>${results.length ? `<div class="workflow-result">${results.map(value => `<span>${escape(value)}</span>`).join('')}</div>` : ''}${actions}</div></article>`;
  }

  function render(host, data, materialId) {
    const workflow = normalizeWorkflow(data);
    const steps = workflow.steps;
    const finished = steps.filter(completed).length;
    const runningIndex = steps.findIndex(step => active(step) || paused(step));
    const nextIndex = runningIndex >= 0 ? runningIndex : steps.findIndex(step => !completed(step));
    const material = workflow.material || {};
    const title = workflow.title || (workflow.isTraining ? 'Oefenklant' : 'Werkplan');
    host.dataset.materialId = materialId || material.id || '';
    host.className = 'workflow-shell';
    if (!steps.length) {
      host.innerHTML = `<div class="workflow-empty"><strong>Nog geen werkstappen beschikbaar.</strong><p>Ontvang het materiaal of vernieuw dit scherm. Bij een oude aanvraag kan het werkplan bij de eerste start worden aangemaakt.</p></div>`;
      return;
    }
    const summary = workflow.summary || {}, totalCost = number(summary.totalCost ?? summary.total_cost), totalSeconds = number(summary.totalSeconds ?? summary.total_seconds);
    host.innerHTML = `<div class="workflow-head"><div><span class="eyebrow">${workflow.isTraining ? 'OEFENKLANT' : 'STAPPENPLAN'}</span><h3>${escape(title)}</h3><p>${finished} van ${steps.length} stappen afgerond${totalSeconds ? ` · ${formatDuration(totalSeconds)} gewerkt` : ''}${totalCost ? ` · ${money(totalCost)} geregistreerd` : ''}</p></div><div class="workflow-badges">${workflow.isTraining ? '<span class="workflow-badge is-training">Buiten productiecijfers</span>' : ''}<span class="workflow-badge">Verbruik boeken bij afronden</span></div></div><div class="workflow-progress" aria-label="${finished} van ${steps.length} stappen afgerond"><i style="width:${steps.length ? finished / steps.length * 100 : 0}%"></i></div>${window.LSMaintenanceGuide?.preparation(workflow)||''}<div class="workflow-list">${steps.map((step, index) => stepCard(step, index === nextIndex)).join('')}</div>`;
    const currentGuide=host.querySelector('.workflow-step.is-next .maintenance-guide details,.workflow-step.is-active .maintenance-guide details');if(currentGuide)currentGuide.open=true;
    updateTimers();
  }

  async function loadInto(host, materialId, initialData) {
    const expectedToken=sessionStorage.getItem('ls-team-session');
    host.className = 'workflow-shell';
    host.dataset.materialId = materialId;
    host.innerHTML = '<p>Werkstappen laden…</p>';
    try {
      const data = initialData && (initialData.steps || initialData.workflow?.steps || initialData.job?.steps) ? initialData : await request(`/api/team/operations/materials/${encodeURIComponent(materialId)}/workflow`);
      if(!host.isConnected||host.dataset.materialId!==materialId||sessionStorage.getItem('ls-team-session')!==expectedToken)return;
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
      await request(`/api/team/operations/steps/${encodeURIComponent(form.dataset.stepId)}/${action}`, {method:'POST', body:JSON.stringify(body)});
      const host = form.closest('.workflow-shell');
      await loadInto(host, host.dataset.materialId);
    } catch (error) {
      message.textContent = error.message; message.classList.add('is-error');
    } finally {
      unlock();
    }
  }

  async function pauseStep(button) {
    const form = button.closest('[data-workflow-action]'), message = form.querySelector('.workflow-message');
    const unlock=lockStep(form);if(!unlock)return;
    button.disabled = true; message.classList.remove('is-error'); message.textContent = 'Timer pauzeren…';
    try {
      await request(`/api/team/operations/steps/${encodeURIComponent(form.dataset.stepId)}/pause`, {method:'POST', body:'{}'});
      const host = form.closest('.workflow-shell');
      await loadInto(host, host.dataset.materialId);
    } catch (error) {
      message.textContent = error.message; message.classList.add('is-error');
    } finally {
      unlock();
    }
  }

  async function createPractice(form) {
    const status = document.getElementById('practiceStatus'), result = document.getElementById('practiceResult'), button = form.querySelector('button[type=submit]');
    const values = Object.fromEntries(new FormData(form));
    if (values.activity !== 'wax') delete values.waxSku;
    button.disabled = true; status.classList.remove('is-error'); status.textContent = 'Oefenopdracht aanmaken…'; result.replaceChildren();
    try {
      const data = await request('/api/team/practice', {method:'POST', body:JSON.stringify(values)});
      const material = data.material || data.workflow?.material || {};
      if (!material.id) throw new Error('De oefening is aangemaakt, maar kon niet worden geopend. Vernieuw en probeer opnieuw.');
      status.textContent = 'Oefening klaar. Start hieronder de eerste stap.';
      const host = document.createElement('section'); result.append(host);
      await loadInto(host, material.id, data);
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
    const update = () => { const visible = activity.value === 'wax'; wax.hidden = !visible; practiceForm.elements.waxSku.disabled = !visible; };
    activity.addEventListener('change', update); update();
    practiceForm.addEventListener('submit', event => { event.preventDefault(); createPractice(practiceForm); });
  }
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-workflow-action]');
    if (!form) return;
    event.preventDefault(); submitStep(form);
  });
  document.addEventListener('click', event => {
    const start=event.target.closest('[data-workflow-start]');if(start){const form=start.closest('.workflow-step').querySelector('[data-workflow-action="start"]');if(form&&!form.dataset.submitting)form.requestSubmit();return;}
    const button = event.target.closest('[data-workflow-pause]');
    if (button) pauseStep(button);
  });
  document.addEventListener('change',event=>{
    const input=event.target.closest('[data-workflow-complete]');if(!input)return;
    input.checked=false; // Only the stored response may display a completed checkmark.
    const form=input.closest('.workflow-step').querySelector('[data-workflow-action="finish"]');
    if(form&&!form.dataset.submitting)form.requestSubmit();
  });
  watchScans();
  setInterval(updateTimers, 1000);
})();
