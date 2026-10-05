// Keep links already shared with customers and installed apps working.
(() => {
  const goToBooking = () => {
    const current = new URL(window.location.href);
    if (current.hash !== '#afspraak' && current.searchParams.get('app') !== 'klant') return;
    const destination = new URL('afspraak.html', current);
    destination.search = current.search;
    destination.hash = current.hash;
    window.location.replace(destination.href);
  };
  goToBooking();
  window.addEventListener('hashchange', goToBooking);
})();
