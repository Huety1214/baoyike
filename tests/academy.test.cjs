const assert = require('node:assert/strict');
const { test } = require('node:test');
const E = require('../dist/academy-engine.js');
const newGame = (id = 'engineer') => E.create(id, E.roles.find(r => r.id === id).priorities, '先看家庭與現金流');
const finishRound = g => { if (g.pending.quiz) E.answer(g, g.pending.quiz.correct); E.next(g); };

test('medical claim obeys per-event cap, before-event purchase lock and no retroactive cover', () => {
  const g = newGame(); E.setPolicy(g, 'health', 1); E.roll(g, 3, 'hospital');
  assert.equal(g.pending.actual.claim, 80000); assert.equal(g.pending.actual.outOfPocket, 20000);
  assert.equal(g.pending.baseline.claim, 0); assert.equal(g.pending.actual.paid, 18000);
  assert.equal(g.pending.actual.after.net - g.pending.baseline.after.net, 62000);
  assert.throws(() => E.setPolicy(g, 'health', 2));
  finishRound(g); E.setPolicy(g, 'health', 2); E.roll(g, 1, 'hospital');
  assert.equal(g.pending.actual.claim, 100000); // indemnity cannot exceed actual medical costs
});

test('outpatient illness and accident distinguish illness, accident and hospitalization', () => {
  const g = newGame(); E.setPolicy(g, 'health', 2); E.setPolicy(g, 'accident', 1);
  E.roll(g, 1, 'outpatient'); assert.equal(g.pending.actual.claim, 0);
  finishRound(g); E.roll(g, 1, 'accident'); assert.equal(g.pending.actual.claim, 50000);
  finishRound(g); E.roll(g, 1, 'disability'); assert.equal(g.pending.actual.claim, 300000);
  assert.equal(g.client.income, 840000);
});

test('paying mortgage principal reduces debt without destroying net worth', () => {
  const g = newGame(), initial = E.net(g.client); E.roll(g, 1, 'review');
  assert.equal(g.pending.actual.interest, 72000); assert.equal(g.pending.actual.principal, 108000);
  assert.equal(g.client.debt, 3492000);
  assert.equal(E.net(g.client), initial + 1200000 - 600000 - 72000);
});

test('investment and annuity contributions remain assets after explicit fees', () => {
  const g = newGame(), initial = E.net(g.client); E.setPolicy(g, 'investment', 1); E.setPolicy(g, 'annuity', 1);
  E.roll(g, 1, 'review');
  assert.equal(g.client.investAccount, 27324); assert.equal(g.client.annuityAccount, 23755);
  assert.equal(g.client.fees, 3156); // 2400 investment + 480 annuity + 276 account fee
  assert.equal(E.net(g.client), initial + 1200000 - 600000 - 72000 - 3156 + 235);
  assert.equal(g.client.premiumsPaid, 54000); // contributions are not all counted as expenses
});

test('market moves existing investments and investment account but not fixed annuity', () => {
  const g = newGame(); E.setPolicy(g, 'investment', 1); E.setPolicy(g, 'annuity', 1); E.roll(g, 2, 'bear');
  assert.equal(g.client.investments, 320000); assert.equal(g.client.investAccount, Math.round(27324 * .8));
  assert.equal(g.client.annuityAccount, 23755); assert.equal(g.pending.actual.claim, 0);
});

test('death payout removes investment account to prevent counting it twice', () => {
  const g = newGame(); E.setPolicy(g, 'investment', 1); E.setPolicy(g, 'life', 1); E.setPolicy(g, 'accident', 1);
  E.roll(g, 1, 'death');
  assert.equal(g.pending.actual.claim, 4500000); // existing 0.5M + term 3M + investment max(1M, account)
  assert.equal(g.client.investAccount, 0); assert.equal(g.client.alive, false);
  assert.equal(g.pending.baseline.claim, 500000); assert.equal(E.premium(g.client), 0);
  assert.equal(E.retirement(g.client).annual, 0);
  const previous = g.client.cash; finishRound(g); E.roll(g, 1, 'review');
  assert.equal(g.pending.actual.income, 0); assert.ok(g.client.cash < previous);
});

test('reducing long-term policy returns proportional balance minus exactly one fee', () => {
  const g = newGame(); E.setPolicy(g, 'investment', 2); E.roll(g, 1, 'review'); finishRound(g);
  const cash = g.client.cash, value = g.client.investAccount, feeBefore = g.client.fees;
  E.setPolicy(g, 'investment', 1);
  const withdrawal = Math.round(value / 2), fee = Math.round(withdrawal * .05);
  assert.equal(g.client.cash, cash + withdrawal - fee); assert.equal(g.client.investAccount, value - withdrawal);
  assert.equal(g.client.fees, feeBefore + fee);
});

test('shortfall liquidates ordinary assets before explicit emergency debt; cash never goes negative', () => {
  const g = newGame('technician'); g.client.cash = 0; g.client.investments = 10000; g.client.income = 0;
  E.roll(g, 1, 'hospital'); assert.equal(g.client.cash, 0); assert.equal(g.client.investments, 0);
  assert.ok(g.client.shortfall > 0); assert.equal(g.client.insolvent, true); assert.ok(g.client.debt > 200000);
  assert.ok(Number.isFinite(E.net(g.client)));
});

test('baseline keeps unspent premiums as cash through identical events', () => {
  const g = newGame(); E.setPolicy(g, 'life', 1); E.roll(g, 1, 'review');
  assert.equal(g.pending.baseline.after.net - g.pending.actual.after.net, 12000);
  finishRound(g); E.roll(g, 1, 'review');
  assert.equal(g.pending.baseline.after.net - g.pending.actual.after.net, 24000);
});

test('landing category and independent card draw apply even on the first roll', t => {
  const rng = t.mock.method(Math, 'random', () => 0);
  for (const role of E.roles) {
    const deck = E.deckFor(role.id);
    for (const category of Object.keys(E.categories)) {
      assert.ok(deck.filter(card => card.category === category).length >= 2);
    }
    const first = newGame(role.id), second = newGame(role.id);
    rng.mock.mockImplementation(() => 0);
    const a = E.roll(first, 2).event;
    rng.mock.mockImplementation(() => 0.999);
    const b = E.roll(second, 2).event;
    assert.equal(a.category, 'market');
    assert.equal(b.category, a.category);
    assert.notEqual(a.id, b.id);
    assert.ok(deck.some(card => card.id === a.id));
    E.next(first);
    assert.notEqual(E.roll(first, 4).event.id, a.id);
  }
});

test('all choices survive saves and optional quizzes do not block the final report', () => {
  const selected = Object.keys(E.judgments);
  const g = E.create('teacher', ['retirement', 'medical'], selected);
  for (let round = 1; round <= 6; round++) {
    E.roll(g, 4);
    E.next(g);
  }
  assert.equal(g.phase, 'report');
  assert.equal(g.completed, true);
  assert.throws(() => E.roll(g, 1));
  const saved = JSON.parse(JSON.stringify(g));
  assert.ok(E.validSave(saved));
  assert.deepEqual(saved.initialJudgments, selected);
  assert.deepEqual(saved.selectedPriorities, ['retirement', 'medical']);
});

test('risk preview matches the settlement without charging the client', () => {
  const g = newGame(); E.setPolicy(g, 'health', 1);
  const before = JSON.stringify(g);
  assert.equal(E.claimEstimate(g.client, 'hospital', 100000), 80000);
  assert.equal(E.claimEstimate(g.client, 'accident', 60000), 0);
  assert.equal(JSON.stringify(g), before);
});

test('pre-update household saves can land on every category and finish', () => {
  const g = newGame(); E.roll(g, 1, 'death'); finishRound(g);
  delete g.initialJudgments;
  assert.ok(E.validSave(g));
  for (let i = 0; i < 5; i++) {
    const r = E.roll(g, 1);
    assert.equal(r.event.category, E.tileCategory(g.position));
    assert.equal(r.actual.income, 0);
    E.next(g);
  }
  assert.equal(g.phase, 'report');
});

test('same decisions and answers receive same scores despite different event luck', () => {
  const a = newGame(), b = newGame();
  for (const g of [a,b]) { E.setPolicy(g,'life',2); E.setPolicy(g,'health',1); E.setPolicy(g,'annuity',1); }
  for (let i=0;i<6;i++) { E.roll(a,1,'hospital'); E.roll(b,1,'review'); finishRound(a); finishRound(b); }
  assert.notEqual(E.net(a.client), E.net(b.client)); assert.equal(E.score(a).total,E.score(b).total);
  assert.deepEqual(E.score(a).items,E.score(b).items);
});

test('retirement projection is nonmutating, follows contribution fees, and cannot double-count account', () => {
  const g = newGame('teacher'); g.client.age = 64; g.client.annuityAccount = 100000;
  const before = JSON.stringify(g), projection = E.retirement(g.client, 1);
  assert.equal(projection.account, Math.round((100000+23520)*1.01));
  assert.equal(projection.annuity, Math.round(projection.account / 18));
  assert.equal(projection.annual, g.client.pension+projection.annuity); assert.equal(JSON.stringify(g),before);
  g.client.age=65; assert.equal(E.retirement(g.client,1).years,0);
});

test('wrong phase, invalid units, invalid answers and duplicate answers are rejected', () => {
  const g = newGame(); assert.throws(()=>E.answer(g,1)); assert.throws(()=>E.next(g));
  for (const n of [-1,4,NaN,1.5]) assert.throws(()=>E.setPolicy(g,'life',n));
  assert.throws(()=>E.roll(g,0)); E.roll(g,1,'hospital'); assert.throws(()=>E.answer(g,4)); E.answer(g,0);
  assert.throws(()=>E.answer(g,0)); assert.throws(()=>E.roll(g,1)); E.next(g); assert.equal(g.phase,'planning');
});

test('all four roles complete a six-round learning journey with stable serializable saves', () => {
  for(const role of E.roles) {
    let g = newGame(role.id);
    E.setPolicy(g,'health',1); E.setPolicy(g,'life',1); E.setPolicy(g,'accident',1);
    for(let i=0;i<6;i++) { E.roll(g,i+1); assert.ok(E.validSave(g)); g=JSON.parse(JSON.stringify(g));finishRound(g);assert.ok(E.validSave(g)); }
    assert.ok(E.score(g).total>=0 && E.score(g).total<=100);
    assert.ok(Number.isFinite(E.net(g.client))); assert.equal(g.records.length,6);
  }
  assert.equal(E.validSave(null),false); assert.equal(E.validSave({version:0}),false);
});

test('round chart uses actual ledger checkpoints and a common existing policy', () => {
  const g=newGame(); E.setPolicy(g,'health',1);
  const r=E.roll(g,1,'hospital');
  assert.deepEqual([r.actual.before.cash,r.actual.beforeEventCash,r.actual.after.cash],[600000,1002000,982000]);
  assert.deepEqual([r.baseline.before.cash,r.baseline.beforeEventCash,r.baseline.after.cash],[600000,1020000,920000]);
  assert.equal(r.actual.after.cash-r.baseline.after.cash,62000);
});

test('fixed assessment remains unassessed until all three answers; neutral events have no quiz', () => {
  const g=newGame();
  for(let i=0;i<6;i++) { assert.equal(E.roll(g,1,'review').quiz,null); E.next(g); }
  E.recordAssessment(g,'limit',0);
  assert.equal(E.score(g).max,80); assert.equal(E.score(g).items[3].score,null);
  assert.throws(()=>E.recordAssessment(g,'limit',1));
  E.recordAssessment(g,'cash',1); E.recordAssessment(g,'scope',2);
  assert.equal(E.score(g).max,100); assert.equal(E.score(g).items[3].score,20);
});

test('legacy comparison replays the same events including existing death benefits', () => {
  const g=newGame(); delete g.comparisonVersion; g.baseline.existingLife=0;
  E.roll(g,1,'death'); const actualCash=g.client.cash;
  E.upgradeSave(g);
  assert.equal(g.pending.baseline.claim,500000); assert.equal(g.client.cash,actualCash);
  const state=JSON.stringify(g); E.upgradeSave(g); assert.equal(JSON.stringify(g),state);
});

test('coach accepts only evidence from the corresponding group and keeps source markers', () => {
  const C=require('../dist/coach.js'), g=newGame();
  E.setPolicy(g,'health',1); E.roll(g,1,'hospital');
  const pool=C.candidates(g,true);
  const reply=Object.fromEntries(Object.entries(pool).map(([k,v])=>[k,v.slice(0,1).map(f=>({evidenceId:f.id,insight:'核對家庭承擔的支出。'}))]));
  assert.equal(C.fromModel(pool,reply,'final').mode,'llm'); assert.equal(C.rules(pool,'final').mode,'rules');
  reply.risks[0].evidenceId='7-made-up'; assert.throws(()=>C.fromModel(pool,reply,'final'));
});
