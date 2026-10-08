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
  const requestLinks = [...document.querySelectorAll('a[href="afspraak.html"]')];
  let valid = true;
  const amount = (element,name) => Number(element.querySelector(`[name="${name}"]`).value);
  function read() {
    const value = model.empty();
    cards.forEach(card => { value.p[card.dataset.package] = {s:amount(card,'homepageSki'),b:amount(card,'homepageSnowboard'),w:card.querySelector('[name="homepageWax"]').value,u:card.querySelector('[name="homepageUrgent"]').checked}; });
    extras.forEach(extra => { value.e[extra.dataset.extra] = {q:amount(extra,'extraAmount'),m:extra.querySelector('[name="extraMaterial"]').value}; });
    value.u = urgentExtras.checked;
    return model.normalize(value);
  }
  function restore(value) {
    cards.forEach(card => {
      const item = value.p[card.dataset.package] || {s:0,b:0,w:'beta',u:false};
      card.querySelector('[name="homepageSki"]').value = item.s;
      card.querySelector('[name="homepageSnowboard"]').value = item.b;
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
    section.querySelectorAll('.quantity-control').forEach(control => {
      const value = Number(control.querySelector('input').value);
      control.querySelector('[data-step="-1"]').disabled = value <= 0;
      control.querySelector('[data-step="1"]').disabled = value >= 20;
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
  section.addEventListener('click',event => {
    const button = event.target.closest('button[data-step]');
    if (!button) return;
    const input = button.closest('.quantity-control').querySelector('input');
    input.value = Math.max(0,Math.min(20,Math.trunc(Number(input.value) || 0) + Number(button.dataset.step)));
    update();
  });
  section.addEventListener('input',event => { if (event.target.type === 'number') update(); });
  section.addEventListener('change',event => {
    const card = event.target.closest('[data-package]');
    if (card && ['homepageWax','homepageUrgent'].includes(event.target.name) && !amount(card,'homepageSki') && !amount(card,'homepageSnowboard')) {
      if (event.target.name === 'homepageWax' || event.target.checked) card.querySelector('[name="homepageSki"]').value = 1;
    }
    update();
  });
  requestLinks.forEach(link => link.addEventListener('click',event => { if (!valid) { event.preventDefault(); message.scrollIntoView({block:'center'}); } }));
  const saved = model.parse(new URLSearchParams(location.search).get('keuze'));
  if (saved) restore(saved);
  window.addEventListener('pageshow',update);
  update();
})();
