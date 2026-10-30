// New requests only. Existing reservation snapshots are never repriced.
export function maintenancePriceQuote(selection,extras={}){
 if(!selection)return null;
 const value=typeof selection==='string'?JSON.parse(selection):selection;
 const prices={brons:[1995,2495],slijpen:[2495,2995],zilver:[3495,3995],goud:[4495,4995],platinum:[5250,5750]};
 let cents=0,cleaning=0;
 for(const [id,p]of Object.entries(value.p)){
  cents+=p.s*prices[id][0]+p.b*prices[id][1];
  if(['alpha','ultra'].includes(p.w))cents+=(p.s+p.b)*250;
  if(p.w==='performance')cents+=p.s*500+p.b*750;
  if(p.u)cents+=1000;
  cents+=(p.d||0)*750+(p.r||0)*750+(p.c||0)*500;cleaning+=p.c||0;
 }
 cents+=Math.max(0,Number(extras.firstWaxCount||0)-cleaning)*500+Number(extras.waxstickCount||0)*1750;
 if(value.u&&Object.keys(value.e).length)cents+=1000;
 return{version:'2026-10-30-wax',currency:'EUR',knownTotalCents:cents,includesVat:true,requiresConfirmation:true,needsAssessment:Object.keys(value.e).length>0||Object.values(value.p).some(p=>p.r>0)};
}
