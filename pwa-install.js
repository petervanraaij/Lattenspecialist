(() => {
  const card = document.getElementById('installCard');
  const button = document.getElementById('installApp');
  const feedback = document.getElementById('installFeedback');
  const help = document.getElementById('installHelp');
  if (!card || !button) return;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let pendingPrompt = null;
  let installed = false;
  const isInstalled = () => installed || standalone.matches || navigator.standalone === true;
  const refresh = () => {
    card.hidden = isInstalled();
    button.hidden = !pendingPrompt || isInstalled();
  };
  window.addEventListener('beforeinstallprompt', event => {
    if (!window.isSecureContext) return;
    event.preventDefault();
    pendingPrompt = event;
    refresh();
  });
  button.addEventListener('click', async () => {
    if (!pendingPrompt || !window.isSecureContext) return;
    const prompt = pendingPrompt;
    pendingPrompt = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      feedback.textContent = choice.outcome === 'accepted'
        ? 'Je telefoon rondt de installatie af. Daarna vind je Mijn Lattenspecialist tussen je apps.'
        : 'Je kunt de app hier blijven gebruiken en later installeren via het browsermenu.';
    } catch {
      feedback.textContent = 'Gebruik de stappen hieronder om de app aan je beginscherm toe te voegen.';
      help.open = true;
    }
    refresh();
  });
  window.addEventListener('appinstalled', () => { installed = true; pendingPrompt = null; refresh(); });
  standalone.addEventListener?.('change', refresh);
  refresh();
  if (location.hash === '#installeren' && !isInstalled()) {
    help.open = true;
    card.scrollIntoView({block:'start'});
  }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {
      feedback.textContent = 'Installeren is nu niet beschikbaar. Je kunt de app wel in je browser gebruiken.';
    });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, {once:true});
  }
})();
