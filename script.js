const nav = document.querySelector('.site-nav');
const toggle = document.querySelector('.menu-toggle');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

document.getElementById('year').textContent = new Date().getFullYear();

const euro = new Intl.NumberFormat('nl-NL', {style:'currency', currency:'EUR'});
const grid = document.getElementById('price-grid');

fetch('data/prijzen.json')
  .then(r => r.json())
  .then(prices => {
    grid.innerHTML = prices.map(p => `
      <article class="price-card ${p.popular ? 'popular' : ''}">
        <div class="tag">${p.tag}</div>
        <h3>${p.naam}</h3>
        <div class="price ${p.prijs == null ? 'placeholder' : ''}">${p.prijs == null ? 'Prijs nog invullen' : euro.format(p.prijs)}</div>
        <ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
        <div class="mini">${p.notitie}</div>
      </article>
    `).join('');
  })
  .catch(() => {
    grid.innerHTML = '<article class="price-card"><h3>Prijslijst</h3><p>De prijslijst kon niet worden geladen. Open de site via een webserver of GitHub Pages.</p></article>';
  });
