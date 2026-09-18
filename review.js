const REVIEW_WHATSAPP_NUMBER = '31618327132';
const reviewForm = document.getElementById('reviewForm');

reviewForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!reviewForm.reportValidity()) return;
  const data = new FormData(reviewForm);
  const message = [
    'Hallo De Lattenspecialist,',
    '',
    'Ik wil graag mijn ervaring delen:',
    `Waardering: ${data.get('rating')} van 5`,
    `Ervaring: ${String(data.get('review') || '').trim()}`,
    `Voornaam: ${String(data.get('name') || '').trim() || '-'}`,
    `Woonplaats: ${String(data.get('place') || '').trim() || '-'}`,
    `Toestemming voor publicatie op lattenspecialist.nl: ${data.get('consent') ? 'Ja' : 'Nee'}`
  ].join('\n');
  window.open(`https://wa.me/${REVIEW_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
