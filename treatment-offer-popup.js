(() => {
 const dialog=document.getElementById('packageInfoDialog');if(!dialog||!window.LSTreatmentOverview)return;
 let trigger=null;
 const open=(key,button)=>{
  const card=document.querySelector(`[data-offer-card="${key}"]`);if(!card)return;trigger=button;
  document.getElementById('packageInfoTitle').textContent=window.LATTEN_SELECTION.packages[key]+' · '+card.querySelector('h3').textContent;
  document.getElementById('packageInfoIntro').textContent=card.querySelector('p').textContent;
  const prices=document.getElementById('packageInfoPrices');prices.replaceChildren(card.querySelector('.price-row').cloneNode(true));
  document.getElementById('packageInfoBody').innerHTML=window.LSTreatmentOverview.render(window.LSTreatmentOverview.offer(key),{open:true,extraHeading:'Mogelijke extra’s · niet standaard inbegrepen',publicOffer:true});
  document.getElementById('packageInfoChoose').href='onderhoud-kiezen.html#'+card.id;
  dialog.querySelector('.package-info-content').scrollTop=0;dialog.showModal();
 };
 document.querySelectorAll('[data-offer-open]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.offerOpen,button)));
 dialog.querySelector('.package-info-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>trigger?.focus({preventScroll:true}));
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
})();
