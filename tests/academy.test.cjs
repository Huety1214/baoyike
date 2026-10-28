const assert = require('node:assert/strict');
const { test } = require('node:test');
const E = require('../dist/academy-engine.js');
const newGame = (id = 'engineer') => E.create(id, E.roles.find(r => r.id === id).priorities, '先看家庭與現金流');
const finishRound = g => { E.answer(g, g.pending.quiz.correct); E.next(g); };

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
  assert.equal(g.pending.baseline.claim, 0); assert.equal(E.premium(g.client), 0);
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

test('mandatory rounds cover medicine, changed responsibility, and market shock', () => {
  const g = newGame(); const actual = [];
  for (let i = 0; i < 6; i++) { E.roll(g, 1); actual.push(g.pending.event.id); finishRound(g); }
  assert.equal(actual[0], 'hospital'); assert.equal(actual[2], 'baby'); assert.equal(actual[4], 'bear');
  assert.equal(g.client.age, 41); assert.equal(g.phase, 'retirement'); assert.equal(g.completed, true);
  assert.throws(() => E.roll(g, 1));
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
  assert.throws(()=>E.roll(g,0)); E.roll(g,1); assert.throws(()=>E.answer(g,4)); E.answer(g,0);
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
