(() => {
  let offered=false;
  window.LATTEN_WAXSTICK={offer(form,continueBooking){
    const field=form.elements.waxstickCount;
    if(offered||!field||Number(field.value)>0||typeof HTMLDialogElement==='undefined'||typeof HTMLDialogElement.prototype.showModal!=='function')return false;
    offered=true;
    const previous=document.activeElement;
    const dialog=document.createElement('dialog');
    dialog.className='waxstick-dialog';
    dialog.setAttribute('aria-labelledby','waxstickOfferTitle');
    dialog.innerHTML=`<button type="button" class="waxstick-close" aria-label="Verder zonder waxstick">×</button><div class="waxstick-offer-grid"><img src="images/holmenkol-natural-skiwax-stick.png" alt="Holmenkol Natural Skiwax Stick 50 gram" width="1254" height="1254"><div><p class="waxstick-eyebrow">Handig voor onderweg · 50 g</p><h2 id="waxstickOfferTitle">Elke skidag even bijwerken?</h2><p>Met de Holmenkol Natural Skiwax Stick werk je het glijvlak van je ski’s of snowboard na een skidag eenvoudig bij. Dun aanbrengen en uitwrijven met de kurk, zonder waxijzer.</p><p>Zo houd je het glijvlak tussendoor verzorgd en heb je langer plezier van je waxbeurt. Een handige aanvulling op je warme waxbeurt.</p><p class="waxstick-offer-price">€ 17,50 <small>per stuk · inclusief btw</small></p><p>Bestel hem mee en neem hem mee bij het ophalen van je materiaal.</p><div class="waxstick-offer-actions"><button type="button" class="btn btn-gold" data-add-stick>Ja, voeg 1 waxstick toe · € 17,50</button><button type="button" class="btn btn-dark" data-skip-stick>Verder zonder waxstick</button></div></div></div>`;
    let finished=false;
    const finish=add=>{
      if(finished)return;
      finished=true;
      if(add){field.value=String(Math.min(20,Number(field.value||0)+1));field.dispatchEvent(new Event('input',{bubbles:true}));}
      dialog.close();dialog.remove();previous?.focus();continueBooking();
    };
    dialog.querySelector('[data-add-stick]').addEventListener('click',()=>finish(true));
    dialog.querySelector('[data-skip-stick]').addEventListener('click',()=>finish(false));
    dialog.querySelector('.waxstick-close').addEventListener('click',()=>finish(false));
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    document.body.append(dialog);dialog.showModal();
    return true;
  }};
})();
