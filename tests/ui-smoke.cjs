/* Headless smoke test for dist/academy.js — renders setup, plays a full game, renders report. */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');

function fakeEl() {
  return new Proxy({ open: false, scrollTop: 0, textContent: '', classList: { add: () => {}, remove: () => {}, toggle: () => {} } }, {
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
require(path.join(ROOT, 'academy-demo.js'));
window.LifeCoach = require(path.join(ROOT, 'coach.js'));
require(path.join(ROOT, 'academy.js'));

// Capture innerHTML writes into the #app container.
Object.defineProperty(elCache['#app'] ||= fakeEl(), 'innerHTML', {
  get: () => html, set: v => { html = v; }, configurable: true
});
function click(action, extra = {}) {
  for (const fn of clickHandlers) fn({ target: { closest: () => ({ dataset: { action, ...extra }, disabled: false }) } });
}
function toolbarHtml() { return elCache['#game-toolbar'].innerHTML || ''; }
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
ok.push(['setup toolbar hidden', elCache['#game-toolbar'].hidden && toolbarHtml() === '']);

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
ok.push(['journal is toolbar button', toolbarHtml().includes('data-action="journal"') && !container('journal-panel')]);
ok.push(['planning in shared header', toolbarHtml().includes('data-action="planning"') && !container('play-toolbar')]);
ok.push(['game toolbar visible with client', !elCache['#game-toolbar'].hidden && toolbarHtml().includes('data-action="client"') && toolbarHtml().includes('林先生')]);
ok.push(['board token', container('board-token')]);
ok.push(['round pips', container('round-pips')]);
ok.push(['no demo note', !container('示範局')]);
ok.push(['demo save gone', !container('觀看示範局')]);
ok.push(['no english headings', !/>(THE JOURNEY|RISK CHECK|YOUR LEARNING|MID-GAME|FIXED STRESS|ROUND )</.test(html + modalHtml())]);

// 3b. AI coach lives in the planning dialog's left panel, not on the board; terms dialogs carry the plain-language template.
await click('planning');
ok.push(['coach in planning modal', modalHtml().includes('plan-coach') && modalHtml().includes('data-coach')]);
ok.push(['plan grid two columns', modalHtml().includes('plan-grid')]);
await click('terms', { id: 'health' });
ok.push(['terms plain template', modalHtml().includes('AI 白話解釋') && modalHtml().includes('生活例子')]);
await click('planning');
ok.push(['board has no coach panel', !container('本回合風險提示')]);
ok.push(['no stage review entry', !container('查看階段回顧')]);
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
ok.push(['report toolbar cleared', elCache['#game-toolbar'].hidden && toolbarHtml() === '']);
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
ok.push(['restart toolbar cleared', elCache['#game-toolbar'].hidden && toolbarHtml() === '']);
ok.push(['no resume banner', !container('還在進行中')]);
await click('role', { id: 'doctor' });
ok.push(['intro popup again', modalHtml().includes('開局分析')]);
ok.push(['intro selections reset', /data-action="intro-confirm" disabled/.test(modalHtml()) && !modalHtml().includes('priority-choice selected')]);
await click('intro-evidence', { id: 'income' });
await click('intro-priority', { id: 'retirement' });
await click('intro-priority', { id: 'medical' });
await click('intro-confirm');
ok.push(['new game starts', container('人生棋盤')]);

// 6. Isolated demo sessions exercise the actual view handlers and engine together.
async function demoSession(search) {
  const vm = require('node:vm'), fs = require('node:fs');
  const elements = {}, handlers = [], rolls = [];
  let current, exported, randomCalls = 0;
  const context = vm.createContext({
    window: { location: { search }, scrollTo() {}, addEventListener() {},
      Academy: { ...E,
        create(...args) { current = E.create(...args); return current; },
        roll(...args) { const r = E.roll(...args); rolls.push(r); return r; }
      }, LifeCoach: window.LifeCoach },
    document: { body: { classList: { toggle() {} } },
      querySelector: sel => (elements[sel] ||= fakeEl()),
      addEventListener(type, fn) { if (type === 'click') handlers.push(fn); },
      createElement: () => fakeEl() },
    URLSearchParams, Uint32Array, AbortController, console,
    crypto: { getRandomValues(bytes) { randomCalls++; bytes[0] = 2; } },
    matchMedia: () => ({ matches: true }), setTimeout, clearTimeout,
    URL: { createObjectURL: () => 'blob:demo', revokeObjectURL() {} },
    Blob: class { constructor(parts) { exported = JSON.parse(parts.join('')); } }
  });
  for (const file of ['academy-demo.js', 'academy.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context);
  const act = async (action, extra = {}) => {
    for (const fn of handlers) await fn({ target: { closest: () => ({ dataset: { action, ...extra }, disabled: false }) } });
  };
  const intro = async () => {
    await act('intro-evidence', { id: 'dependents' });
    await act('intro-priority', { id: 'liquidity' });
    await act('intro-priority', { id: 'accident' });
    await act('intro-confirm');
  };
  return { act, intro, elements, rolls, game: () => current, exported: () => exported, randomCalls: () => randomCalls };
}
const d = await demoSession('?demo=technician');
const plain = await demoSession('');
ok.push(['demo starts at identical home page', !d.game() && d.elements['#app'].innerHTML === plain.elements['#app'].innerHTML]);
await d.act('role', { id: 'technician' });
await plain.act('role', { id: 'technician' });
ok.push(['demo uses identical locked analysis', d.game().roleId === 'technician' && d.elements['#modal-content'].innerHTML === plain.elements['#modal-content'].innerHTML && !d.elements['#modal-content'].innerHTML.includes('data-action="close"')]);
await d.intro(); await plain.intro();
ok.push(['demo uses identical board and toolbar', d.elements['#app'].innerHTML === plain.elements['#app'].innerHTML && d.elements['#game-toolbar'].innerHTML === plain.elements['#game-toolbar'].innerHTML]);
const noInternalHints = session => !/固定情境示範|錄影|重新開始示範|指定演練|demo-banner|demo-story|demo-intro/.test(session.elements['#app'].innerHTML + session.elements['#modal-content'].innerHTML);
async function playDemo(session, insured) {
  if (insured) for (const id of ['health', 'accident']) await session.act('policy', { id, delta: '1' });
  await session.act('close');
  for (let i = 0; i < 6; i++) {
    await session.act('roll');
    ok.push(['demo event has normal labels ' + i, noInternalHints(session)]);
    await session.act('next');
  }
}
await playDemo(d, true);
const first = JSON.stringify(d.game().records);
const ids = ['review', 'disability', 'outpatient', 'layoff', 'raise', 'hospital'].map(id => 'technician-' + id);
ok.push(['demo fixed events', JSON.stringify(d.game().records.map(r => r.event.id)) === JSON.stringify(ids)]);
ok.push(['demo dice match board categories', JSON.stringify(d.game().records.map(r => r.die)) === '[3,2,2,1,4,1]' && d.game().records.every(r => E.tileCategory(r.position) === r.event.category)]);
ok.push(['demo bypasses random dice', d.randomCalls() === 0]);
ok.push(['demo engine outcomes', JSON.stringify(d.game().records.map(r => r.actual.after.cash)) === '[456000,572000,562000,340810,400810,521290]' && d.game().records[1].actual.claim === 300000]);
ok.push(['demo report uses normal actions', d.game().completed && noInternalHints(d) && d.elements['#app'].innerHTML.includes('學習報告') && d.elements['#app'].innerHTML.includes('再練習一種人生 →')]);
await d.act('journal');
ok.push(['demo journal uses normal labels', noInternalHints(d) && d.elements['#modal-content'].innerHTML.includes('設備維修事故')]);
await d.act('history', { round: '2' });
ok.push(['demo history uses normal labels', noInternalHints(d) && d.elements['#modal-content'].innerHTML.includes('風險事件')]);
await d.act('close');
await d.act('export');
ok.push(['demo export metadata', d.exported().demonstration.id === 'technician' && d.exported().demonstration.version === 1 && d.exported().records.every(r => r.teaching)]);
await d.act('restart');
ok.push(['demo restart returns to home', d.elements['#app'].innerHTML.includes('選擇客戶') && d.elements['#game-toolbar'].hidden]);
await d.act('role', { id: 'technician' });
ok.push(['demo reselect clears state and requires analysis', d.game().round === 0 && d.game().records.length === 0 && d.game().client.policies.health === 0 && d.elements['#modal-content'].innerHTML.includes('data-action="intro-confirm" disabled')]);
await d.intro(); await playDemo(d, true);
ok.push(['demo replay is deterministic', JSON.stringify(d.game().records) === first]);
await d.act('restart'); await d.act('role', { id: 'technician' }); await d.intro(); await playDemo(d, false);
ok.push(['demo manual policies change outcomes, not events', d.game().records[1].actual.claim === 0 && JSON.stringify(d.game().records.map(r => r.event.id)) === JSON.stringify(ids) && d.game().records.every(r => r.actual.after.cash === r.baseline.after.cash)]);
// Restart must not reset the game underneath the asynchronous dice animation.
await d.act('restart'); await d.act('role', { id: 'technician' }); await d.intro();
const rollingDemo = d.act('roll'); await d.act('restart'); await rollingDemo;
ok.push(['demo restart guarded while rolling', d.game().round === 1 && d.game().phase === 'event']);
await d.act('next'); await d.act('restart');
ok.push(['demo mid-game restart returns home', d.elements['#app'].innerHTML.includes('選擇客戶') && d.elements['#game-toolbar'].hidden]);
await d.act('role', { id: 'engineer' });
await d.intro(); await d.act('roll');
ok.push(['other home roles stay selectable and random', d.game().roleId === 'engineer' && !d.game().demonstration && !d.game().records[0].teaching && d.randomCalls() === 1]);
for (const search of ['', '?demo=unknown']) {
  const normal = await demoSession(search);
  ok.push(['normal setup for ' + (search || 'no parameter'), !normal.game() && normal.elements['#app'].innerHTML.includes('選擇客戶') && !normal.elements['#app'].innerHTML.includes('固定情境示範')]);
  await normal.act('role', { id: 'technician' }); await normal.intro(); await normal.act('roll');
  ok.push(['normal roll remains random ' + search, normal.randomCalls() === 1 && !normal.game().records[0].teaching && !normal.game().demonstration]);
}

const failed = ok.filter(([name, pass]) => !pass);
console.log(ok.map(([n, p]) => (p ? 'PASS' : 'FAIL') + '  ' + n).join('\n'));
if (failed.length) { process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
})();
