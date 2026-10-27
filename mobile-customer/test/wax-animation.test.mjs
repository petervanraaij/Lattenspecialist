import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const [html, code] = await Promise.all(['index.html', 'wax-illustration.js'].map(name => readFile(new URL('../../' + name, import.meta.url), 'utf8')));

function setup(t, reduced = false) {
  const dom = new JSDOM(html, {runScripts: 'outside-only', pretendToBeVisual: true});
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, tasks = new Map();
  let now = 0, next = 0, intersect, mediaChange, hidden = false;
  Object.defineProperty(w.performance, 'now', {value: () => now});
  Object.defineProperty(d, 'hidden', {get: () => hidden});
  w.setTimeout = (fn, delay) => { tasks.set(++next, {fn, at: now + delay}); return next; };
  w.clearTimeout = id => tasks.delete(id);
  w.matchMedia = () => ({matches: reduced, addEventListener: (_, fn) => { mediaChange = fn; }});
  w.IntersectionObserver = class { constructor(fn) { intersect = fn; } observe() {} };
  w.eval(code);
  function advance(ms) {
    const until = now + ms;
    for (;;) {
      const entry = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > until) break;
      now = entry[1].at; tasks.delete(entry[0]); entry[1].fn();
    }
    now = until;
  }
  return {story: d.querySelector('.wax-storyboard'), playback: d.querySelector('[data-wax-playback]'), d, tasks, advance,
    visible: value => intersect([{isIntersecting: value}]),
    hidden: value => { hidden = value; d.dispatchEvent(new w.Event('visibilitychange')); },
    reduced: value => mediaChange({matches: value})};
}

test('wax playback loops only while visible and preserves its place when paused', t => {
  const a = setup(t);
  assert.equal(a.story.dataset.waxRunning, 'false');
  assert.equal(a.tasks.size, 0);
  a.visible(true); a.advance(4000); a.playback.click(); a.advance(20000);
  assert.equal(a.story.dataset.waxStage, 'glide');
  assert.equal(a.story.dataset.waxRunning, 'false');
  a.playback.click(); a.advance(4999);
  assert.equal(a.story.dataset.waxStage, 'glide');
  a.advance(1); assert.equal(a.story.dataset.waxStage, 'worn');
  a.hidden(true); a.advance(20000); assert.equal(a.story.dataset.waxStage, 'worn');
  a.hidden(false); a.advance(4500); assert.equal(a.story.dataset.waxStage, 'fresh');
  a.visible(false); a.advance(10000); assert.equal(a.story.dataset.waxStage, 'fresh');
  a.visible(true); a.advance(3500); assert.equal(a.story.dataset.waxStage, 'glide');
  assert.equal(a.d.querySelectorAll('[data-wax-select][aria-pressed="true"]').length, 1);
});

test('manual step selection stops playback, and reduced motion requires an explicit play action', t => {
  const a = setup(t, true);
  a.visible(true); a.advance(30000);
  assert.equal(a.story.dataset.waxRunning, 'false');
  assert.equal(a.playback.getAttribute('aria-label'), 'Animatie afspelen');
  a.playback.click(); assert.equal(a.story.dataset.waxRunning, 'true');
  a.d.querySelector('[data-wax-select="worn"]').click();
  assert.equal(a.story.dataset.waxStage, 'worn');
  assert.equal(a.story.dataset.waxRunning, 'false');
  a.advance(30000); assert.equal(a.story.dataset.waxStage, 'worn');
  a.playback.click(); a.reduced(true);
  assert.equal(a.story.dataset.waxRunning, 'false');
  assert.equal(a.tasks.size, 0);
});
