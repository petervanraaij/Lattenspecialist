import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const routing=await readFile(new URL('../../homepage.js',import.meta.url),'utf8');
function visit(href) {
  const redirects=[],events={};
  const location={href,replace:url=>redirects.push(url)};
  runInNewContext(routing,{URL,window:{location,addEventListener:(name,fn)=>events[name]=fn}});
  return {location,redirects,events};
}

test('links already shared with customers reach the request page and retain query values',()=>{
  const {redirects}=visit('https://lattenspecialist.nl/?source=kaart#afspraak');
  assert.deepEqual(redirects,['https://lattenspecialist.nl/afspraak.html?source=kaart#afspraak']);
});

test('installed customer apps can keep using their existing embedded booking URL',()=>{
  const {redirects}=visit('https://lattenspecialist.nl/?app=klant');
  assert.deepEqual(redirects,['https://lattenspecialist.nl/afspraak.html?app=klant']);
});

test('normal browsing stays on the homepage, while a later legacy anchor still works',()=>{
  const session=visit('https://lattenspecialist.nl/#pakketten');
  assert.deepEqual(session.redirects,[]);
  session.location.href='https://lattenspecialist.nl/#afspraak';
  session.events.hashchange();
  assert.deepEqual(session.redirects,['https://lattenspecialist.nl/afspraak.html#afspraak']);
});

test('existing encoded selections redirect to the dedicated selector without losing the choice',()=>{const value=encodeURIComponent(JSON.stringify({p:{zilver:{s:2,b:0,w:'beta'}}}));const {redirects}=visit('https://lattenspecialist.nl/?keuze='+value+'#pakketten');assert.deepEqual(redirects,['https://lattenspecialist.nl/onderhoud-kiezen.html?keuze='+value+'#pakketten']);});
