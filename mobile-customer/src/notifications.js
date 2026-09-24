// Web Push is deliberately opt-in. Merely opening a personal link never enables it.
export function createNotifications({endpoint, native, getToken, document, navigator, window}) {
  const card = document.getElementById('notificationCard');
  const message = document.getElementById('notificationMessage');
  const enable = document.getElementById('enableNotifications');
  const disable = document.getElementById('disableNotifications');
  const supported = !native && 'Notification' in window && 'PushManager' in window && Boolean(navigator.serviceWorker);
  let config, registration, generation = 0, busy = false;
  const fetchTimed = async (url, options) => {
    const controller = new window.AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try { return await window.fetch(url, {...options,signal:controller.signal}); }
    finally { window.clearTimeout(timer); }
  };
  const api = async (token, body) => {
    const response = await fetchTimed(`${endpoint}/api/customer/push`, {method:'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    if (!response.ok) throw new Error('Meldingen konden niet worden opgeslagen. Probeer het opnieuw.');
    return response.json();
  };
  const state = (text, canEnable = false, canDisable = false) => {
    message.textContent = text; enable.hidden = !canEnable; disable.hidden = !canDisable;
    enable.disabled = disable.disabled = busy;
  };
  const getRegistration = async () => {
    if (registration) return registration;
    // Do not wait forever for a worker in a browser where installation failed.
    registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration?.active) throw new Error('Laad de app opnieuw om meldingen in te stellen.');
    return registration;
  };
  async function refresh() {
    const token = getToken(), version = ++generation;
    card.hidden = !token;
    if (!token || busy) return;
    if (!supported) {
      state(native ? 'Telefoonmeldingen zijn nog niet beschikbaar in deze Android-testapp. Gebruik hiervoor de webapp op je beginscherm.' : 'Op iPhone: open deze app in Safari en kies Deel → Zet op beginscherm. Open de app daarna vanaf je beginscherm om meldingen aan te zetten. Gebruik op andere toestellen een browser die appmeldingen ondersteunt.');
      return;
    }
    state('Meldingen controleren…');
    try {
      const response = await fetchTimed(`${endpoint}/api/push/config`, {cache:'no-store',credentials:'omit'});
      if (!response.ok) throw new Error('Meldingen zijn tijdelijk niet bereikbaar.');
      const settings = await response.json();
      if (version !== generation || token !== getToken()) return;
      config = settings;
      if (!config.configured) return state('Telefoonmeldingen worden nog ingesteld. Je actuele voortgang staat altijd hier.');
      const reg = await getRegistration();
      const subscription = await reg.pushManager.getSubscription();
      const result = subscription ? await api(token, {action:'status',endpoint:subscription.endpoint}) : {subscribed:false};
      if (version !== generation || token !== getToken()) return;
      if (window.Notification.permission === 'denied') return state('Meldingen zijn geblokkeerd. Je kunt ze toestaan via de instellingen van je browser of telefoon.', false, result.subscribed);
      state(result.subscribed ? 'Meldingen staan aan voor dit onderhoud op dit toestel.' : 'Ontvang een melding bij een nieuwe status of betaalverzoek. Je kiest zelf of je dit wilt.', !result.subscribed, result.subscribed);
    } catch (error) { if (version === generation && token === getToken()) state(error.message); }
  }
  enable.addEventListener('click', async () => {
    const token = getToken();
    if (!token || !config?.configured || busy) return;
    // Request permission directly in the user's click, before other asynchronous work.
    const permission = window.Notification.requestPermission();
    busy = true; ++generation; state('Meldingen instellen…');
    try {
      if (await permission !== 'granted') throw new Error('Meldingen staan uit. Je kunt je voortgang hier blijven bekijken.');
      if (token !== getToken()) return;
      const reg = await getRegistration();
      const key = Uint8Array.from(window.atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')), char => char.charCodeAt(0));
      const subscription = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      if (token !== getToken()) return;
      await api(token, {action:'subscribe',subscription:subscription.toJSON()});
      if (token === getToken()) state('Meldingen staan aan voor dit onderhoud op dit toestel.', false, true);
    } catch (error) { if (token === getToken()) state(error.message, true); }
    finally { busy = false; enable.disabled = disable.disabled = false; }
  });
  async function remove(token = getToken()) {
    if (!supported || !token) return true;
    try {
      const reg = await getRegistration();
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) await api(token, {action:'unsubscribe',endpoint:subscription.endpoint});
      // Keep the browser subscription: this device may also follow another order.
      const notifications = await reg.getNotifications?.() || [];
      notifications.filter(item => item.data?.url?.endsWith(`#klant=${token}`)).forEach(item => item.close());
      return true;
    } catch { state('Uitzetten is nog niet gelukt. Controleer je verbinding en probeer opnieuw.',false,true); return false; }
  }
  disable.addEventListener('click', async () => {
    if (busy) return;
    const token = getToken(); busy = true; state('Meldingen uitzetten…');
    const removed = await remove(token);
    busy = false;
    if (removed && token === getToken()) state('Meldingen zijn uitgezet voor dit onderhoud op dit toestel.',true);
    enable.disabled = disable.disabled = false;
  });
  return {refresh, remove, supported};
}
