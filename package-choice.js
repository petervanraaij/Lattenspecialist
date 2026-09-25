(() => {
  const cards = [...document.querySelectorAll('#pakketten .package-card')];
  const action = document.querySelector('#packageRequest');
  const message = document.querySelector('#packageSelection');
  if (!action || !message) return;
  const update = () => {
    const selected = cards.map(card => card.querySelector('input[name="homepagePackage"]')).find(input => input?.checked);
    cards.forEach(card => card.classList.toggle('is-selected', Boolean(card.querySelector('input:checked'))));
    action.href = selected ? `afspraak.html?pakket=${encodeURIComponent(selected.value)}` : 'afspraak.html';
    message.hidden = !selected;
    message.textContent = selected ? `Gekozen: ${selected.value}. Je keuze staat alvast in het aanvraagformulier.` : '';
  };
  cards.forEach(card => {
    card.addEventListener('change', update);
    card.addEventListener('click', event => {
      if (event.target.closest('a, button, input, label, details')) return;
      const input = card.querySelector('input[name="homepagePackage"]');
      if (input) { input.checked = true; input.focus({preventScroll: true}); update(); }
    });
  });
  window.addEventListener('pageshow', update);
  update();
})();
