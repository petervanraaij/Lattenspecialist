import {requestCleaningCounts} from './maintenance-options.js';

// New requests only. Existing reservation snapshots are never repriced.
export function maintenancePriceQuote(selection,extras={}){
 if(!selection)return null;
 const value=typeof selection==='string'?JSON.parse(selection):selection;
 const prices={brons:[1995,2495],slijpen:[2495,2495],zilver:[3495,3995],goud:[4245,4745],platinum:[4995,5495]};
 const storagePrices={storageSki:750,storageSnowboard:1000};
 let cents=0;
 for(const [id,p]of Object.entries(value.p)){
  cents+=p.s*prices[id][0]+p.b*prices[id][1];
  if(['alpha','ultra','performance'].includes(p.w))cents+=p.s*500+p.b*750;
  if(p.f&&!['goud','platinum'].includes(id))cents+=(p.s+p.b)*750;
  if(p.u)cents+=1000;
  cents+=(p.d||0)*750+(p.r||0)*750;
 }
 const cleaning=requestCleaningCounts(value,extras);
 cents+=cleaning.ski*250+cleaning.snowboard*500+Number(extras.waxstickCount||0)*1750;
 for(const[id,item]of Object.entries(value.e))if(Object.hasOwn(storagePrices,id))cents+=item.q*storagePrices[id];
 if(value.u&&Object.keys(value.e).length)cents+=1000;
 return{version:'2026-11-03-material-wax-storage',currency:'EUR',knownTotalCents:cents,includesVat:true,requiresConfirmation:true,needsAssessment:Object.keys(value.e).some(id=>!Object.hasOwn(storagePrices,id))||Object.values(value.p).some(p=>p.r>0)};
}
