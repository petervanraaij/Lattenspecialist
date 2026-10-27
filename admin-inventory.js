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
  const inputDate = value => value ? String(value).slice(0, 10) : '';
  const dueState = (invoice, todayValue = '') => {
    if (String(field(invoice, 'status')).toLowerCase() === 'paid' || field(invoice, 'paidAt', 'paid_at')) return {key:'paid', label:'Betaald', days:0};
    if (field(invoice, 'isOverdue', 'is_overdue') === true || Number(field(invoice, 'isOverdue', 'is_overdue')) === 1) return {key:'overdue', label:'Vervallen', days:-Math.max(1,number(field(invoice, 'daysOverdue', 'days_overdue')))};
    const due = inputDate(field(invoice, 'dueDate', 'due_date'));
    if (!due) return {key:'open', label:'Open', days:null};
    let today = todayValue ? new Date(`${inputDate(todayValue)}T00:00:00`) : new Date(); if (Number.isNaN(today.getTime())) today = new Date(); today.setHours(0,0,0,0);
    const targetDate = new Date(`${due}T00:00:00`); if (Number.isNaN(targetDate.getTime())) return {key:'open', label:'Open', days:null};
    const days = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
    if (days < 0) return {key:'overdue', label:'Vervallen', days};
    if (days <= 7) return {key:'soon', label:'Binnenkort', days};
    return {key:'open', label:'Open', days};
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
  let view = 'inventory';

  function normalize(raw) {
    const suppliers = list(raw.suppliers), orders = list(raw.orders, raw.purchaseOrders), items = list(raw.items, raw.inventory, raw.products), tools = list(raw.tools, raw.toolAssets), orderLines = list(raw.orderLines, raw.lines), movements = list(raw.movements, raw.inventoryMovements);
    const allSuppliers = suppliers.length ? suppliers : raw.supplier ? [raw.supplier] : [];
    const allOrders = orders.length ? orders : raw.order ? [raw.order] : [];
    return {
      supplier: raw.supplier || allSuppliers[0] || {},
      suppliers: allSuppliers,
      order: raw.order || allOrders[0] || {},
      orders: allOrders,
      items,
      tools,
      orderLines,
      movements,
      analytics: raw.analytics || raw.costs || {},
      practice: raw.practice || raw.training || raw.practiceAnalytics || {}
    };
  }

  function supplierForm(supplier = {}, mode = 'edit') {
    const id = field(supplier, 'id'), value = (...names) => escape(field(supplier, ...names));
    return `<form class="supplier-form" data-supplier-form="${mode}"${id ? ` data-supplier-id="${escape(id)}"` : ''}>
      <div class="supplier-form-grid">
        <label>Bedrijfsnaam<input name="name" maxlength="160" required value="${value('name','company_name')}"></label>
        <label>E-mail<input name="email" type="email" maxlength="160" value="${value('email','contact_email')}"></label>
        <label>Telefoon<input name="phone" maxlength="40" value="${value('phone','phone_number')}"></label>
        <label>Straat en huisnummer<input name="address" maxlength="200" value="${value('address','street')}"></label>
        <label>Postcode<input name="postalCode" maxlength="20" value="${value('postalCode','postal_code')}"></label>
        <label>Plaats<input name="city" maxlength="100" value="${value('city')}"></label>
        <label>Land<input name="country" maxlength="80" value="${value('country') || 'Nederland'}"></label>
        <label>BTW-nummer<input name="vatNumber" maxlength="40" value="${value('vatNumber','vat_number')}"></label>
        <label>KvK-nummer<input name="chamberOfCommerce" maxlength="40" value="${value('chamberOfCommerce','chamber_of_commerce','registrationNumber','registration_number','kvk')}"></label>
        <label>IBAN<input name="iban" maxlength="50" value="${value('iban')}"></label>
        <label>BIC<input name="bic" maxlength="30" value="${value('bic')}"></label>
        <label>Administratie-e-mail<input name="administrationEmail" type="email" maxlength="160" value="${value('administrationEmail','administration_email')}"></label>
        <label class="supplier-form-wide">Website / portaal<input name="portalUrl" type="url" maxlength="300" value="${value('portalUrl','portal_url')}"></label>
        <label class="supplier-form-wide">Notities<textarea name="notes" rows="3" maxlength="1000">${value('notes')}</textarea></label>
      </div>
      <div class="supplier-form-actions"><button class="btn btn-dark" type="submit">${mode === 'create' ? 'Leverancier toevoegen' : 'Wijzigingen opslaan'}</button><p role="status" aria-live="polite"></p></div>
    </form>`;
  }

  function supplierCard(supplier, orders = []) {
    const name = field(supplier, 'name', 'company_name') || 'Naam ontbreekt';
    const address = field(supplier, 'address', 'street'), postal = field(supplier, 'postalCode', 'postal_code'), city = field(supplier, 'city');
    const contact = field(supplier, 'email', 'contact_email'), phone = field(supplier, 'phone', 'phone_number');
    const id = field(supplier, 'id'), linkedOrders = orders.filter(order => String(field(order, 'supplierId', 'supplier_id')) === String(id));
    return `<article class="inventory-card supplier-card" data-supplier-id="${escape(id)}">
      <header><div><span class="inventory-kicker">LEVERANCIER</span><h3>${escape(name)}</h3></div><span class="inventory-state is-received">${linkedOrders.length} bestelling${linkedOrders.length === 1 ? '' : 'en'}</span></header>
      <dl class="inventory-facts">
        <div><dt>Adres</dt><dd>${escape([address, postal, city].filter(Boolean).join(', ') || 'Niet ingevuld')}</dd></div>
        <div><dt>Contact</dt><dd>${contact ? `<a href="mailto:${escape(contact)}">${escape(contact)}</a>` : 'Niet ingevuld'}${phone ? `<br>${escape(phone)}` : ''}</dd></div>
        <div><dt>BTW / KvK</dt><dd>${escape(field(supplier, 'vatNumber', 'vat_number') || 'Niet ingevuld')}<br>${escape(field(supplier, 'registrationNumber', 'registration_number', 'chamber_of_commerce', 'kvk') || 'Niet ingevuld')}</dd></div>
      </dl>
      <details class="supplier-edit"><summary>Leveranciersgegevens wijzigen</summary>${supplierForm(supplier)}</details>
      ${linkedOrders.length ? `<div class="supplier-orders"><h4>Bestellingen</h4>${linkedOrders.map(order => orderCard(order, [])).join('')}</div>` : '<p class="inventory-help">Nog geen bestelling aan deze leverancier gekoppeld.</p>'}
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
    const minimum = number(field(item, 'minimumStock', 'minimum_stock'));
    const tracking = String(field(item, 'trackingMode', 'tracking_mode')).toLowerCase(), step = ['mass','volume','length'].includes(tracking) ? '0.1' : '1';
    const adjustment = ['tool','equipment'].includes(tracking) ? '<p class="inventory-tool-note">Gereedschap corrigeer je niet als losse voorraad. Gebruik hieronder de levensduur en vervanging, zodat gebruik en kosten controleerbaar blijven.</p>' : `<form data-adjust-stock><label>Correctie (${escape(unit)})<input name="delta" type="number" step="${step}" min="-100000" max="100000" required placeholder="+ of −"></label><label>Reden<input name="note" maxlength="240" required placeholder="Bijv. telling of beschadiging"></label><button class="btn btn-dark" type="submit">Correctie boeken</button><p role="status" aria-live="polite"></p></form>`;
    const low = Boolean(field(item, 'lowStock', 'low_stock'));
    return `<tr${low ? ' class="is-low-stock"' : ''} data-item-sku="${escape(sku)}"><td><strong>${escape(name || 'Artikel')}</strong><small>${escape(sku || '')}${field(item, 'ean') ? ` · ${escape(field(item, 'ean'))}` : ''}</small></td><td><span class="inventory-category">${escape(categoryLabel(category))}</span></td><td><b>${decimal(onHand, 2)} ${escape(unit)}</b>${number(ordered) ? `<small>${decimal(ordered, 2)} ${escape(unit)} besteld</small>` : ''}${low ? '<small class="inventory-low">Lage voorraad</small>' : ''}<small>Minimum ${decimal(minimum,2)} ${escape(unit)}</small></td><td>${money(price)}${planned ? `<small>${money(number(price) / planned)} per gebruik bij ${planned} beurten</small>` : ''}</td><td><details class="inventory-manage"><summary>Beheren</summary>${adjustment}<form data-update-minimum><label>Minimumvoorraad (${escape(unit)})<input name="minimumStock" type="number" step="${step}" min="0" max="100000" required value="${minimum}"></label><button class="btn btn-ghost" type="submit">Minimum opslaan</button><p role="status" aria-live="polite"></p></form></details></td></tr>`;
  }

  function inventoryTable(items) {
    const groups = items.reduce((map, item) => {
      const label = categoryLabel(field(item, 'category', 'type'));
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
      return map;
    }, new Map());
    return `<section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">VOORRAAD</span><h3>Artikelen en materialen</h3><p>Verbruik wordt op de werkelijk uitgevoerde stap geboekt. Wax krijgt dus geen vijlkosten en vijlen geen waxkosten.</p></div><span>${items.length} artikelen</span></div>
      ${items.length ? [...groups].map(([label, values]) => `<details class="inventory-group" open><summary><span>${escape(label)}</span><b>${values.length}</b></summary><div class="inventory-table-wrap"><table><thead><tr><th>Artikel</th><th>Soort</th><th>Beschikbaar</th><th>Inkoop / toerekening</th><th>Beheren</th></tr></thead><tbody>${values.map(itemRow).join('')}</tbody></table></div></details>`).join('') : '<div class="inventory-empty"><b>Nog geen voorraad beschikbaar</b><p>Ontvang eerst de bestelling om de standen te vullen.</p></div>'}
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

  function movementSection(movements) {
    const labels = {receipt:'Ontvangst',maintenance:'Onderhoud',training:'Oefening',adjustment:'Correctie',tool_replacement:'Vervanging'};
    return `<section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">MUTATIES</span><h3>Laatste voorraadbewegingen</h3><p>Ontvangsten, werkelijk verbruik en handmatige correcties blijven controleerbaar.</p></div><span>${movements.length}</span></div><div class="inventory-movements">${movements.slice(0,100).map(item => { const quantity = number(field(item,'quantity')), unit = field(item,'baseUnit','base_unit','unit') || ''; return `<div><span><b>${escape(field(item,'itemName','item_name','name') || field(item,'sku'))}</b><small>${escape(labels[field(item,'movementType','movement_type')] || field(item,'movementType','movement_type'))} · ${escape(date(field(item,'createdAt','created_at')))}</small></span><strong class="${quantity < 0 ? 'is-out' : 'is-in'}">${quantity > 0 ? '+' : ''}${decimal(quantity,2)} ${escape(unit)}</strong><small>${escape(field(item,'note') || 'Geen toelichting')}</small></div>`; }).join('') || '<p>Nog geen voorraadmutaties.</p>'}</div></section>`;
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

  function invoiceForm(type, invoice = {}, suppliers = [], orders = [], mode = 'edit') {
    const id = field(invoice, 'id'), purchase = type === 'purchase', value = (...names) => escape(field(invoice, ...names));
    const supplierId = String(field(invoice, 'supplierId', 'supplier_id')), orderId = String(field(invoice, 'purchaseOrderId', 'purchase_order_id'));
    const supplierOptions = suppliers.map(item => `<option value="${escape(field(item,'id'))}"${String(field(item,'id')) === supplierId ? ' selected' : ''}>${escape(field(item,'name') || field(item,'id'))}</option>`).join('');
    const orderOptions = orders.map(item => `<option value="${escape(field(item,'id'))}"${String(field(item,'id')) === orderId ? ' selected' : ''}>${escape(field(item,'orderNumber','order_number') || field(item,'id'))}</option>`).join('');
    return `<form class="invoice-form" data-invoice-form="${type}" data-invoice-mode="${mode}"${id ? ` data-invoice-id="${escape(id)}"` : ''}>
      <div class="invoice-form-grid">
        <label>Factuurnummer<input name="invoiceNumber" maxlength="100" required value="${value('invoiceNumber','invoice_number')}"></label>
        ${purchase ? `<label>Leverancier<select name="supplierId" required><option value="">Kies leverancier</option>${supplierOptions}</select></label><label>Inkoopbestelling<select name="purchaseOrderId"><option value="">Niet gekoppeld</option>${orderOptions}</select></label><label>Ordernummer leverancier<input name="supplierOrderNumber" maxlength="100" value="${value('supplierOrderNumber','supplier_order_number')}"></label><label>Ons debiteurnummer<input name="debtorNumber" maxlength="100" value="${value('debtorNumber','debtor_number')}"></label>` : `<label>Klantnaam<input name="customerName" maxlength="160" required value="${value('customerName','customer_name')}"></label><label>Klantcode<input name="customerCode" maxlength="100" value="${value('customerCode','customer_code')}"></label><label>Klant-e-mail<input name="customerEmail" type="email" maxlength="160" value="${value('customerEmail','customer_email')}"></label>`}
        <label>Factuurdatum<input name="invoiceDate" type="date" required value="${escape(inputDate(field(invoice,'invoiceDate','invoice_date')))}"></label>
        <label class="invoice-due-input">Uiterste betaaldatum<input name="dueDate" type="date" required value="${escape(inputDate(field(invoice,'dueDate','due_date')))}"></label>
        <label>Betaalvoorwaarden<input name="paymentTerms" maxlength="80" value="${value('paymentTerms','payment_terms') || '30 dagen netto'}"></label>
        <label>Bedrag excl. btw (€)<input name="amountExcl" type="number" min="0" max="1000000" step="0.01" required value="${number(field(invoice,'amountExcl','amount_excl'))}"></label>
        <label>Btw (€)<input name="vatAmount" type="number" min="0" max="1000000" step="0.01" required value="${number(field(invoice,'vatAmount','vat_amount'))}"></label>
        <label>Totaal incl. btw (€)<input name="totalAmount" type="number" min="0" max="1000000" step="0.01" required value="${number(field(invoice,'totalAmount','total_amount'))}"></label>
        <label>Valuta<input name="currency" maxlength="3" value="${value('currency') || 'EUR'}"></label>
        <label>Referentie<input name="reference" maxlength="160" value="${value('reference')}"></label>
        <label class="invoice-form-wide">Bestandsnaam administratie (geen openbare link)<input name="sourceFilename" maxlength="240" value="${value('sourceFilename','source_filename')}"></label>
        <label class="invoice-form-wide">Notities<textarea name="notes" rows="3" maxlength="1000">${value('notes')}</textarea></label>
      </div>
      <div class="supplier-form-actions"><button class="btn btn-dark" type="submit">${mode === 'create' ? 'Factuur toevoegen' : 'Wijzigingen opslaan'}</button><p role="status" aria-live="polite"></p></div>
    </form>`;
  }

  function invoiceCard(invoice, type, suppliers, orders, today) {
    const state = dueState(invoice, today), id = field(invoice, 'id'), purchase = type === 'purchase', dueDate = field(invoice, 'dueDate', 'due_date');
    const party = purchase ? field(invoice, 'supplierName', 'supplier_name') : field(invoice, 'customerName', 'customer_name');
    const dueText = state.key === 'paid' ? `Betaald ${date(field(invoice,'paidAt','paid_at'))}` : state.days === null ? 'Geen datum' : state.days < 0 ? `${Math.abs(state.days)} dag${Math.abs(state.days) === 1 ? '' : 'en'} te laat` : state.days === 0 ? 'Vandaag betalen' : `Nog ${state.days} dag${state.days === 1 ? '' : 'en'}`;
    return `<article class="invoice-card is-${state.key}" data-invoice-id="${escape(id)}" data-invoice-type="${type}">
      <header><div><span class="inventory-kicker">${purchase ? 'CREDITEUR' : 'DEBITEUR'}</span><h3>${escape(field(invoice,'invoiceNumber','invoice_number') || 'Factuur')}</h3><p>${escape(party || 'Naam ontbreekt')}</p></div><div class="invoice-due"><span>Uiterste betaaldatum</span><strong>${escape(dueDate ? date(dueDate) : 'Niet ingevuld')}</strong><small>${escape(dueText)}</small><b>${escape(state.label)}</b></div></header>
      <div class="invoice-amount"><span>Totaal incl. btw</span><strong>${money(field(invoice,'totalAmount','total_amount'))}</strong><small>${money(field(invoice,'amountExcl','amount_excl'))} excl. · ${money(field(invoice,'vatAmount','vat_amount'))} btw</small></div>
      <dl class="invoice-facts"><div><dt>Factuurdatum</dt><dd>${escape(date(field(invoice,'invoiceDate','invoice_date')))}</dd></div><div><dt>Referentie</dt><dd>${escape(field(invoice,'reference') || '—')}</dd></div>${purchase ? `<div><dt>Bestelling</dt><dd>${escape(field(invoice,'purchaseOrderNumber','purchase_order_number','supplierOrderNumber','supplier_order_number') || '—')}</dd></div>` : `<div><dt>Klantcode</dt><dd>${escape(field(invoice,'customerCode','customer_code') || '—')}</dd></div>`}</dl>
      <div class="invoice-actions">${state.key !== 'paid' ? '<button class="btn btn-gold" type="button" data-mark-paid>Markeer als betaald</button>' : '<span class="inventory-confirmed">✓ Betaling verwerkt</span>'}</div>
      <details class="invoice-edit"><summary>Factuurgegevens wijzigen</summary>${invoiceForm(type, invoice, suppliers, orders)}</details>
    </article>`;
  }

  function renderAccounting(data, type) {
    const purchase = type === 'purchase', invoices = list(purchase ? data.purchaseInvoices : data.salesInvoices), suppliers = list(data.suppliers), orders = list(data.orders), today = field(data, 'today');
    const states = invoices.map(invoice => dueState(invoice, today)), open = states.filter(item => item.key !== 'paid'), soon = states.filter(item => item.key === 'soon'), overdue = states.filter(item => item.key === 'overdue'), outstanding = invoices.reduce((sum,item,index) => sum + (states[index].key === 'paid' ? 0 : number(field(item,'totalAmount','total_amount'))),0);
    return `<div class="inventory-title"><div><span class="eyebrow">${purchase ? 'CREDITEUREN' : 'DEBITEUREN'}</span><h2>${purchase ? 'Inkoopfacturen en betaaldatums' : 'Verkoopfacturen en ontvangsten'}</h2><p>${purchase ? 'Bewaar zicht op wat je leveranciers uiterlijk moet betalen.' : 'Volg wat klanten nog moeten betalen en wanneer het bedrag binnen moet zijn.'}</p></div><button class="btn btn-dark" type="button" data-refresh-inventory>Vernieuwen</button></div>
      <div class="accounting-kpis"><article><span>Open</span><strong>${open.length}</strong></article><article class="is-soon"><span>Binnen 7 dagen</span><strong>${soon.length}</strong></article><article class="is-overdue"><span>Vervallen</span><strong>${overdue.length}</strong></article><article><span>Openstaand</span><strong>${money(outstanding)}</strong></article></div>
      <details class="inventory-section invoice-create"><summary>+ ${purchase ? 'Inkoopfactuur' : 'Verkoopfactuur'} toevoegen</summary>${invoiceForm(type, {}, suppliers, orders, 'create')}</details>
      <div class="invoice-list">${invoices.map(invoice => invoiceCard(invoice,type,suppliers,orders,today)).join('') || `<div class="inventory-empty"><b>Nog geen ${purchase ? 'inkoop' : 'verkoop'}facturen</b></div>`}</div>`;
  }

  function renderInventory(data) {
    return `<div class="inventory-title"><div><span class="eyebrow">VOORRAADBEHEER</span><h2>Voorraad, verbruik en kostprijs</h2><p>Bekijk wat beschikbaar en besteld is, boek telverschillen en bewaak de minimumvoorraad.</p></div><button class="btn btn-dark" type="button" data-refresh-inventory>Vernieuwen</button></div>
      ${analyticsCards(data.analytics, data.practice)}
      <section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">BESTELLINGEN</span><h3>Ontvangst en voorraad</h3><p>Boek een bestelling pas als de levering fysiek is gecontroleerd.</p></div><span>${data.orders.length}</span></div><div class="inventory-top-grid inventory-orders-grid">${data.orders.map(order => orderCard(order, data.orderLines)).join('') || '<div class="inventory-empty"><b>Geen bestellingen</b></div>'}</div></section>
      ${inventoryTable(data.items)}
      ${movementSection(data.movements)}
      ${toolsSection(data.tools)}`;
  }

  function renderSuppliers(data) {
    const known = new Set(data.suppliers.map(item => String(field(item, 'id')))), unlinked = data.orders.filter(order => !known.has(String(field(order, 'supplierId', 'supplier_id'))));
    return `<div class="inventory-title"><div><span class="eyebrow">LEVERANCIERS</span><h2>Leveranciers en bestellingen</h2><p>Beheer contact-, bedrijfs- en administratiegegevens en zie direct welke bestellingen erbij horen.</p></div><button class="btn btn-dark" type="button" data-refresh-inventory>Vernieuwen</button></div>
      <details class="inventory-section supplier-create"><summary>+ Nieuwe leverancier toevoegen</summary>${supplierForm({}, 'create')}</details>
      <div class="supplier-list">${data.suppliers.map(supplier => supplierCard(supplier, data.orders)).join('') || '<div class="inventory-empty"><b>Nog geen leveranciers</b><p>Voeg hierboven de eerste leverancier toe.</p></div>'}</div>
      ${unlinked.length ? `<section class="inventory-section"><div class="inventory-section-head"><div><span class="inventory-kicker">NIET GEKOPPELD</span><h3>Bestellingen zonder leverancier</h3></div></div><div class="inventory-top-grid">${unlinked.map(order => orderCard(order, data.orderLines)).join('')}</div></section>` : ''}`;
  }

  function bindPanel(panel) {
    panel.querySelector('[data-refresh-inventory]')?.addEventListener('click', load);
    panel.querySelectorAll('[data-receive-order]').forEach(button => button.addEventListener('click', receiveOrder));
    panel.querySelectorAll('.tool-replace form').forEach(form => form.addEventListener('submit', replaceTool));
    panel.querySelectorAll('[data-adjust-stock]').forEach(form => form.addEventListener('submit', adjustStock));
    panel.querySelectorAll('[data-update-minimum]').forEach(form => form.addEventListener('submit', updateMinimum));
    panel.querySelectorAll('[data-supplier-form]').forEach(form => form.addEventListener('submit', saveSupplier));
    panel.querySelectorAll('[data-invoice-form]').forEach(form => form.addEventListener('submit', saveInvoice));
    panel.querySelectorAll('[data-mark-paid]').forEach(button => button.addEventListener('click', markInvoicePaid));
  }

  function render(raw, panel, selectedView) {
    if (selectedView === 'creditors' || selectedView === 'debtors') panel.innerHTML = renderAccounting(raw, selectedView === 'creditors' ? 'purchase' : 'sales');
    else { const data = normalize(raw); panel.innerHTML = selectedView === 'suppliers' ? renderSuppliers(data) : renderInventory(data); }
    bindPanel(panel);
  }

  async function load() {
    if (!client || !target || loading) return;
    const panel = target, selectedView = view, activeClient = client;
    loading = true;
    panel.setAttribute('aria-busy', 'true');
    const accounting = selectedView === 'creditors' || selectedView === 'debtors', label = selectedView === 'suppliers' ? 'Leveranciers' : selectedView === 'creditors' ? 'Crediteuren' : selectedView === 'debtors' ? 'Debiteuren' : 'Voorraad en kosten';
    panel.innerHTML = `<div class="inventory-loading"><i></i><b>${label} laden…</b></div>`;
    try { const result = accounting ? await Promise.all([activeClient('/api/admin/accounting/overview'),activeClient('/api/admin/inventory/overview')]).then(([accountingData,inventoryData]) => ({...accountingData,suppliers:inventoryData.suppliers || [],orders:inventoryData.orders || []})) : await activeClient('/api/admin/inventory/overview'); if (panel === target && selectedView === view && activeClient === client) render(result, panel, selectedView); }
    catch (error) { if (panel === target && selectedView === view) { panel.innerHTML = `<div class="inventory-error" role="alert"><b>${label} konden niet worden geladen</b><p>${escape(error.message)}</p><button class="btn btn-dark" type="button">Opnieuw proberen</button></div>`; panel.querySelector('button').onclick = load; } }
    finally { loading = false; panel.removeAttribute('aria-busy'); if (panel !== target && target && !target.childElementCount) load(); }
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

  async function adjustStock(event) {
    event.preventDefault();
    const form = event.currentTarget, row = form.closest('[data-item-sku]'), sku = row?.dataset.itemSku || '', status = form.querySelector('[role=status]'), values = Object.fromEntries(new FormData(form));
    const delta = Number(String(values.delta || '').replace(',', '.')), note = String(values.note || '').trim();
    if (!sku || !Number.isFinite(delta) || delta === 0) { status.textContent = 'Vul een correctie in die niet nul is.'; return; }
    if (note.length < 3) { status.textContent = 'Noteer kort waarom je de voorraad corrigeert.'; return; }
    const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Voorraadcorrectie opslaan…';
    try { await client(`/api/admin/inventory/items/${encodeURIComponent(sku)}/adjust`, {method:'POST', body:JSON.stringify({delta,note})}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  async function updateMinimum(event) {
    event.preventDefault();
    const form = event.currentTarget, row = form.closest('[data-item-sku]'), sku = row?.dataset.itemSku || '', status = form.querySelector('[role=status]'), minimumStock = Number(String(new FormData(form).get('minimumStock') || '').replace(',', '.'));
    if (!sku || !Number.isFinite(minimumStock) || minimumStock < 0) { status.textContent = 'Vul een geldige minimumvoorraad in.'; return; }
    const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Minimumvoorraad opslaan…';
    try { await client(`/api/admin/inventory/items/${encodeURIComponent(sku)}`, {method:'PATCH', body:JSON.stringify({minimumStock})}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  async function saveSupplier(event) {
    event.preventDefault();
    const form = event.currentTarget, id = form.dataset.supplierId || '', mode = form.dataset.supplierForm, status = form.querySelector('[role=status]'), values = Object.fromEntries(new FormData(form));
    values.name = String(values.name || '').trim();
    if (!values.name) { status.textContent = 'Vul de bedrijfsnaam in.'; return; }
    const button = form.querySelector('button'); button.disabled = true; status.textContent = mode === 'create' ? 'Leverancier toevoegen…' : 'Wijzigingen opslaan…';
    const path = mode === 'create' ? '/api/admin/inventory/suppliers' : `/api/admin/inventory/suppliers/${encodeURIComponent(id)}`;
    try { await client(path, {method:mode === 'create' ? 'POST' : 'PATCH', body:JSON.stringify(values)}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  async function saveInvoice(event) {
    event.preventDefault();
    const form = event.currentTarget, type = form.dataset.invoiceForm, id = form.dataset.invoiceId || '', mode = form.dataset.invoiceMode, status = form.querySelector('[role=status]'), values = Object.fromEntries(new FormData(form));
    for (const name of ['amountExcl','vatAmount','totalAmount']) values[name] = Number(String(values[name] || '0').replace(',', '.'));
    if (!values.invoiceNumber || !values.invoiceDate || !values.dueDate || !Number.isFinite(values.totalAmount) || values.totalAmount < 0) { status.textContent = 'Controleer factuurnummer, datums en bedragen.'; return; }
    const group = type === 'purchase' ? 'purchase-invoices' : 'sales-invoices', path = mode === 'create' ? `/api/admin/accounting/${group}` : `/api/admin/accounting/${group}/${encodeURIComponent(id)}`;
    const button = form.querySelector('button'); button.disabled = true; status.textContent = mode === 'create' ? 'Factuur toevoegen…' : 'Wijzigingen opslaan…';
    try { await client(path, {method:mode === 'create' ? 'POST' : 'PATCH', body:JSON.stringify(values)}); await load(); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  }

  async function markInvoicePaid(event) {
    const button = event.currentTarget, card = button.closest('[data-invoice-id]'), id = card?.dataset.invoiceId || '', type = card?.dataset.invoiceType, group = type === 'purchase' ? 'purchase-invoices' : 'sales-invoices';
    if (!id || !confirm('Bevestig dat deze factuur volledig is betaald.')) return;
    button.disabled = true; button.textContent = 'Betaling verwerken…';
    try { await client(`/api/admin/accounting/${group}/${encodeURIComponent(id)}/mark-paid`, {method:'POST', body:'{}'}); await load(); }
    catch (error) { button.disabled = false; button.textContent = error.message; }
  }

  window.LattenspecialistInventory = {
    open(api, panel, selectedView = 'inventory') { client = api; target = panel; view = ['inventory','suppliers','creditors','debtors'].includes(selectedView) ? selectedView : 'inventory'; load(); },
    clear() { client = null; target = null; loading = false; view = 'inventory'; }
  };
})();
