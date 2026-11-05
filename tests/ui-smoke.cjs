/* Headless smoke test for dist/academy.js — renders setup, plays a full game, renders report. */
const path = require('path');
const ROOT = '/home/thinkpad_t460/Projects/baoyike/dist';

function fakeEl() {
  return new Proxy({ open: false, scrollTop: 0, textContent: '' }, {
    get(t, k) { if (k in t) return t[k]; return () => {}; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

const elCache = {};
const clickHandlers = [];
let html = '';

global.window = { scrollTo: () => {}, addEventListener: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.matchMedia = () => ({ matches: true });
global.document = {
  querySelector: sel => (elCache[sel] ||= fakeEl()),
  addEventListener: (type, fn) => { if (type === 'click') clickHandlers.push(fn); },
  createElement: () => fakeEl()
};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
global.Blob = class { constructor() {} };

window.Academy = require(path.join(ROOT, 'academy-engine.js'));
const E = window.Academy;
window.LifeCoach = require(path.join(ROOT, 'coach.js'));
require(path.join(ROOT, 'academy.js'));

// Capture innerHTML writes into the #app container.
Object.defineProperty(elCache['#app'] ||= fakeEl(), 'innerHTML', {
  get: () => html, set: v => { html = v; }, configurable: true
});
function click(action, extra = {}) {
  for (const fn of clickHandlers) fn({ target: { closest: () => ({ dataset: { action, ...extra }, disabled: false }) } });
}
function modalHtml() { return elCache['#modal-content'].innerHTML || ''; }
async function click(action, extra = {}) {
  for (const fn of clickHandlers) await fn({ target: { closest: () => ({ dataset: { action, ...extra }, disabled: false }) } });
  await new Promise(r => setTimeout(r, 0));
}
function container(sel) { return html.includes(sel); }

let failed = [];
(async () => {
const ok = [];
// 1. Setup screen renders with hero + role cards, no analysis panel or start button.
await click('game'); // no game in memory yet -> re-renders setup screen into our capture
ok.push(['setup hero', container('規劃一段人生')]);
ok.push(['setup steps', container('選擇客戶與優先需求')]);
ok.push(['no analysis panel', !container('priority-choice') && !container('analysis-panel')]);
ok.push(['no start banner', !container('還在進行中')]);
ok.push(['no start button', !container('開始遊戲')]);

// 2. Guide dialog (mock-guide layout).
await click('guide');
ok.push(['guide cards', modalHtml().includes('guide-steps')]);
ok.push(['guide steps', modalHtml().includes('認識客戶') && modalHtml().includes('結算復盤')]);
await click('close');

// 3. Click role -> straight into game board.
await click('role', { id: 'engineer' });
ok.push(['game board', container('人生棋盤')]);
ok.push(['board token', container('board-token')]);
ok.push(['round pips', container('round-pips')]);
ok.push(['no demo note', !container('示範局')]);
ok.push(['demo save gone', !container('觀看示範局')]);

// 4. Play all 6 rounds.
for (let i = 0; i < 6; i++) {
  await click('roll');
  if (modalHtml().includes('quiz-option')) await click('answer', { index: 1 });
  await click('next');
}
ok.push(['report reached', container('YOUR LEARNING JOURNEY')]);
ok.push(['story line', container('story-line')]);
ok.push(['radar chart', container('class="radar"')]);
ok.push(['coach at top', html.indexOf('決策復盤') < html.indexOf('歷年期末現金')]);
ok.push(['assessment panel', container('契約理解評量')]);

// 5. Restart returns to setup without resume banner.
await click('restart');
ok.push(['back to setup', container('選擇客戶')]);
ok.push(['no resume banner', !container('還在進行中')]);

const failed = ok.filter(([name, pass]) => !pass);
console.log(ok.map(([n, p]) => (p ? 'PASS' : 'FAIL') + '  ' + n).join('\n'));
if (failed.length) { process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
})();
