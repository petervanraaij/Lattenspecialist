(() => {
  const cards = [...document.querySelectorAll('#pakketten .package-card')];
  const action = document.querySelector('#packageRequest');
  const message = document.querySelector('#packageSelection');
  if (!action || !message) return;
  const requestLinks = [...document.querySelectorAll('a[href="afspraak.html"]')];
  const update = () => {
    const selectedCard = cards.find(card => card.querySelector('input[name="homepagePackage"]')?.checked);
    const selected = selectedCard?.querySelector('input[name="homepagePackage"]');
    cards.forEach(card => {
      card.classList.toggle('is-selected', card === selectedCard);
      if (card !== selectedCard) {
        card.querySelector('select[name="homepageWax"]').value = 'beta';
        card.querySelector('input[name="homepageUrgent"]').checked = false;
      }
    });
    const wax = selectedCard?.querySelector('select[name="homepageWax"]');
    const waxQuery = wax && wax.value !== 'beta' ? `&wax=${encodeURIComponent(wax.value)}` : '';
    const urgent = selectedCard?.querySelector('input[name="homepageUrgent"]').checked;
    const href = selected ? `afspraak.html?pakket=${encodeURIComponent(selected.value)}${waxQuery}${urgent ? '&spoed=1' : ''}` : 'afspraak.html';
    requestLinks.forEach(link => { link.href = href; });
    message.hidden = !selected;
    message.textContent = selected ? `Gekozen: ${selected.value} · ${wax.selectedOptions[0].textContent}${urgent ? ' · Spoedonderhoud + € 10,00 (indien mogelijk, in overleg)' : ''}. Je keuze staat alvast in het aanvraagformulier.` : '';
  };
  cards.forEach(card => {
    card.addEventListener('change', event => {
      if (event.target.name === 'homepageWax' || event.target.name === 'homepageUrgent') {
        card.querySelector('input[name="homepagePackage"]').checked = true;
      }
      update();
    });
    card.addEventListener('click', event => {
      if (event.target.closest('a, button, input, select, option, label, details')) return;
      const input = card.querySelector('input[name="homepagePackage"]');
      if (input) { input.checked = true; input.focus({preventScroll: true}); update(); }
    });
  });
  window.addEventListener('pageshow', update);
  update();
})();
