(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => number(value).toLocaleString('nl-NL', {style:'currency', currency:'EUR'});
  const decimal = (value, digits = 1) => number(value).toLocaleString('nl-NL', {maximumFractionDigits:digits});
  const date = value => {
    if (!value) return 'Nog niet';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('nl-NL', {day:'numeric', month:'short', year:'numeric'}).format(parsed);
  };
  const duration = value => {
    const seconds = number(value);
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600), minutes = Math.round((seconds % 3600) / 60);
    return hours ? `${hours} u ${minutes} min` : `${minutes} min`;
  };
  const field = (source, ...names) => {
    for (const name of names) if (source && source[name] !== undefined && source[name] !== null) return source[name];
    return '';
  };
  const list = (...values) => values.find(Array.isArray) || [];
  const statusLabel = value => ({
    ordered:'Besteld', besteld:'Besteld', draft:'Concept', concept:'Concept',
    partially_received:'Deels ontvangen', part_received:'Deels ontvangen', partial:'Deels ontvangen',
    received:'Ontvangen', ontvangen:'Ontvangen', closed:'Afgerond'
  }[String(value || '').toLowerCase()] || String(value || 'Onbekend'));
  const statusClass = value => /part_received|partial|deels/i.test(String(value)) ? 'is-partial' : /received|ontvangen|closed/i.test(String(value)) ? 'is-received' : 'is-ordered';
  const categoryLabel = value => ({
    wax:'Wax', cleaner:'Reiniging', cleaning:'Reiniging', fleece:'Reiniging', repair:'Reparatie',
    tool:'Gereedschap', equipment:'Apparatuur', resale:'Verkoopvoorraad', retail:'Verkoopvoorraad'
  }[String(value || '').toLowerCase()] || String(value || 'Overig'));

  let client = null;
  let target = null;
  let loading = false;

  function normalize(raw) {
    const suppliers = list(raw.suppliers), orders = list(raw.orders, raw.purchaseOrders), items = list(raw.items, raw.inventory, raw.products), tools = list(raw.tools, raw.toolAssets), orderLines = list(raw.orderLines, raw.lines);
    return {
      supplier: raw.supplier || suppliers[0] || {},
      order: raw.order || orders[0] || {},
      items,
      tools,
      orderLines,
      analytics: raw.analytics || raw.costs || {},
      practice: raw.practice || raw.training || raw.practiceAnalytics || {}
    };
  }

  function supplierCard(supplier) {
    const name = field(supplier, 'name', 'company_name') || 'Newsports B.V.';
    const address = field(supplier, 'address', 'street'), postal = field(supplier, 'postalCode', 'postal_code'), city = field(supplier, 'city');
    const contact = field(supplier, 'email', 'contact_email') || 'office@newsports.nl';
    const phone = field(supplier, 'phone', 'phone_number') || '+31 (0)85 877 17 51';
    return `<article class="inventory-card supplier-card">
      <header><div><span class="inventory-kicker">LEVERANCIER</span><h3>${escape(name)}</h3></div><span class="inventory-state is-received">Aangemaakt</span></header>
      <dl class="inventory-facts">
        <div><dt>Adres</dt><dd>${escape([address, postal, city].filter(Boolean).join(', ') || 'Goudstraat 36, 2718 RC Zoetermeer')}</dd></div>
        <div><dt>Contact</dt><dd><a href="mailto:${escape(contact)}">${escape(contact)}</a><br>${escape(phone)}</dd></div>
        <div><dt>BTW / KvK</dt><dd>${escape(field(supplier, 'vatNumber', 'vat_number') || 'NL859429787B01')}<br>${escape(field(supplier, 'registrationNumber', 'registration_number', 'chamber_of_commerce', 'kvk') || '73268119')}</dd></div>
      </dl>
    </article>`;
  }

  function orderCard(order, fallbackLines) {
    const lines = list(order.lines, fallbackLines), status = field(order, 'status') || 'ordered', id = field(order, 'id', 'orderId', 'order_id');
    const total = field(order, 'netTotal', 'net_total', 'total') || lines.reduce((sum, item) => sum + number(field(item, 'lineTotal', 'line_total')), 0);
    const received = lines.reduce((sum, item) => sum + number(field(item, 'quantityReceived', 'quantity_received')), 0);
    const ordered = lines.reduce((sum, item) => sum + number(field(item, 'quantityOrdered', 'quantity_ordered', 'quantity')), 0);
    const canReceive = !['received','ontvangen','closed'].includes(String(status).toLowerCase());
    return `<article class="inventory-card order-card" data-order-id="${escape(id)}">
      <header><div><span class="inventory-kicker">BESTELLING</span><h3>${escape(field(order, 'orderNumber', 'order_number', 'reference') || 'Holmenkol 26/27 · 29-09')}</h3></div><span class="inventory-state ${statusClass(status)}">${escape(statusLabel(status))}</span></header>
      <div class="order-progress" role="img" aria-label="${received} van ${ordered || lines.length} bestelde eenheden ontvangen"><i style="--received:${ordered ? Math.min(100, received / ordered * 100) : 0}%"></i></div>
      <dl class="inventory-facts order-facts"><div><dt>Artikelen</dt><dd>${lines.length || field(order, 'lineCount', 'line_count') || 23}</dd></div><div><dt>Netto</dt><dd>${money(total || 1125.3985)}</dd></div><div><dt>Levering</dt><dd>${escape(field(order, 'expectedDate', 'expected_date', 'requested_delivery', 'delivery') || 'Zo spoedig mogelijk')}</dd></div></dl>
      <p class="inventory-help">Besteld is nog geen beschikbare voorraad. Pas bij ontvangst worden artikelen en gereedschappen bijgeboekt.</p>
      ${canReceive ? `<button class="btn btn-gold" type="button" data-receive-order${id ? '' : ' disabled'}>Bestelling ontvangen</button>` : '<p class="inventory-confirmed">✓ Ontvangst verwerkt en voorraad bijgewerkt</p>'}
      <p class="inventory-action-status" role="status" aria-live="polite"></p>
    </article>`;
  }

  function itemRow(item) {
    const name = field(item, 'name', 'articleName', 'article_name'), sku = field(item, 'sku', 'articleNumber', 'article_number'), category = field(item, 'category', 'type');
    const onHand = field(item, 'stockOnHand', 'stock_on_hand', 'onHand', 'on_hand'), ordered = field(item, 'orderedQuantity', 'ordered_quantity', 'onOrder', 'on_order');
    const unit = field(item, 'unit', 'base_unit', 'contentUnit', 'content_unit') || 'st';
    const price = field(item, 'purchasePrice', 'purchase_price', 'netUnitPrice', 'net_unit_price', 'unitCost', 'unit_cost', 'average_cost_per_base');
    const planned = number(field(item, 'plannedUses', 'planned_uses', 'allocationUses', 'allocation_uses', 'allocation_target')) || (/tool|equipment|gereedschap|vijl|apparatuur/i.test(String(category)) ? 300 : 0);
    const low = Boolean(field(item, 'lowStock', 'low_stock'));
    return `<tr${low ? ' class="is-low-stock"' : ''}><td><strong>${escape(name || 'Artikel')}</strong><small>${escape(sku || '')}${field(item, 'ean') ? ` · ${escape(field(item, 'ean'))}` : ''}</small></td><td><span class="inventory-category">${escape(categoryLabel(category))}</span></td><td><b>${decimal(onHand, 2)} ${escape(unit)}</b>${number(ordered) ? `<small>${decimal(ordered, 2)} ${escape(unit)} besteld</small>` : ''}${low ? '<small class="inventory-low">Lage voorraad</small>' : ''}</td><td>${money(price)}${planned ? `<small>${money(number(price) / planned)} per gebruik bij ${planned} beurten</small>` : ''}</td></tr>`;
  }

  function inventoryTable(items) {
    const groups = items.reduce((map, item) => {
      const label = categoryLabel(field(item, 'category', 'type'));
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
      return map;
    }, new Map());
    return `<section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">VOORRAAD</span><h3>Artikelen en materialen</h3><p>Verbruik wordt op de werkelijk uitgevoerde stap geboekt. Wax krijgt dus geen vijlkosten en vijlen geen waxkosten.</p></div><span>${items.length} artikelen</span></div>
      ${items.length ? [...groups].map(([label, values]) => `<details class="inventory-group" open><summary><span>${escape(label)}</span><b>${values.length}</b></summary><div class="inventory-table-wrap"><table><thead><tr><th>Artikel</th><th>Soort</th><th>Beschikbaar</th><th>Inkoop / toerekening</th></tr></thead><tbody>${values.map(itemRow).join('')}</tbody></table></div></details>`).join('') : '<div class="inventory-empty"><b>Nog geen voorraad beschikbaar</b><p>Ontvang eerst de bestelling om de standen te vullen.</p></div>'}
    </section>`;
  }

  function toolCard(tool) {
    const uses = number(field(tool, 'uses', 'usesCount', 'uses_count')), planned = number(field(tool, 'plannedUses', 'planned_uses', 'targetUses', 'target_uses')) || 300;
    const cost = number(field(tool, 'acquisitionCost', 'acquisition_cost', 'cost')), actual = number(field(tool, 'actualCostPerUse', 'actual_cost_per_use')) || (uses ? cost / uses : 0), allocated = number(field(tool, 'plannedCostPerUse', 'planned_cost_per_use')) || (planned ? cost / planned : 0);
    const activeFlag = field(tool, 'active'), status = field(tool, 'status') || (activeFlag === 0 || activeFlag === '0' ? 'retired' : 'active'), id = field(tool, 'id');
    return `<article class="tool-card" data-tool-id="${escape(id)}">
      <header><div><span class="inventory-category">${escape(categoryLabel(field(tool, 'category', 'procedure') || 'tool'))}</span><h4>${escape(field(tool, 'name', 'label', 'itemName', 'item_name') || 'Gereedschap')}</h4><small>${escape(field(tool, 'sku') || '')}</small></div><span class="inventory-state ${status === 'active' ? 'is-received' : 'is-ordered'}">${status === 'active' ? 'In gebruik' : escape(status)}</span></header>
      <div class="tool-meter" aria-label="${uses} van ${planned} geplande gebruiken"><i style="--tool-progress:${Math.min(100, uses / planned * 100)}%"></i></div>
      <div class="tool-numbers"><span><small>Gebruikt</small><b>${uses}×</b></span><span><small>Nog begroot</small><b>${number(field(tool, 'remainingPlannedUses', 'remaining_planned_uses')) || Math.max(0, planned - uses)}×</b></span><span><small>Tijd</small><b>${duration(field(tool, 'lifetimeSeconds', 'lifetime_seconds', 'totalSeconds', 'total_seconds'))}</b></span></div>
      <dl class="tool-dates"><div><dt>Eerste gebruik</dt><dd>${escape(date(field(tool, 'firstUsedAt', 'first_used_at')))}</dd></div><div><dt>Laatste gebruik</dt><dd>${escape(date(field(tool, 'lastUsedAt', 'last_used_at')))}</dd></div><div><dt>Begroot per gebruik</dt><dd>${money(allocated)}</dd></div><div><dt>Werkelijk tot nu toe</dt><dd>${uses ? money(actual) : 'Na eerste gebruik'}</dd></div></dl>
      ${status === 'active' ? `<details class="tool-replace"><summary>Vervangen door een nieuwe</summary><form><label>Nieuwe aanschafprijs (€)<input name="cost" type="number" min="0" step="0.01" required></label><label>Naam / opmerking<input name="label" maxlength="120" placeholder="Bijv. nieuwe vijl"></label><button class="btn btn-dark" type="submit"${id ? '' : ' disabled'}>Oude afsluiten en nieuwe starten</button><p role="status" aria-live="polite"></p></form></details>` : `<p class="inventory-confirmed">Levensduur afgesloten op ${escape(date(field(tool, 'retiredAt', 'retired_at')))}</p>`}
    </article>`;
  }

  function toolsSection(tools) {
    return `<section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">GEREEDSCHAPSLEVENSDUUR</span><h3>Van eerste gebruik tot vervanging</h3><p>Een vijl of ander langzaam slijtend gereedschap wordt standaard over 300 relevante onderhoudsbeurten verdeeld. Alleen de stappen waarin het echt gebruikt is tellen mee.</p></div></div><div class="tool-grid">${tools.map(toolCard).join('') || '<div class="inventory-empty"><b>Nog geen actief gereedschap</b><p>Na ontvangst verschijnen de aangeschafte gereedschappen hier.</p></div>'}</div></section>`;
  }

  function analyticsCards(analytics, practice) {
    const productionGroup = typeof analytics.production === 'object' ? analytics.production : {};
    const production = field(analytics, 'productionJobs', 'production_jobs', 'completedJobs', 'completed_jobs') || field(productionGroup, 'sessions', 'count');
    const materialCost = field(analytics, 'materialCost', 'material_cost') || field(productionGroup, 'materialCost', 'material_cost');
    const toolCost = field(analytics, 'toolCost', 'tool_cost') || field(productionGroup, 'toolCost', 'tool_cost');
    const totalCost = field(productionGroup, 'totalCost', 'total_cost') || number(materialCost) + number(toolCost);
    const average = field(analytics, 'averageCost', 'average_cost') || (number(production) ? number(totalCost) / number(production) : 0);
    const totalSeconds = field(analytics, 'totalSeconds', 'total_seconds') || field(productionGroup, 'seconds', 'totalSeconds', 'total_seconds');
    const averageSeconds = field(analytics, 'averageSeconds', 'average_seconds') || (number(production) ? number(totalSeconds) / number(production) : 0);
    const practiceCount = field(practice, 'sessions', 'count', 'completedSessions', 'completed_sessions');
    const practiceUsage = field(practice, 'totalCost', 'total_cost', 'materialCost', 'material_cost');
    const practiceTime = field(practice, 'seconds', 'totalSeconds', 'total_seconds');
    const procedures = list(analytics.byProcedure, analytics.by_procedure);
    return `<div class="inventory-kpis">
      <article><span>Productiebeurten</span><strong>${number(production)}</strong><small>Oefenen is uitgesloten</small></article>
      <article><span>Materiaalkosten</span><strong>${money(materialCost)}</strong><small>Werkelijk verbruik</small></article>
      <article><span>Gereedschapskosten</span><strong>${money(toolCost)}</strong><small>Alleen relevante stappen</small></article>
      <article><span>Gemiddelde kostprijs</span><strong>${money(average)}</strong><small>Per productiebeurt</small></article>
      <article><span>Totale werktijd</span><strong>${duration(totalSeconds)}</strong><small>Alle geregistreerde productiestappen</small></article>
      <article><span>Gemiddelde werktijd</span><strong>${duration(averageSeconds)}</strong><small>Per afgeronde productiebeurt</small></article>
    </div>${procedures.length ? `<div class="procedure-costs" aria-label="Kosten en tijd per handeling">${procedures.map(item => `<article><span>${escape(field(item, 'procedure', 'name') || 'Handeling')}</span><strong>${money(field(item, 'totalCost', 'total_cost', 'cost'))}</strong><small>${number(field(item, 'sessions', 'uses', 'count'))} keer · ${duration(field(item, 'seconds', 'totalSeconds', 'total_seconds'))} · alleen eigen materialen en gereedschappen</small></article>`).join('')}</div>` : ''}<section class="practice-summary"><div class="practice-icon" aria-hidden="true">◎</div><div><span class="inventory-kicker">OEFENKLANT · APART GEMETEN</span><h3>${number(practiceCount)} oefensessie${number(practiceCount) === 1 ? '' : 's'}</h3><p>Voorraad en gereedschapslevensduur zijn wel bijgewerkt. Deze sessies tellen niet mee in productie, doorlooptijd of medewerkersproductie.</p></div><dl><div><dt>Verbruik / kosten</dt><dd>${typeof practiceUsage === 'number' || /^\d/.test(String(practiceUsage)) ? money(practiceUsage) : escape(practiceUsage || 'Nog niets')}</dd></div><div><dt>Oefentijd</dt><dd>${duration(practiceTime)}</dd></div></dl></section>`;
  }

  function render(raw) {
    const data = normalize(raw);
    target.innerHTML = `<div class="inventory-title"><div><span class="eyebrow">VOORRAAD &amp; KOSTEN</span><h2>Van bestelling tot onderhoudskost</h2><p>Newsports, Holmenkol-voorraad, werkelijk verbruik en gereedschapslevensduur in één overzicht.</p></div><button class="btn btn-dark" type="button" data-refresh-inventory>Vernieuwen</button></div>
      ${analyticsCards(data.analytics, data.practice)}
      <div class="inventory-top-grid">${supplierCard(data.supplier)}${orderCard(data.order, data.orderLines)}</div>
      ${inventoryTable(data.items)}
      ${toolsSection(data.tools)}`;
    target.querySelector('[data-refresh-inventory]').onclick = load;
    target.querySelector('[data-receive-order]')?.addEventListener('click', receiveOrder);
    target.querySelectorAll('.tool-replace form').forEach(form => form.addEventListener('submit', replaceTool));
  }

  async function load() {
    if (!client || !target || loading) return;
    loading = true;
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = '<div class="inventory-loading"><i></i><b>Voorraad en kosten laden…</b></div>';
    try { render(await client('/api/admin/inventory/overview')); }
    catch (error) { target.innerHTML = `<div class="inventory-error" role="alert"><b>Voorraad kon niet worden geladen</b><p>${escape(error.message)}</p><button class="btn btn-dark" type="button">Opnieuw proberen</button></div>`; target.querySelector('button').onclick = load; }
    finally { loading = false; target.removeAttribute('aria-busy'); }
  }

  async function receiveOrder(event) {
    const button = event.currentTarget, card = button.closest('[data-order-id]'), id = card.dataset.orderId, status = card.querySelector('.inventory-action-status');
    if (!id || !confirm('Markeer je deze levering als volledig ontvangen? De voorraad wordt dan beschikbaar.')) return;
    button.disabled = true; status.textContent = 'Ontvangst en voorraad worden verwerkt…';
    try { await client(`/api/admin/inventory/orders/${encodeURIComponent(id)}/receive`, {method:'POST', body:JSON.stringify({})}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  async function replaceTool(event) {
    event.preventDefault();
    const form = event.currentTarget, card = form.closest('[data-tool-id]'), id = card.dataset.toolId, status = form.querySelector('[role=status]'), values = Object.fromEntries(new FormData(form));
    const cost = Number(values.cost);
    if (!Number.isFinite(cost) || cost < 0) { status.textContent = 'Vul een geldige aanschafprijs in.'; return; }
    const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Vervanging opslaan…';
    try { await client(`/api/admin/inventory/tools/${encodeURIComponent(id)}/replace`, {method:'POST', body:JSON.stringify({cost, label:values.label || '', allocationTarget:300})}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  window.LattenspecialistInventory = {
    open(api, panel) { client = api; target = panel; load(); },
    clear() { client = null; target = null; loading = false; }
  };
})();
