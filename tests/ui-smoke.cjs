/* Headless smoke test for dist/academy.js — renders setup, plays a full game, renders report. */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');

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
  body: { classList: { toggle: () => {} } },
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

// 3. Click role -> intro analysis popup -> straight into game board.
await click('role', { id: 'engineer' });
ok.push(['intro popup', modalHtml().includes('開局分析')]);
ok.push(['intro locked (no close btn)', !modalHtml().includes('data-action="close"')]);
await click('intro-evidence', { id: 'dependents' });
await click('intro-evidence', { id: 'debt' });
await click('intro-priority', { id: 'family' });
await click('intro-priority', { id: 'medical' });
ok.push(['intro confirm enabled', /data-action="intro-confirm"(?![^>]*disabled)/.test(modalHtml())]);
await click('intro-confirm');
ok.push(['game board', container('人生棋盤')]);
ok.push(['left column metrics', container('left-column') && container('年度現金流')]);
ok.push(['right column risk', container('right-column') && container('風險由誰承擔')]);
ok.push(['risk scenarios live', container('失業半年') && container('自付後現金可支應')]);
ok.push(['journal is toolbar button', container('data-action="journal"') && !container('journal-panel')]);
ok.push(['planning centered', container('data-action="planning"')]);
ok.push(['board token', container('board-token')]);
ok.push(['round pips', container('round-pips')]);
ok.push(['no demo note', !container('示範局')]);
ok.push(['demo save gone', !container('觀看示範局')]);
ok.push(['no english headings', !/>(THE JOURNEY|RISK CHECK|YOUR LEARNING|MID-GAME|FIXED STRESS|ROUND )</.test(html + modalHtml())]);

// 3b. AI coach lives in the planning dialog, not on the board.
await click('planning');
ok.push(['coach in planning modal', modalHtml().includes('plan-coach') && modalHtml().includes('data-coach')]);
ok.push(['board has no coach panel', !container('本回合風險提示')]);
await click('close');

// 4. Play all 6 rounds.
for (let i = 0; i < 6; i++) {
  await click('roll');
  if (i === 0) {
    ok.push(['event chart hero first', modalHtml().includes('ledger hero') && modalHtml().indexOf('cash-figure') < modalHtml().indexOf('規劃回饋與帳務明細')]);
    ok.push(['chart floor lines', modalHtml().includes('floor-line planned')]);
    ok.push(['lesson folded', /<details class="lesson">/.test(modalHtml())]);
  }
  if (modalHtml().includes('quiz-option')) await click('answer', { index: 1 });
  await click('next');
}
ok.push(['report reached', container('學習報告')]);
ok.push(['single report title', !container('每一次選擇') && !container('財務的結果，與決策分開看')]);
ok.push(['story line', container('story-line')]);
ok.push(['radar chart', container('class="radar"')]);
ok.push(['coach at top', html.indexOf('決策復盤') < html.indexOf('歷年期末現金')]);
ok.push(['stress promoted', html.indexOf('固定壓力測試') > -1 && html.indexOf('固定壓力測試') < html.indexOf('決策復盤')]);
ok.push(['stress baseline compare', container('stress-alt') && container('不新增投保：')]);
ok.push(['assessment panel', container('契約理解評量')]);

// 5. Restart returns to setup without resume banner, and intro selections reset.
await click('restart');
ok.push(['back to setup', container('選擇客戶')]);
ok.push(['no resume banner', !container('還在進行中')]);
await click('role', { id: 'doctor' });
ok.push(['intro popup again', modalHtml().includes('開局分析')]);
ok.push(['intro selections reset', /data-action="intro-confirm" disabled/.test(modalHtml()) && !modalHtml().includes('priority-choice selected')]);
await click('intro-evidence', { id: 'income' });
await click('intro-priority', { id: 'retirement' });
await click('intro-priority', { id: 'medical' });
await click('intro-confirm');
ok.push(['new game starts', container('人生棋盤')]);

const failed = ok.filter(([name, pass]) => !pass);
console.log(ok.map(([n, p]) => (p ? 'PASS' : 'FAIL') + '  ' + n).join('\n'));
if (failed.length) { process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
})();
