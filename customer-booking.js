// The protected form remains on its verified HTTPS hostname inside the customer app.
(() => {
  if (new URLSearchParams(location.search).get('app') !== 'klant') return;
  document.documentElement.classList.add('customer-booking');
  const appOrigins = new Set([location.origin,'https://localhost','http://localhost','capacitor://localhost']);
  let parentOrigin = null;
  let formReady = false;
  const post = data => { if (parentOrigin && window.parent !== window) window.parent.postMessage(data,parentOrigin); };
  const size = () => post({type:'lattenspecialist:height',height:Math.ceil(document.body.getBoundingClientRect().height)+24});
  function ready() { if(formReady){post({type:'lattenspecialist:ready'});size();} }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !appOrigins.has(event.origin) || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'lattenspecialist:hello') { parentOrigin=event.origin;ready();return; }
    if (event.origin !== parentOrigin || event.data.type !== 'lattenspecialist:prefill' || !formReady) return;
    const values=event.data.values;
    if (!values || typeof values !== 'object') return;
    const form=document.getElementById('requestForm');
    if (['Onderhoud','Verhuur'].includes(values.service)) form.querySelector(`input[name="service"][value="${values.service}"]`).checked=true;
    for (const name of ['package']) {
      const select=form.elements[name];
      if (select && [...select.options].some(option=>option.value===values[name])) select.value=values[name];
    }
    form.dispatchEvent(new Event('change',{bubbles:true}));
    size();
  });
  document.addEventListener('DOMContentLoaded', () => {
    formReady=Boolean(document.getElementById('requestForm'));
    const button=document.querySelector('#requestForm .form-submit');
    if(button)button.textContent='Aanvraag versturen';
    // The form's own script restores its submit label after a request.
    if(button)new MutationObserver(() => {if(button.textContent==='Aanvraag via website versturen')button.textContent='Aanvraag versturen';}).observe(button,{childList:true});
    new ResizeObserver(size).observe(document.body);
    ready();
    document.querySelectorAll('#requestForm a[href="privacy.html"]').forEach(link=>link.addEventListener('click',event=>{
      if(!parentOrigin)return;
      event.preventDefault();post({type:'lattenspecialist:external',url:new URL(link.getAttribute('href'),location.origin).href});
    }));
  });
  window.addEventListener('lattenspecialist:booking-submitted',event=>{
    const reference=event.detail?.reference;
    if(/^LS-\d{4}-[A-Z2-9]{6}$/.test(reference || ''))post({type:'lattenspecialist:booked',reference});
  });
})();
