(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Academy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const clone = x => JSON.parse(JSON.stringify(x));
  const round = x => Math.round(x);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const roles = [
    { id: 'engineer', name: '林先生', job: '工程師', age: 35, family: '已婚・1 名子女', dependents: 2, income: 1200000, expense: 600000, cash: 600000, investments: 400000, property: 6000000, debt: 3600000, debtService: 180000, existingLife: 500000, pension: 240000, retirementExpense: 480000, priorities: ['family', 'medical'], icon: '⌘', color: 'mint', tagline: '在家庭責任與資產成長之間，找到平衡。' },
    { id: 'doctor', name: '陳醫師', job: '醫師', age: 40, family: '已婚・2 名子女', dependents: 3, income: 2400000, expense: 1200000, cash: 1200000, investments: 800000, property: 12000000, debt: 8000000, debtService: 480000, existingLife: 1000000, pension: 360000, retirementExpense: 840000, priorities: ['family', 'medical'], icon: '✚', color: 'peach', tagline: '高收入，也需要為高家庭責任留好後路。' },
    { id: 'teacher', name: '王老師', job: '教師', age: 50, family: '已婚・子女已獨立', dependents: 1, income: 960000, expense: 480000, cash: 1000000, investments: 600000, property: 6000000, debt: 1000000, debtService: 120000, existingLife: 1000000, pension: 360000, retirementExpense: 480000, priorities: ['retirement', 'medical'], icon: '▤', color: 'lavender', tagline: '穩定的現在，如何接上安心的退休生活？' },
    { id: 'technician', name: '張小姐', job: '技術工作者', age: 30, family: '單身・扶養 1 位家人', dependents: 1, income: 720000, expense: 420000, cash: 240000, investments: 100000, property: 0, debt: 200000, debtService: 60000, existingLife: 0, pension: 180000, retirementExpense: 360000, priorities: ['liquidity', 'accident'], icon: '⚒', color: 'blue', tagline: '每筆預算都有限，先守住最重要的風險。' }
  ];
  const products = [
    { id: 'life', name: '家庭守護', type: '定期壽險', group: '保障規劃', premium: 12000, max: 3, cover: 3000000, icon: '♡', description: '每單位身故保障 300 萬', terms: '僅身故給付；在職收入中斷、失業或失能不在此保單範圍。下一事件前生效。' },
    { id: 'health', name: '安心醫療', type: '健康險', group: '保障規劃', premium: 18000, max: 2, cover: 80000, icon: '✚', description: '每單位住院醫療上限 8 萬', terms: '限本遊戲住院事件，按實際費用給付；每次合計最高 16 萬。門診不給付。不與意外醫療重複填補。' },
    { id: 'accident', name: '意外防線', type: '意外險', group: '保障規劃', premium: 6000, max: 1, cover: 50000, icon: '◇', description: '意外醫療 5 萬・失能 30 萬', terms: '限外來突發事故；意外醫療按實際費用、失能定額 30 萬、意外身故 100 萬。疾病不給付。' },
    { id: 'investment', name: '成長同行', type: '投資型保險', group: '資產與退休', premium: 30000, max: 2, cover: 1000000, icon: '↗', description: '市場連動帳戶・身故保障', terms: '每單位年繳 3 萬；投入費 3%、管理費 600、保障成本 900，帳戶年費 1%。身故給付取保額與帳戶價值較大者，不重複計入資產。解約扣帳戶 5%。' },
    { id: 'annuity', name: '退休長流', type: '年金保險', group: '資產與退休', premium: 24000, max: 3, cover: 0, icon: '◷', description: '65 歲轉換為終身年金', terms: '投入費 2%，累積期每年固定增長 1%（虛構）。65 歲以帳戶÷18 轉成年給付，轉換後帳戶歸零，不再重複列資產；累積期解約扣 5%。' }
  ];
  const events = [
    { id: 'hospital', category: 'risk', title: '一張突如其來的住院單', subtitle: '疾病住院', description: '一場突發疾病需要住院，醫療費用 10 萬元。生活仍要繼續，保障能接住多少？', loss: 100000, kind: 'hospital', icon: '✚' },
    { id: 'accident', category: 'risk', title: '通勤路上的小意外', subtitle: '意外醫療', description: '交通事故造成門診治療支出 6 萬元；本次沒有住院。請分清意外醫療與住院保障。', loss: 60000, kind: 'accident', icon: '◇' },
    { id: 'disability', category: 'risk', title: '工作暫停，生活不能暫停', subtitle: '意外失能', description: '意外失能造成復健及照護費用 50 萬元，接下來每年工作收入減少 30%。', loss: 500000, kind: 'disability', icon: '⚒' },
    { id: 'death', category: 'risk', title: '留給家人的下一段人生', subtitle: '經濟支柱身故', description: '客戶因疾病身故。後續由家屬繼續模擬，工作收入歸零；身故給付列為家屬資源。', loss: 100000, kind: 'death', icon: '♡' },
    { id: 'bear', category: 'market', title: '市場迎來一場逆風', subtitle: '市場下跌 20%', description: '既有投資與投資型保單帳戶下跌 20%。保障與投資的功能，此刻看得更清楚。', market: -.2, icon: '↘' },
    { id: 'bull', category: 'market', title: '耐心遇上好行情', subtitle: '市場上漲 12%', description: '既有投資與投資型保單帳戶上漲 12%。成長不代表保障已足夠，別忘了重新檢視。', market: .12, icon: '↗' },
    { id: 'inflation', category: 'market', title: '同樣的生活，變得更貴', subtitle: '生活費上升 5%', description: '物價上升，往後年度生活費增加 5%，退休生活費目標也同步調高。', inflation: .05, icon: '≋' },
    { id: 'baby', category: 'life', title: '家庭，多了一個牽掛', subtitle: '家庭新增扶養責任', description: '新增一名需扶養的家庭成員，往後年生活費增加 6 萬元。保障需求需要重新計算。', expenseDelta: 60000, dependentsDelta: 1, icon: '✿' },
    { id: 'layoff', category: 'life', title: '留一點，給轉彎的日子', subtitle: '失業六個月', description: '本年度少了六個月工作收入。失業不在本遊戲保單保障範圍，預備金開始發揮作用。', kind: 'layoff', icon: '⌂' },
    { id: 'raise', category: 'life', title: '努力，被看見了', subtitle: '年薪增加 10%', description: '升職帶來往後年收入增加 10%。多出來的預算，可以重新分配給保障或退休。', incomeMultiplier: 1.1, icon: '✧' },
    { id: 'outpatient', category: 'contract', title: '有保單，就一定有理賠？', subtitle: '門診疾病・條款辨識', description: '一般疾病門診花費 1.2 萬元。本遊戲健康險只保障住院，意外險也不涵蓋疾病。', loss: 12000, kind: 'outpatient', icon: '▤' },
    { id: 'review', category: 'contract', title: '停一下，重新看見需求', subtitle: '年度保障檢視', description: '沒有事故發生。檢視保費負擔與家庭責任：沒有領到理賠，不代表保障規劃沒有價值。', icon: '◎' }
  ];
  const categories = { risk: '風險事件', market: '市場事件', life: '人生事件', contract: '契約事件' };
  const priorities = { family: '家庭保障', medical: '醫療風險', liquidity: '緊急預備金', accident: '工作意外', retirement: '退休現金流' };
  const judgments = {
    debt: '先確認還款後，每年還能留多少現金。',
    reserve: '應先預留半年收入中斷時的生活費。',
    care: '家人仰賴這份收入，應先估算扶養支出。',
    treatment: '應先確認醫療費用中需要自付的部分。',
    future: '應先核對退休後的固定收入與生活費。'
  };
  // The contract trigger stays explicit while the story and financial shock belong to the client.
  const roleCards = {
    engineer: [
      ['death', '房貸留給家人', '林先生因疾病身故。家人接手房貸，支付後事費用 10 萬元。'],
      ['hospital', '膽結石手術', '林先生住院開刀，自費病房與手術費共 10 萬元。', { loss: 100000 }],
      ['accident', '接孩子途中摔車', '騎車接孩子時擦撞受傷，意外門診花了 6 萬元。', { loss: 60000 }],
      ['bear', '科技股回檔', '持有的股票與連動帳戶下跌 20%。', { market: -.2 }],
      ['inflation', '家庭伙食漲價', '採買與外食變貴，家庭年生活費及退休支出目標提高 5%。', { inflation: .05 }],
      ['baby', '接父親同住', '家中新增一位扶養對象，每年多支出 6 萬元。', { dependentsDelta: 1, expenseDelta: 60000 }],
      ['raise', '接任研發組長', '帶領新專案後，下一年度起薪資增加 10%。', { incomeMultiplier: 1.1 }],
      ['outpatient', '手腕肌腱炎', '因反覆打字接受疾病門診治療，自費 1.2 萬元。', { loss: 12000 }],
      ['review', '房貸週年盤點', '收到房貸年度對帳單，核對剩餘負債與既有身故保障。']
    ],
    doctor: [
      ['death', '家庭失去主要收入', '陳醫師因疾病身故。家屬支付後事費用 10 萬元，仍須負擔房貸與兩個孩子的生活費。'],
      ['hospital', '急性闌尾炎住院', '陳醫師住院手術，自費醫療共 14 萬元。', { loss: 140000 }],
      ['accident', '夜班後的車禍', '下班途中發生事故，門診處置及後續治療共 7 萬元。', { loss: 70000 }],
      ['bull', '基金部位上漲', '一般投資與連動帳戶本年上漲 9%。', { market: .09 }],
      ['bear', '海外投資回落', '持有的投資與連動帳戶回落 15%。', { market: -.15 }],
      ['baby', '母親搬來同住', '家庭新增一位扶養對象，往後每年照顧支出增加 12 萬元。', { dependentsDelta: 1, expenseDelta: 120000 }],
      ['raise', '增開專科門診', '調整門診時段，下一年度起收入提高 8%。', { incomeMultiplier: 1.08 }],
      ['outpatient', '聲帶發炎回診', '長時間看診後聲帶發炎，自費門診 1.8 萬元。', { loss: 18000 }],
      ['review', '核對家庭保單', '夫妻整理房貸及兩個孩子的開支，核對保單受益安排。']
    ],
    teacher: [
      ['death', '配偶接手家庭帳務', '王老師因疾病身故，家屬支付後事費用 10 萬元，往後以家庭現有資源支應生活。'],
      ['hospital', '膝關節住院手術', '王老師因退化性關節問題住院，醫療支出共 12 萬元。', { loss: 120000 }],
      ['accident', '雨天在校門口跌倒', '在濕滑地面跌傷，意外門診與治療共 3 萬元。', { loss: 30000 }],
      ['inflation', '退休生活預算上修', '日常物價上升，生活費與退休支出目標增加 4%。', { inflation: .04 }],
      ['bear', '退休投資遇到回檔', '投資與連動帳戶本年下跌 8%。', { market: -.08 }],
      ['baby', '開始照顧長輩', '母親搬來同住，增加一位扶養對象，每年多支出 9 萬元。', { dependentsDelta: 1, expenseDelta: 90000 }],
      ['raise', '承接夜間授課', '固定兼課帶來額外收入，下一年度起年收入提高 6%。', { incomeMultiplier: 1.06 }],
      ['outpatient', '喉部疾病門診', '因聲音沙啞定期回診，自費治療 8,000 元。', { loss: 8000 }],
      ['review', '退休前查核年金', '收到年金帳戶明細，核對已投入金額與預計給付方式。']
    ],
    technician: [
      ['death', '扶養者的收入中斷', '張小姐因疾病身故。家人支付後事費用 10 萬元，也失去原本仰賴的工作收入。'],
      ['hospital', '肺炎住院', '張小姐因肺炎住院，自費醫療支出 7 萬元。', { loss: 70000 }],
      ['disability', '設備維修事故', '工作意外造成失能，復健照護花費 40 萬元，往後工作收入減少 30%。', { loss: 400000 }],
      ['inflation', '租金與生活費上漲', '租約更新，生活費與退休支出目標提高 6%。', { inflation: .06 }],
      ['bull', '定期投資回升', '一般投資與連動帳戶上漲 7%。', { market: .07 }],
      ['layoff', '合約之間的空窗', '上一份維修合約結束，半年沒有新案，本年度少了半年工作收入。'],
      ['raise', '取得設備專修資格', '取得新資格後調薪，下一年度起年收入提高 12%。', { incomeMultiplier: 1.12 }],
      ['outpatient', '慢性腰痛回診', '因慢性腰痛接受門診治療，支出 1 萬元，無意外事故或住院。', { loss: 10000 }],
      ['review', '接案前核對保障', '將新案的工作內容與意外險條款逐項核對。']
    ]
  };
  const deckFor = roleId => roleCards[roleId].map(([base, title, description, effects]) => {
    const template = events.find(e => e.id === base);
    return { ...template, ...effects, id: roleId + '-' + base, title, subtitle: title, description };
  });
  const householdEvents = [
    { id: 'family-repair', category: 'life', title: '家中修繕', subtitle: '修繕支出', description: '家屬支付修繕費 3 萬元。', loss: 30000, icon: '⌂' },
    { id: 'family-leak', category: 'risk', title: '漏水損失', subtitle: '財物損壞', description: '家庭財物損壞，支出 2 萬元。', loss: 20000, icon: '◇' },
    ...events.filter(e => ['bear', 'bull', 'review'].includes(e.id))
  ];
  const tileCategory = position => ['life', 'risk', 'market', 'contract'][position % 4];
  function emptyPolicies() { return Object.fromEntries(products.map(p => [p.id, 0])); }
  function premium(s) { return products.reduce((n, p) => n + p.premium * s.policies[p.id], 0); }
  function debtPayment(s) { return Math.min(s.debtService, s.debt * 1.02); }
  function flow(s) { return round((s.alive ? s.income : 0) - s.expense - debtPayment(s) - premium(s)); }
  function net(s) { return round(s.cash + s.investments + s.property + s.investAccount + s.annuityAccount - s.debt); }
  function coverage(s) { return s.alive ? s.existingLife + s.policies.life * 3000000 + Math.max(s.policies.investment * 1000000, s.investAccount) : 0; }
  function need(s) { return s.alive ? round(Math.max(0, s.debt + (s.dependents ? s.expense * 5 : 0))) : 0; }
  function gap(s) { return Math.max(0, need(s) - coverage(s)); }
  function reserveMonths(s) { return Math.max(0, s.cash) / Math.max(1, (s.expense + debtPayment(s) + premium(s)) / 12); }
  function retirement(s, policyOverride) {
    if (!s.alive) return { years: 0, account: 0, annuity: 0, pension: 0, annual: 0, expense: s.retirementExpense, ratio: 0, gap: s.retirementExpense, cumulativeTo90: 0 };
    const n = Math.max(0, 65 - s.age), units = policyOverride == null ? s.policies.annuity : policyOverride;
    let acct = s.annuityAccount;
    for (let i = 0; i < n; i++) acct = round((acct + units * 24000 * .98) * 1.01);
    const annuity = round(acct / 18), total = s.pension + annuity;
    return { years: n, account: acct, annuity, pension: s.pension, annual: total, expense: s.retirementExpense, ratio: total / s.retirementExpense, gap: Math.max(0, s.retirementExpense - total), cumulativeTo90: annuity * 25 };
  }
  function metrics(s) { return { flow: flow(s), net: net(s), gap: gap(s), need: need(s), coverage: coverage(s), reserve: reserveMonths(s), retirement: retirement(s), premium: premium(s) }; }
  function fresh(role) { return { ...clone(role), alive: true, policies: emptyPolicies(), investAccount: 0, annuityAccount: 0, premiumsPaid: 0, protectionCosts: 0, fees: 0, claims: 0, principalPaid: 0, insolvent: false, shortfall: 0 }; }
  function create(roleId, selected = [], initialJudgments = []) {
    const role = roles.find(r => r.id === roleId);
    if (!role) throw new Error('未知角色');
    const baseline = fresh(role); baseline.existingLife = 0;
    return { version: VERSION, roleId, round: 0, phase: 'planning', position: 0, dice: 1, client: fresh(role), baseline, selectedPriorities: [...new Set(selected)].filter(p => p in priorities).slice(0, 2), initialJudgments: [...new Set(Array.isArray(initialJudgments) ? initialJudgments : [])].filter(id => Object.hasOwn(judgments, id)), rationale: typeof initialJudgments === 'string' ? initialJudgments.slice(0, 600) : '', records: [], decisions: [], pending: null, answers: [], initialRole: clone(role), completed: false };
  }
  function setPolicy(game, id, units) {
    if (game.phase !== 'planning') throw new Error('事件與回饋階段已鎖定保單，下一回合才能調整。');
    const p = products.find(p => p.id === id);
    if (!p || !Number.isInteger(units) || units < 0 || units > p.max) throw new Error('無效商品數量');
    const s = game.client, old = s.policies[id], oldFlow = flow(s);
    if (!s.alive) throw new Error('客戶身故後不再新增或調整客戶保單。');
    if (units < old && (id === 'investment' || id === 'annuity')) {
      const key = id === 'investment' ? 'investAccount' : 'annuityAccount';
      const withdrawn = round(s[key] * (old - units) / old), fee = round(withdrawn * .05);
      s[key] -= withdrawn; s.cash += withdrawn - fee; s.fees += fee;
    }
    s.policies[id] = units;
    game.decisions.push({ round: game.round + 1, product: id, from: old, to: units, beforeFlow: oldFlow, afterFlow: flow(s), metrics: metrics(s) });
  }
  function fund(s, amount) {
    s.cash -= round(amount);
    if (s.cash < 0 && s.investments > 0) { const sold = Math.min(s.investments, -s.cash); s.investments -= sold; s.cash += sold; }
    if (s.cash < 0) { s.insolvent = true; s.shortfall += -s.cash; s.debt += -s.cash; s.cash = 0; }
  }
  function payClaim(s, e, loss) {
    let claim = 0, reason = '此事件不符合目前有效保單的給付條件。', policy = '無適用給付';
    if (e.kind === 'hospital') { claim = Math.min(loss, s.policies.health * 80000); policy = '安心醫療'; reason = s.policies.health ? '符合疾病住院，按實際費用與給付上限取低。' : '本次為疾病住院，尚未配置健康險。'; }
    if (e.kind === 'accident') { claim = Math.min(loss, s.policies.accident * 50000); policy = '意外防線'; reason = s.policies.accident ? '符合意外門診，上限 5 萬；沒有住院，不適用安心醫療。' : '意外門診不適用住院醫療險，目前沒有意外醫療保障。'; }
    if (e.kind === 'disability') { claim = s.policies.accident * 300000; policy = '意外防線'; reason = '意外失能定額給付 30 萬；定期壽險不給付失能。'; }
    if (e.kind === 'death') {
      claim = coverage(s); policy = '有效身故保障（含既有壽險）';
      reason = '疾病身故：既有及定期壽險給付；投資型取保額與帳戶較大者，帳戶歸零避免重複計入；意外險不給付。';
      s.investAccount = 0; s.alive = false;
      s.cash += s.annuityAccount; s.annuityAccount = 0; // 本教學契約：累積期身故返還帳戶。
      s.policies = emptyPolicies();
    }
    if (e.kind === 'outpatient') reason = '一般疾病門診未住院，也不是意外：本遊戲健康險及意外險皆不給付。';
    s.claims += claim;
    return { claim, reason, policy };
  }
  function claimEstimate(s, kind, loss) {
    return payClaim(clone(s), { kind }, loss).claim;
  }
  function year(s, e) {
    const before = { cash: s.cash, net: net(s) }, paid = premium(s);
    const income = s.alive ? s.income : 0;
    s.cash += income;
    const interest = round(s.debt * .02), payment = round(debtPayment(s)), principal = Math.min(s.debt, Math.max(0, payment - interest));
    fund(s, s.expense + payment + paid);
    s.debt = Math.max(0, s.debt - principal); s.principalPaid += principal; s.premiumsPaid += paid;
    const protection = s.policies.life * 12000 + s.policies.health * 18000 + s.policies.accident * 6000;
    s.protectionCosts += protection;
    const entry = s.policies.investment * (900 + 600 + 900) + s.policies.annuity * 480;
    s.investAccount += s.policies.investment * (30000 - 2400);
    s.annuityAccount += s.policies.annuity * 23520;
    const accountFee = round(s.investAccount * .01);
    s.investAccount -= accountFee;
    s.annuityAccount = round(s.annuityAccount * 1.01);
    s.fees += entry + accountFee;
    const market = e.market || 0, marketChange = round((s.investments + s.investAccount) * market);
    s.investments = round(s.investments * (1 + market)); s.investAccount = round(s.investAccount * (1 + market));
    let loss = e.loss || 0;
    if (e.kind === 'layoff') loss = round(income * .5);
    const result = payClaim(s, e, loss);
    fund(s, loss - result.claim);
    if (e.kind === 'disability' && s.alive) s.income = round(s.income * .7);
    if (e.inflation) { s.expense = round(s.expense * (1 + e.inflation)); s.retirementExpense = round(s.retirementExpense * (1 + e.inflation)); }
    s.expense += e.expenseDelta || 0; s.dependents += e.dependentsDelta || 0;
    if (e.incomeMultiplier && s.alive) s.income = round(s.income * e.incomeMultiplier);
    s.age++;
    return { before, after: { cash: s.cash, net: net(s) }, income, expense: s.expense, payment, interest, principal, paid, protection, fees: entry + accountFee, marketChange, loss, ...result, outOfPocket: loss - result.claim };
  }
  const quiz = e => e.kind === 'hospital' ? { question: '這次疾病住院，哪一種給付判斷正確？', options: ['壽險因收入受影響而給付', '住院醫療依費用與契約上限給付', '意外險因事件突然發生而給付'], correct: 1, explanation: '疾病住院符合本遊戲健康險；「突然」不代表就是保險契約中的意外。' } : e.kind === 'outpatient' ? { question: '為什麼本次一般疾病門診沒有理賠？', options: ['沒住院、也不是意外，不符合條款', '只要有健康險就應全部給付', '事後加保就能申請這次理賠'], correct: 0, explanation: '先檢查保障範圍與給付條件，不能事後加保追溯事故。' } : e.category === 'market' ? { question: '投資型保單遇到市場下跌，哪個觀念正確？', options: ['有保險名稱就不會虧損', '所有跌幅由健康險補足', '帳戶價值會波動，仍須評估保障與流動性'], correct: 2, explanation: '投資風險與保險保障分別計算；投資型不保證帳戶價值。' } : e.dependentsDelta > 0 ? { question: '新增扶養責任後，應先做什麼？', options: ['重新估算保障缺口與保費負擔', '直接買滿所有商品', '只增加投資型保險'], correct: 0, explanation: '需求改變，先重新分析家庭支出、負債、既有保障與預算。' } : { question: '評估這次規劃，哪個標準最合理？', options: ['理賠領得最多就最高分', '期末資產最高就最高分', '按需求、負擔與固定壓力測試評估'], correct: 2, explanation: '學習表現看決策品質，不靠抽到多少事故；沒有理賠也可以是合理規劃。' };
  function roll(game, die, forcedEvent) {
    if (game.phase !== 'planning' || game.round >= 6) throw new Error('目前無法擲骰');
    if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('骰子必須為 1–6');
    const position = (game.position + die) % 20;
    const category = tileCategory(position);
    let event;
    if (forcedEvent) {
      event = [...deckFor(game.roleId), ...events].find(e => e.id === forcedEvent);
      if (!event) throw new Error('未知事件');
    } else {
      // Existing saves can already be in the surviving household phase.
      const deck = game.client.alive ? deckFor(game.roleId) : householdEvents;
      const cards = deck.filter(e => e.category === category);
      const seen = new Set(game.records.map(r => r.event.id));
      const unseen = cards.filter(e => !seen.has(e.id));
      const pool = unseen.length ? unseen : cards;
      event = pool[Math.floor(Math.random() * pool.length)];
    }
    game.dice = die;
    game.position = position;
    const snapshot = clone(game.client.policies), decisionMetrics = metrics(game.client);
    const actual = year(game.client, event), baseline = year(game.baseline, event);
    game.round++; game.phase = 'event';
    game.pending = { round: game.round, die, position: game.position, event: clone(event), actual, baseline, policies: snapshot, metricsBefore: decisionMetrics, metricsAfter: metrics(game.client), quiz: quiz(event), teaching: Boolean(forcedEvent) };
    game.records.push(clone(game.pending));
    return game.pending;
  }
  function answer(game, index) {
    if (game.phase !== 'event' || !game.pending || game.answers.some(a => a.round === game.round)) throw new Error('本回合已作答或尚未發生事件');
    if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error('無效答案');
    const q = game.pending.quiz, result = { round: game.round, index, correct: index === q.correct };
    game.answers.push(result); game.phase = 'feedback'; return result;
  }
  function next(game) {
    if (!['event', 'feedback'].includes(game.phase)) throw new Error('請先結算本回合');
    game.pending = null;
    if (game.round === 6) { game.phase = 'report'; game.completed = true; }
    else game.phase = 'planning';
  }
  function stress(s) {
    const spending = (s.expense + debtPayment(s) + premium(s)) / 2;
    const liquid = s.cash + s.investments;
    const medicalNet = Math.max(0, 500000 - s.policies.health * 80000);
    return { unemployment: { available: liquid, required: round(spending), remaining: round(liquid - spending) }, medical: { available: liquid, required: medicalNet, remaining: round(liquid - medicalNet) }, death: { available: coverage(s), required: need(s), remaining: coverage(s) - need(s) } };
  }
  function score(game) {
    const expected = game.initialRole.priorities;
    const analysis = round(20 * game.selectedPriorities.filter(p => expected.includes(p)).length / 2);
    // Reapply each decision to the same original client. Realized random outcomes cannot inflate scores.
    const standardized = policies => { const reference = fresh(game.initialRole); reference.policies = clone(policies); return metrics(reference); };
    const snapshots = game.records.map(r => standardized(r.policies));
    if (!snapshots.length) snapshots.push(standardized(game.client.policies));
    const avg = fn => snapshots.reduce((n, m) => n + fn(m), 0) / snapshots.length;
    const family = avg(m => m.need ? clamp(m.coverage / m.need, 0, 1) : 1);
    const medical = game.records.length ? game.records.reduce((n, r) => n + clamp(r.policies.health / 2, 0, 1), 0) / game.records.length : game.client.policies.health / 2;
    const accident = game.records.length ? game.records.reduce((n, r) => n + r.policies.accident, 0) / game.records.length : game.client.policies.accident;
    const protectionMix = expected.includes('accident') ? family * .5 + medical * .15 + accident * .35 : family * .65 + medical * .35;
    const allocation = round(25 * protectionMix);
    const affordability = round(20 * avg(m => (m.flow >= 0 ? .6 : 0) + .4 * clamp(m.reserve / 6, 0, 1)));
    const contract = game.answers.length ? round(20 * game.answers.filter(a => a.correct).length / game.answers.length) : 0;
    const retire = round(15 * avg(m => clamp(m.retirement.ratio, 0, 1)));
    const items = [{ label: '需求分析', score: analysis, max: 20, detail: '初始角色的兩項優先需求辨識' }, { label: '保障配置', score: allocation, max: 25, detail: expected.includes('accident') ? '同一初始角色：身故保障 50%＋醫療保障 15%＋意外保障 35%，各回合平均' : '同一初始角色：身故保障適足率 65%＋醫療壓力保障 35%，各回合平均' }, { label: '預算與韌性', score: affordability, max: 20, detail: '同一初始角色：正現金流 60%＋六個月現金預備金 40%，各回合平均' }, { label: '契約理解', score: contract, max: 20, detail: '觀念題答對比例；未作答不計分' }, { label: '退休準備', score: retire, max: 15, detail: '同一初始角色：預估退休年收入／退休年支出，最高 100%，各回合平均' }];
    return { total: items.reduce((n, i) => n + i.score, 0), items, stress: stress(game.client) };
  }
  function feedback(game) {
    const m = metrics(game.client), r = game.pending || game.records[game.records.length - 1];
    const lines = [];
    if (r) lines.push(r.actual.reason);
    if (m.flow < 0) lines.push('目前年度現金流為負。先調整保費配置並保留生活預算，避免保障計畫無法持續。');
    else lines.push('目前保費可由年度收入支應；仍需檢查現金預備金與市場下跌後的支付能力。');
    if (m.gap > 0) lines.push('家庭身故保障仍有缺口。可比較增加壽險與保留流動資金的取捨；失業不由壽險給付。');
    else lines.push('依本遊戲的五年家庭支出假設，身故保障已涵蓋估計需求；可轉而檢視醫療與退休。');
    if (m.reserve < 6) lines.push('現金預備金少於六個月。買入更多長期保單前，先為短期生活留出緩衝。');
    if (r && r.actual.claim === 0) lines.push('本回合沒有給付，仍要按事前需求評估保障成本，不能把理賠當投資收益。');
    return lines;
  }
  function validSave(g) {
    try {
      return g.version === VERSION && roles.some(r => r.id === g.roleId) && ['planning', 'event', 'feedback', 'retirement', 'report'].includes(g.phase) && Number.isInteger(g.round) && g.round >= 0 && g.round <= 6 && Array.isArray(g.records) && g.records.length === g.round && Array.isArray(g.answers) && Array.isArray(g.decisions) && Array.isArray(g.selectedPriorities) && [g.client, g.baseline].every(s => s && ['cash','debt','income','expense','investments','investAccount','annuityAccount'].every(k => Number.isFinite(s[k])) && products.every(p => Number.isInteger(s.policies[p.id]) && s.policies[p.id] >= 0 && s.policies[p.id] <= p.max)) && (!(g.phase === 'event' || g.phase === 'feedback') || !!g.pending);
    } catch { return false; }
  }
  return { VERSION, roles, products, events, deckFor, tileCategory, categories, priorities, judgments, create, setPolicy, roll, answer, next, claimEstimate, metrics, premium, flow, net, need, gap, coverage, reserveMonths, retirement, stress, score, feedback, validSave };
});
