(() => {
  const model = window.LATTEN_SELECTION;
  const section = document.querySelector('#pakketten');
  if (!model || !section) return;
  const cards = [...section.querySelectorAll('[data-package]')];
  const extras = [...section.querySelectorAll('[data-extra]')];
  const message = document.querySelector('#packageSelection');
  const list = document.querySelector('#selectionItems');
  const emptyMessage = document.querySelector('#selectionEmpty');
  const urgentExtras = document.querySelector('#extrasUrgent');
  const bindingsDialog = document.querySelector('#bindingsDialog');
  const bindingsYes = document.querySelector('#bindingsYes');
  const snowboardCounts = new WeakMap();
  let pendingBindings = null;
  const requestLinks = [...document.querySelectorAll('a[href="afspraak.html"]')];
  let valid = true;
  const amount = (element,name) => Number(element.querySelector(`[name="${name}"]`).value);
  function read() {
    const value = model.empty();
    cards.forEach(card => { value.p[card.dataset.package] = {s:amount(card,'homepageSki'),b:amount(card,'homepageSnowboard'),d:amount(card,'homepageBindings'),w:card.querySelector('[name="homepageWax"]').value,u:card.querySelector('[name="homepageUrgent"]').checked}; });
    extras.forEach(extra => { value.e[extra.dataset.extra] = {q:amount(extra,'extraAmount'),m:extra.querySelector('[name="extraMaterial"]').value}; });
    value.u = urgentExtras.checked;
    return model.normalize(value);
  }
  function restore(value) {
    cards.forEach(card => {
      const item = value.p[card.dataset.package] || {s:0,b:0,w:'beta',u:false};
      card.querySelector('[name="homepageSki"]').value = item.s;
      card.querySelector('[name="homepageSnowboard"]').value = item.b;
      card.querySelector('[name="homepageBindings"]').value = item.d || 0;
      card.querySelector('[name="homepageWax"]').value = item.w;
      card.querySelector('[name="homepageUrgent"]').checked = item.u;
    });
    extras.forEach(extra => {
      const item = value.e[extra.dataset.extra];
      extra.querySelector('[name="extraAmount"]').value = item?.q || 0;
      if (item) extra.querySelector('[name="extraMaterial"]').value = item.m;
    });
    urgentExtras.checked = value.u;
  }
  function update() {
    cards.forEach(card => {
      const snowboards = amount(card,'homepageSnowboard');
      const bindings = card.querySelector('[name="homepageBindings"]');
      if (Number.isInteger(snowboards) && snowboards >= 0) {
        bindings.max = Math.min(20,snowboards);
        bindings.value = Math.min(Number(bindings.value),Number(bindings.max));
      }
      card.querySelector('.package-bindings').hidden = !(snowboards > 0);
      const count = Number(bindings.value);
      card.querySelector('.package-bindings-price').textContent = count > 0
        ? `${count}× € 7,50 = ${model.bindingPrice(count)} extra in dit pakket`
        : 'Optioneel · € 7,50 per snowboard';
    });
    section.querySelectorAll('.quantity-control').forEach(control => {
      const input = control.querySelector('input');
      const value = Number(input.value);
      control.querySelector('[data-step="-1"]').disabled = value <= 0;
      control.querySelector('[data-step="1"]').disabled = value >= Number(input.max);
    });
    const hasExtras = extras.some(extra => amount(extra,'extraAmount') > 0);
    urgentExtras.disabled = !hasExtras;
    if (!hasExtras) urgentExtras.checked = false;
    cards.forEach(card => {
      card.classList.toggle('is-selected',amount(card,'homepageSki') + amount(card,'homepageSnowboard') > 0);
      card.querySelector('.package-wax-price').textContent = card.querySelector('[name="homepageWax"]').value === 'performance' ? '+ € 7,50 per paar / snowboard' : 'Inbegrepen';
    });
    const value = read();
    valid = !!value;
    list.replaceChildren();
    if (value) model.describe(value).forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
    const selected = value && model.hasItems(value);
    emptyMessage.hidden = !!selected || !valid;
    message.hidden = !selected && valid;
    message.textContent = !valid ? 'Kies hele aantallen van 0 t/m 20, met maximaal 20 paar ski’s of snowboards in de pakketten samen.' : selected ? 'Je volledige keuze gaat mee naar het aanvraagformulier.' : '';
    const href = !valid ? '#pakketten' : selected ? `afspraak.html?keuze=${encodeURIComponent(JSON.stringify(value))}` : 'afspraak.html';
    requestLinks.forEach(link => { link.href = href; if (valid) link.removeAttribute('aria-disabled'); else link.setAttribute('aria-disabled','true'); });
  }
  function askAboutBindings(input, previous) {
    const next = Number(input.value);
    snowboardCounts.set(input,next);
    const added = next - previous;
    if (!valid || !Number.isInteger(added) || added <= 0) return;
    const card = input.closest('[data-package]');
    pendingBindings = {card,added};
    const name = model.packages[card.dataset.package];
    document.querySelector('#bindingsQuestion').textContent = added === 1
      ? `Wil je dat wij de bindingen van dit extra snowboard bij ${name} demonteren en weer monteren?`
      : `Wil je dat wij de bindingen van deze ${added} extra snowboards bij ${name} demonteren en weer monteren?`;
    const price = model.bindingPrice(added);
    document.querySelector('#bindingsPrice').textContent = `${price} extra${added > 1 ? ' · € 7,50 per snowboard' : ' voor dit snowboard'}`;
    const existing = document.querySelector('#bindingsExisting');
    existing.hidden = false;
    existing.textContent = `We voegen dit toe aan pakket ${name}. Je kunt het aantal daar aanpassen.`;
    bindingsYes.disabled = false;
    bindingsDialog.showModal();
  }
  bindingsYes.addEventListener('click',() => {
    if (!pendingBindings || bindingsYes.disabled) return;
    const {card,added} = pendingBindings;
    const input = card.querySelector('[name="homepageBindings"]');
    input.value = Math.min(amount(card,'homepageSnowboard'),Number(input.value) + added);
    pendingBindings = null;
    update();
    bindingsDialog.close();
  });
  document.querySelector('#bindingsNo').addEventListener('click',() => { pendingBindings = null; bindingsDialog.close(); });
  bindingsDialog.addEventListener('cancel',() => { pendingBindings = null; });
  bindingsDialog.addEventListener('close',() => { pendingBindings = null; });
  section.addEventListener('click',event => {
    const button = event.target.closest('button[data-step]');
    if (!button) return;
    const input = button.closest('.quantity-control').querySelector('input');
    const previous = Number(input.value);
    input.value = Math.max(0,Math.min(Number(input.max),Math.trunc(Number(input.value) || 0) + Number(button.dataset.step)));
    update();
    if (input.name === 'homepageSnowboard') askAboutBindings(input,previous);
  });
  section.addEventListener('input',event => { if (event.target.type === 'number') update(); });
  section.addEventListener('change',event => {
    const card = event.target.closest('[data-package]');
    if (card && ['homepageWax','homepageUrgent'].includes(event.target.name) && !amount(card,'homepageSki') && !amount(card,'homepageSnowboard')) {
      if (event.target.name === 'homepageWax' || event.target.checked) card.querySelector('[name="homepageSki"]').value = 1;
    }
    update();
    if (event.target.name === 'homepageSnowboard') askAboutBindings(event.target,snowboardCounts.get(event.target) || 0);
  });
  requestLinks.forEach(link => link.addEventListener('click',event => { if (!valid) { event.preventDefault(); message.scrollIntoView({block:'center'}); } }));
  const saved = model.parse(new URLSearchParams(location.search).get('keuze'));
  if (saved) restore(saved);
  cards.forEach(card => { const input = card.querySelector('[name="homepageSnowboard"]'); snowboardCounts.set(input,Number(input.value)); });
  window.addEventListener('pageshow',update);
  update();
})();
