(() => {
  // No cookies, local storage, query strings, form values or visitor identifiers.
  if (window.self !== window.top || navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (!['https://lattenspecialist.nl','https://www.lattenspecialist.nl'].includes(location.origin)) return;
  const endpoint = String(window.LATTENSPECIALIST_BOOKING?.endpoint || '').replace(/\/$/, '');
  if (!endpoint) return;
  const sent = new Set();
  const count = event => {
    if (sent.has(event)) return;
    sent.add(event);
    fetch(`${endpoint}/api/metrics`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({event}), credentials:'omit', referrerPolicy:'no-referrer', keepalive:true}).catch(() => {});
  };
  const packages = document.querySelector('#pakketten .package-grid');
  if (packages && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { count('packages_viewed'); observer.disconnect(); }
    }, {threshold:0.1});
    observer.observe(packages);
  }
  const form = document.querySelector('#requestForm');
  if (form) {
    count('form_opened');
    const start = event => { if (event.isTrusted && event.target.matches('input:not([name="website"]), select, textarea')) count('form_started'); };
    form.addEventListener('input', start);
    form.addEventListener('change', start);
    window.addEventListener('lattenspecialist:booking-submitted', () => count('booking_submitted'));
  }
})();
