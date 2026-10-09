import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const [html,code] = await Promise.all([
  readFile(new URL('../../index.html',import.meta.url),'utf8'),
  readFile(new URL('../../snow-temperature.js',import.meta.url),'utf8')
]);
const turn = () => new Promise(resolve => setTimeout(resolve,20));
const row = (temperature,snowDepth,time='2026-10-09T12:00') => ({
  current:{time,temperature_2m:temperature,snow_depth:snowDepth},
  daily:{temperature_2m_min:[-9,-7],temperature_2m_max:[1,3],snowfall_sum:[1.2,2.3]}
});

test('live snow estimate renders resorts, snow state and matching wax advice',async t => {
  const dom = new JSDOM(html,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const {window:w}=dom,d=w.document;
  w.setInterval=()=>1;
  w.fetch=async url => {
    assert.match(String(url),/temperature_2m%2Csnow_depth/);
    assert.match(String(url),/temperature_2m_min%2Ctemperature_2m_max%2Csnowfall_sum/);
    assert.match(String(url),/forecast_days=14/);
    assert.match(String(url),/elevation=2850%2C2500%2C2300%2C2500%2C2700%2C2900%2C800/);
    return {ok:true,json:async()=>[row(-5,.18),row(-13,.35),row(-18,.6),row(4,0),row(-2,.2),row(-9,.5),row(2,0)]};
  };
  w.eval(code);await turn();
  const tabs=[...d.querySelectorAll('.snow-resort-tab')];
  assert.equal(tabs.length,7);
  const selectedCard=()=>d.querySelector('#snowResortPanel .snow-resort-card');
  assert.match(selectedCard().textContent,/Sölden/);assert.match(selectedCard().textContent,/≈ -5,0 °C/);assert.match(selectedCard().textContent,/Performance Purple/);assert.match(selectedCard().textContent,/BetaMix Red/);
  assert.match(selectedCard().textContent,/Verwachting komende 14 dagen/);assert.match(selectedCard().textContent,/3,5 cm nieuwe sneeuw verwacht/);
  assert.equal(selectedCard().querySelector('.snow-resort-wax-link').getAttribute('href'),'#pakketten');
  tabs[1].click();assert.match(selectedCard().textContent,/Ischgl/);assert.match(selectedCard().textContent,/BetaMix Red/);assert.doesNotMatch(selectedCard().textContent,/Performance Purple/);
  tabs[2].click();assert.match(selectedCard().textContent,/Gerlos/);assert.match(selectedCard().textContent,/UltraMix Blue/);
  tabs[3].click();assert.match(selectedCard().textContent,/Geen sneeuwdek in model/);assert.match(selectedCard().textContent,/Lucht 4,0 °C/);assert.match(selectedCard().textContent,/Nog niet te bepalen/);
  tabs[4].click();assert.match(selectedCard().textContent,/AlphaMix Yellow/);assert.match(selectedCard().textContent,/Performance Purple/);
  tabs[6].click();assert.match(selectedCard().textContent,/Winterberg/);
  assert.equal(tabs[6].getAttribute('aria-selected'),'true');
  assert.match(d.querySelector('#snowLiveStatus').textContent,/bijgewerkt om 12:00 uur/);
  assert.equal(d.querySelector('#snowResortGrid').getAttribute('aria-busy'),'false');
});

test('live snow estimate fails clearly without inventing temperatures',async t => {
  const dom = new JSDOM(html,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const {window:w}=dom,d=w.document;
  w.setInterval=()=>1;w.fetch=async()=>{throw new Error('offline');};
  w.eval(code);await turn();
  assert.match(d.querySelector('#snowResortGrid').textContent,/tijdelijk niet beschikbaar/);
  assert.match(d.querySelector('#snowLiveStatus').textContent,/probeer de live condities later opnieuw/);
  assert.doesNotMatch(d.querySelector('#snowLive').textContent,/≈/);
});

test('wax guide, indoor slopes and customer destination search stay in one temperature panel',async t => {
  const dom = new JSDOM(html,{url:'https://lattenspecialist.nl/',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const {window:w}=dom,d=w.document;
  w.setInterval=()=>1;
  w.fetch=async url => {
    const request=new URL(String(url));
    if(request.hostname==='geocoding-api.open-meteo.com') return {ok:true,json:async()=>({results:[{name:'Saalbach',admin1:'Salzburg',country:'Oostenrijk',latitude:47.39,longitude:12.64,elevation:1003}]})};
    if(request.searchParams.get('latitude')?.includes(',')) return {ok:true,json:async()=>Array.from({length:7},()=>row(-6,.2))};
    return {ok:true,json:async()=>row(-7,.3)};
  };
  w.eval(code);await turn();
  assert.equal(d.querySelectorAll('#snowLive .wax-card').length,4);
  assert.equal(d.querySelectorAll('.snow-resort-tab').length,7);
  assert.equal(d.querySelectorAll('#snowResortPanel .snow-resort-card').length,1);
  assert.equal(d.querySelectorAll('.snow-indoor-summary').length,1);
  assert.match(d.querySelector('.snow-indoor-summary').textContent,/Landgraaf/);
  assert.match(d.querySelector('.snow-indoor-summary').textContent,/Bottrop/);
  assert.match(d.querySelector('.snow-indoor-summary').textContent,/-4 °C tot -5 °C/);
  d.querySelector('#snowSearchInput').value='Saalbach';
  d.querySelector('#snowSearchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await turn();await turn();
  const result=d.querySelector('#snowSearchResult');
  assert.equal(result.hidden,false);
  assert.match(result.textContent,/Saalbach/);
  assert.match(result.textContent,/≈ -7,0 °C/);
  assert.match(result.textContent,/Performance Purple/);
  assert.match(result.textContent,/Verwachting komende 14 dagen/);
});
