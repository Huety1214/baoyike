/* Browser view only. All financial and claim calculations live in academy-engine.js. */
(() => {
  'use strict';
  const E = window.Academy, app = document.querySelector('#app'), toolbar = document.querySelector('#game-toolbar'), modal = document.querySelector('#modal'), content = document.querySelector('#modal-content');
  const money = n => Math.round(n).toLocaleString('zh-TW'), wan = n => (n / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + ' 萬', pct = n => Math.round(n * 100) + '%';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const signed = n => (n > 0 ? '+' : '') + money(n), row = (label, value, cls = '') => `<div class="data-row"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
  const TERMS_PLAIN = {
    life: { plain: '只在「身故」時理賠，每單位給付 300 萬；失業、失能、住院都不賠。這是留給家人的保障，不是醫療險，也不是失業救濟金。', example: '林先生有 360 萬房貸和一個小孩：萬一身故，300 萬理賠金可以讓家人先安頓房貸與生活，不至於馬上失去住所。' },
    health: { plain: '只有「住院」才賠，門診不賠；每單位上限 8 萬，且總給付不會超過你實際花的醫療費用。', example: '膽結石開刀自費 10 萬：有一單位健康險理賠 8 萬，剩下 2 萬自付；後續門診回診的費用這張保單不會出。' },
    accident: { plain: '只賠「外來突發事故」：意外門診最高 5 萬、意外失能定額 30 萬、意外身故 100 萬。疾病引起的醫療完全不賠。', example: '通勤摔車門診花 6 萬，意外險理賠 5 萬；但感冒或疾病門診，這張保單一毛都不賠。' },
    investment: { plain: '年繳 3 萬扣除投入費、管理費與保障成本後才進帳戶；帳戶跟著市場漲跌，每年另扣帳戶 1%。身故時領「保額 100 萬」與「帳戶價值」較高者，不重複給付；解約收帳戶 5%費用。', example: '市場下跌 20% 的那年帳戶會縮水，但身故保障 100 萬照常給付——保障與投資分開算，跌的是帳戶，不是保障。' },
    annuity: { plain: '每年繳 2.4 萬累積到 65 歲，帳戶除以 18 換成每年領的終身年金；累積期身故會把帳戶退還給家人。中途解約收 5%。', example: '' }
  };
  let game = null, view = 'setup', rolling = false, walking = false, toastTimer, tokenPos = null;
  function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
  let modalLocked = false;
  function dialog(title, body, eyebrow = 'LifeRisk', actions = '', closable = true, wide = false) {
    modalLocked = !closable;
    modal.classList.toggle('wide', wide);
    content.innerHTML = `<div class="modal-body"><div class="modal-top"><div><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2></div>${closable ? '<button class="icon-btn" data-action="close" aria-label="關閉對話框">×</button>' : ''}</div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ''}</div>`;
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
  }
  function close() { modalLocked = false; modal.close(); }
  function render() {
    document.body.classList.toggle('in-game', view === 'game');
    toolbar.hidden = view !== 'game';
    if (toolbar.hidden) toolbar.innerHTML = '';
    if (view === 'setup') renderSetup(); else if (view === 'report') renderReport(); else renderGame();
  }
  function renderSetup() {
    app.innerHTML = `<section class="onboarding">
      <div class="onboarding-head"><h1>規劃一段人生，<span>看見保障的價值。</span></h1><div class="steps-inline"><span><b>01</b>選擇客戶與優先需求</span><span><b>02</b>規劃保障、擲骰前行</span><span><b>03</b>六回合決算與教練復盤</span></div></div>
      <div class="setup-heading"><h1>選擇客戶</h1><div><button class="secondary" data-action="guide">玩法指南</button></div></div>
      <div class="role-grid" role="group" aria-label="選擇模擬客戶">${E.roles.map(r => `<button class="role-card ${r.color}" data-action="role" data-id="${r.id}"><div class="avatar" aria-hidden="true">${r.icon}</div><h3>${r.name}<small>${r.job}</small></h3><p class="role-detail">${r.age} 歲 · ${r.family}</p><p class="tagline">${r.tagline}</p><div class="divider"></div>${row('年收入', wan(r.income))}${row('年生活費', wan(r.expense))}${row('現金 / 負債', `${wan(r.cash)} / ${wan(r.debt)}`)}</button>`).join('')}</div></section>`;
  }
  function initialNotes() {
    const facts = E.evidenceOptions(game.initialRole);
    const labels = [...game.evidence.map(id => facts[id]), ...game.selectedPriorities.map(id => E.priorities[id]), ...(game.initialJudgments || []).map(id => E.judgments[id])];
    return `<div class="priority-box"><h4>開局判斷</h4><ul>${labels.map(label => `<li>${esc(label)}</li>`).join('')}</ul>${game.rationale ? `<p>${esc(game.rationale)}</p>` : ''}</div>`;
  }
  function metric(label, value, detail, id, icon = '↗', cls = '') { return `<button class="metric" data-action="metric" data-id="${id}" aria-label="${label}：${value}。查看計算依據"><span class="metric-title">${label}</span><span class="metric-icon">${icon}</span><strong class="${cls}">${value}</strong><small>${detail}</small></button>`; }
  const COORDS = (() => { const positions = []; for (let x = 1; x <= 6; x++) positions.push([1, x]); for (let y = 2; y <= 5; y++) positions.push([y, 6]); for (let x = 6; x >= 1; x--) positions.push([6, x]); for (let y = 5; y >= 2; y--) positions.push([y, 1]); return positions; })();
  function tiles() {
    const icons = { life: '✿', risk: '♡', market: '↗', contract: '▤' }, labels = { life: '人生', risk: '風險', market: '市場', contract: '契約' };
    const cur = tokenPos ?? game.position;
    return COORDS.map(([y,x], i) => { const c = E.tileCategory(i); return `<div class="tile ${c} ${i === cur ? 'current' : ''}" style="grid-area:${y}/${x}" aria-label="第 ${i + 1} 格 ${E.categories[c]}${i === cur ? '，目前位置' : ''}"><b class="tile-num">${String(i + 1).padStart(2, '0')}</b><span aria-hidden="true">${i === 0 ? '⌂' : icons[c]}</span><small>${labels[c]}</small></div>`; }).join('');
  }
  function boardToken(client) {
    const role = E.roles.find(r => r.id === game.roleId), pos = tokenPos ?? game.position;
    const [y, x] = COORDS[pos] || COORDS[0];
    return `<div class="board-token" style="grid-area:${y}/${x}" aria-hidden="true"><span>${client.alive ? role.icon : '⌂'}</span></div>`;
  }
  function renderGame() {
    if (!game) { view = 'setup'; return renderSetup(); }
    const s = game.client, m = E.metrics(s), pending = game.pending;
    const shownRound = Math.min(game.round + (game.phase === 'planning' ? 1 : 0), 6);
    const pips = Array.from({ length: 6 }, (_, i) => `<span class="${i + 1 <= game.round ? 'done ' : ''}${i + 1 === shownRound ? 'now' : ''}"></span>`).join('');
    toolbar.innerHTML = `<div class="client-summary"><h1>${s.name}<small>${s.alive ? s.job + ' · ' + s.age + ' 歲' : '家屬接續'}</small></h1><button class="small-link" data-action="client">客戶資料 ↗</button></div>
      <button class="primary" data-action="planning">保險規劃</button><button class="secondary" data-action="journal">人生手帳</button>`;
    app.innerHTML = `<div class="workspace">
    <aside class="left-column"><div class="metrics-grid" aria-label="財務與保障儀表板">${metric('年度現金流', signed(m.flow), '收入－生活－還款－年繳', 'flow', '↗', m.flow < 0 ? 'negative' : '')}${metric('家庭保障缺口', wan(m.gap), '點擊查看估算依據', 'gap', '♡', m.gap ? 'negative' : '')}${metric('財務韌性', m.reserve.toFixed(1) + ' 個月', '現金預備金・目標 6 個月', 'reserve', '◎')}${metric('淨資產', wan(m.net), '含資產與保單帳戶－負債', 'net', '▥')}${metric('退休準備度', pct(m.retirement.ratio), '退休收入／退休生活支出', 'retirement', '◷')}${metric('年度保費與投入', wan(m.premium), '含保障、投資與年金投入', 'premium', '◇')}</div></aside>
    <section class="center-column">${s.insolvent ? '<div class="status-note">曾出現支付缺口：系統已先變現一般投資，再將不足額記為緊急借款。請檢查現金流與負債。</div>' : ''}<section class="panel board-panel"><div class="board-label"><h2>人生棋盤 <span class="eyebrow">六年旅程</span></h2><div class="round-wrap"><div class="round-pips" aria-hidden="true">${pips}</div><span class="round-tag">第 ${shownRound} / 6 回合</span></div></div><div class="board-wrap"><div class="board">${tiles()}${boardToken(s)}<div class="board-center"><div class="dice ${rolling ? 'rolling' : ''}" aria-label="骰子 ${game.dice} 點">${['⚀','⚁','⚂','⚃','⚄','⚅'][game.dice - 1]}</div><button class="primary" data-action="${pending ? 'event' : 'roll'}" ${rolling ? 'disabled' : ''}>${rolling ? '擲骰中…' : pending ? '查看本回合結算' : '擲骰'}</button></div></div></div><div class="legend"><span><i class="risk"></i>風險事件</span><span><i class="market"></i>市場事件</span><span><i class="life"></i>人生事件</span><span><i></i>契約事件</span></div></section>
    </section><aside class="right-column">${riskPanel(s)}</aside></div>`;
  }
  function riskPanel(client) {
    const scenarios = [
      ['疾病住院', 'hospital', 100000],
      ['意外門診', 'accident', 60000]
    ];
    const layoff = E.stress(client).unemployment;
    return `<section class="panel risk-panel${game.phase === 'planning' ? ' focus' : ''}"><div class="eyebrow">風險檢查</div><h2>風險由誰承擔？</h2>
      <p class="section-subtitle">用目前的保單即時試算，調整規劃立即更新；金額不計入本局。</p>
      ${scenarios.map(([title, kind, loss]) => {
        const claim = E.claimEstimate(client, kind, loss);
        const months = E.reserveMonths({ ...client, cash: client.cash - (loss - claim) });
        return `<div class="risk-case"><h3>${title}<small>支出 ${wan(loss)}</small></h3>
          <div class="risk-meter" aria-hidden="true"><i style="width:${claim / loss * 100}%"></i></div>
          ${row('保單給付', wan(claim), 'positive')}${row('自行負擔', wan(loss - claim))}${row('自付後現金可支應', months.toFixed(1) + ' 個月', months < 6 ? 'negative' : '')}</div>`;
      }).join('')}
      <div class="risk-case"><h3>失業半年<small>本遊戲保單不給付</small></h3>
          ${row('半年必要支出', wan(layoff.required))}${row('可用現金＋投資', wan(layoff.available))}${row(layoff.remaining < 0 ? '緊急缺口' : '剩餘餘裕', wan(Math.abs(layoff.remaining)), layoff.remaining < 0 ? 'negative' : 'positive')}</div></section>`;
  }
  function planning() {
    const s = game.client, m = E.metrics(s), locked = game.phase !== 'planning' || rolling;
    dialog('保險規劃', `<div class="plan-grid"><aside class="plan-coach"><h3>本回合風險提示</h3><div data-coach></div></aside><div class="plan-main"><p class="section-subtitle">${locked || !s.alive ? '目前僅供查看。' : '調整立即儲存，本回合擲骰前生效。'}</p><div class="products">${E.products.map(p => `<article class="product"><div class="product-icon" aria-hidden="true">${p.icon}</div><div><h3>${p.name}<small>${p.type}</small></h3><p>${p.description}</p><div class="product-bottom"><strong>NT$ ${money(p.premium)} <small>/ 年 / 單位</small></strong><button class="terms-btn" data-action="terms" data-id="${p.id}">查看條款 ↗</button></div></div><div class="stepper"><button data-action="policy" data-id="${p.id}" data-delta="-1" aria-label="減少${p.name}" ${locked || s.policies[p.id] === 0 || !s.alive ? 'disabled' : ''}>−</button><strong aria-label="${p.name} ${s.policies[p.id]} 單位">${s.policies[p.id]}</strong><button data-action="policy" data-id="${p.id}" data-delta="1" aria-label="增加${p.name}" ${locked || s.policies[p.id] >= p.max || !s.alive ? 'disabled' : ''}>＋</button></div></article>`).join('')}</div><div class="budget-line"><span>年繳佔收入 ${s.alive && s.income ? pct(m.premium / s.income) : '—'} · 當回合收取全年費用</span><strong class="${m.flow < 0 ? 'negative' : ''}">年餘額 ${signed(m.flow)}</strong></div></div></div>`, '本年度保單', '<button class="primary" data-action="close">返回棋盤</button>', true, true);
    mountCoach(false);
  }
  function cashChart(labels, planned, base) {
    const values = [...planned, ...base], low = Math.min(...values), high = Math.max(...values);
    const pad = Math.max(1000, (high - low) * .15), lo = Math.max(0, low - pad), hi = high + pad;
    const x = i => 80 + i * 420 / Math.max(1, labels.length - 1);
    const y = v => 142 - (v - lo) * 108 / (hi - lo);
    const line = (series, css) => `<polyline class="${css}" points="${series.map((v,i)=>x(i)+','+y(v)).join(' ')}"/>`;
    const floorLines = [[Math.min(...planned), 'planned'], [Math.min(...base), 'base']].map(([v, cls]) => `<line class="floor-line ${cls}" x1="80" x2="501" y1="${y(v)}" y2="${y(v)}"/>`).join('');
    return `<figure class="cash-figure"><figcaption>可用現金（新台幣） <small>實線 ● 目前規劃　虛線 ◇ 不新增投保</small></figcaption>
    <svg viewBox="0 0 550 180" role="img" aria-label="兩條路徑的可用現金，虛線標示各路徑期間最低現金，精確金額見下方表格">
    ${[lo,(hi+lo)/2,hi].map(v=>`<line x1="78" x2="501" y1="${y(v)}" y2="${y(v)}" stroke="#d5ded1"/><text x="70" y="${y(v)+4}" text-anchor="end">${wan(v)}</text>`).join('')}
    ${floorLines}
    ${line(planned,'planned-line')}${line(base,'base-line')}
    ${planned.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#29664f"/><path d="M -5 0 L 0 -5 L 5 0 L 0 5 Z" transform="translate(${x(i)} ${y(base[i])})" fill="none" stroke="#8b507d" stroke-width="2"/><text x="${x(i)}" y="166" text-anchor="middle">${labels[i]}</text>`).join('')}</svg>
    <details><summary>逐點金額</summary><table><thead><tr><th>階段</th><th>目前規劃</th><th>不新增投保</th></tr></thead><tbody>${labels.map((l,i)=>`<tr><td>${l}</td><td>${money(planned[i])}</td><td>${money(base[i])}</td></tr>`).join('')}</tbody></table></details></figure>`;
  }
  function compare(r) {
    const a = r.actual, b = r.baseline;
    const intermediate = Number.isFinite(a.beforeEventCash) && Number.isFinite(b.beforeEventCash);
    const series = v => [v.before.cash, ...(intermediate ? [v.beforeEventCash] : []), v.after.cash];
    return `<h3>本回合的兩條現金路徑</h3>${cashChart(['年初', ...(intermediate ? ['收支後'] : []), '事件結算'], series(a), series(b))}
    ${row('本年繳納（含帳戶投入）', money(a.paid) + ' ／ ' + money(b.paid))}
    ${row('契約給付（規劃 ／ 不新增投保）', money(a.claim) + ' ／ ' + money(b.claim))}
    ${row('自付損失（規劃 ／ 不新增投保）', money(Math.max(0,a.outOfPocket)) + ' ／ ' + money(Math.max(0,b.outOfPocket)))}
    ${row('期末現金（規劃 ／ 不新增投保）', money(a.after.cash) + ' ／ ' + money(b.after.cash))}
    ${row('期末現金差額', signed(a.after.cash-b.after.cash) + ' 元')}
    <p class="fine-print">兩條路徑自開局承受相同事件，均保留既有保障。缺錢時會變賣一般投資或借款，現金差額可能小於損失差額。</p>`;
  }
  function eventLesson(r) {
    const a=r.actual, e=r.event, extra=a.claim-r.baseline.claim;
    if (a.claim) return `本次契約給付 ${money(a.claim)} 元。${extra > 0 ? '相較只保留既有保障，你的新增配置多給付 '+money(extra)+' 元。' : '本次給付來自既有保障；新增配置未增加給付。'}尚須自付 ${money(Math.max(0,a.outOfPocket))} 元。`;
    if (['hospital','accident','disability','death'].includes(e.kind)) {
      const offer = {hospital:['健康險',Math.min(a.loss,80000)],accident:['意外險',Math.min(a.loss,50000)],disability:['意外險',300000],death:['定期壽險',3000000]}[e.kind];
      return `本次沒有給付。若事前配置一單位${offer[0]}，按本遊戲契約可給付 ${money(offer[1])} 元；本次已發生，調整從下回合起適用。`;
    }
    if (e.market) return `本次市場損益為 ${signed(a.marketChange)} 元。本遊戲保單不補償市場跌價；可在事件前檢視連動帳戶曝險。`;
    if (a.loss) return '本遊戲五類保單均不涵蓋這次損失。可事先以預備金承擔支出，增加保單單位也不會觸發理賠。';
    return '本次沒有可理賠事故。若收入、家庭責任或生活費已變動，可用更新後的數字檢查下一年負擔。';
  }
  function countClaim(amount) {
    const el = content.querySelector('[data-claim-count]');
    if (!el || typeof requestAnimationFrame !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now(), dur = 900;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur), eased = 1 - (1 - p) ** 3;
      el.textContent = money(amount * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function showEvent(historyRound) {
    const historic = Number.isInteger(historyRound), r = historic ? game.records.find(r => r.round === historyRound) : game.pending;
    if (!r) return;
    const a = game.answers.find(a => a.round === r.round), q = r.quiz, payoutHero = r.actual.claim > 0;
    dialog(r.event.title, `<span class="event-badge ${r.event.category}">${E.categories[r.event.category]} · ${r.event.subtitle}</span><p class="event-description" style="margin-top:15px">${r.event.description}</p><div class="ledger hero"><article><small>事件損失</small><strong>${money(r.actual.loss)}</strong></article><article${payoutHero ? ' class="payout"' : ''}><small>契約給付</small><strong class="positive"${payoutHero ? ' data-claim-count' : ''}>${money(r.actual.claim)}</strong></article><article><small>${r.event.kind === 'death' ? '給付扣除事件費用' : '本次自付'}</small><strong class="${r.actual.outOfPocket > 0 ? 'negative' : 'positive'}">${money(r.event.kind === 'death' ? -r.actual.outOfPocket : r.actual.outOfPocket)}</strong></article></div>${r.actual.marketChange ? `<div class="explanation">市場帳戶損益 ${signed(r.actual.marketChange)} 元；市場跌幅不屬於健康或意外險理賠。</div>` : ''}${compare(r)}<details class="lesson"><summary>規劃回饋與帳務明細</summary><div><div class="explanation"><b>本次規劃回饋</b><br>你開局關注${game.selectedPriorities.map(p=>E.priorities[p]).join("、")}。 ${eventLesson(r)}</div><div class="explanation"><strong>${r.actual.policy}</strong><br>${r.actual.reason}</div>${row('本回合年繳（含投入）', money(r.actual.paid))}${row('其中保障險保費', money(r.actual.protection))}${row('其中帳戶費用與保障成本', money(r.actual.fees))}</div></details>${q ? `<details class="quiz" ${a ? 'open' : ''}><summary>契約觀念練習（選答）</summary><h3>${q.question}</h3><div class="quiz-options">${q.options.map((o,i) => `<button class="quiz-option ${a && i === q.correct ? 'correct' : a && i === a.index ? 'incorrect' : ''}" data-action="answer" data-index="${i}" ${a || historic ? 'disabled' : ''}><b>${String.fromCharCode(65+i)}</b>${o}</button>`).join('')}</div>${a ? `<p class="quiz-answer">${a.correct ? '✓ 判斷正確。' : '這裡可以再想一想。'} ${q.explanation}</p>` : historic ? `<p class="fine-print">本回合未作答。</p>` : ''}</details>` : '' }`, `第 ${String(r.round).padStart(2,'0')} 回合 · ${r.scheduled ? '必修情境' : r.teaching ? '指定演練' : E.categories[r.event.category]}`, historic ? '<button class="secondary" data-action="close">返回棋盤</button>' : `<button class="primary" data-action="next">${game.round === 6 ? '查看六回合結算' : '下一回合'} →</button>`);
    if (payoutHero) countClaim(r.actual.claim);
  }
  function metricDetail(id) {
    const s = game.client, m = E.metrics(s), rp = m.retirement;
    const details = {
      flow: ['年度現金流', `${row('年工作收入', money(s.alive ? s.income : 0))}${row('－生活支出', money(s.expense))}${row('－還款（含本金與利息）', money(Math.min(s.debtService, s.debt*1.02)))}${row('－保費與帳戶投入', money(m.premium))}<div class="divider"></div>${row('年度現金流', signed(m.flow))}<p class="fine-print">每回合先結算一年收支，再處理事件；新發生的升職、失能或生活費調整影響往後年度。當年失業另外扣除半年薪資。</p>`],
      gap: ['家庭身故保障缺口', `${row('目前負債', money(s.debt))}${row('＋五年家庭生活支出', money(s.dependents && s.alive ? s.expense*5 : 0))}${row('＝估計需求', money(m.need))}<div class="divider"></div>${row('既有已繳清身故保障', money(s.alive ? s.existingLife : 0))}${row('＋本遊戲壽險', money(s.policies.life*3000000))}${row('＋投資型身故保障', money(s.alive ? Math.max(s.policies.investment*1000000,s.investAccount) : 0))}${row('＝有效身故保障', money(m.coverage))}<div class="explanation">缺口 ＝ max(0, 估計需求 − 有效身故保障)<br>本次缺口：${money(m.gap)} 元</div><p class="fine-print">五年支出是固定教學假設；有扶養對象才計入。為保守示範，本指標不扣除房產、存款，也不把僅限意外身故的給付算成一般身故保障。醫療風險另由壓力測試檢查。</p>`],
      reserve: ['財務韌性與流動性', `${row('現金預備金', money(s.cash))}${row('每月必要支出（含保費與還款）', money((s.expense+Math.min(s.debtService,s.debt*1.02)+m.premium)/12))}<div class="explanation">現金支應月數：${m.reserve.toFixed(1)} 個月<br>固定練習目標：至少六個月</div><p class="fine-print">這裡只看現金。壓力測試會另外列出可變現的一般投資；房產與保單帳戶不當作立即可用的預備金。六個月是遊戲評分假設。</p>`],
      net: ['淨資產的組成', `${row('現金', money(s.cash))}${row('一般投資', money(s.investments))}${row('房產', money(s.property))}${row('投資型帳戶', money(s.investAccount))}${row('累積期年金帳戶', money(s.annuityAccount))}${row('－負債', money(s.debt))}<div class="divider"></div>${row('淨資產', money(m.net))}<p class="fine-print">身故保障額不是現有資產；事件發生才計入實際給付。投資型身故時移除帳戶並加入契約給付，避免重複計算。還款本金減少現金與負債，利息才是資產減損。</p>`],
      premium: ['年繳與費用，不是同一件事', E.products.map(p => row(`${p.name} × ${s.policies[p.id]}`, money(p.premium*s.policies[p.id]))).join('') + `<div class="divider"></div>${row('年度繳納合計', money(m.premium))}${row('累計繳納', money(s.premiumsPaid))}${row('累計保障險保費', money(s.protectionCosts))}${row('累計帳戶費用與保障成本', money(s.fees))}<p class="fine-print">投資型與年金的年繳，扣除費用後會進入帳戶，不把整筆投入當作費用。既有壽險假設已繳清；沒有額外續繳。減少投資型或年金單位會按比例解約，並收取帳戶價值 5% 費用。</p>`],
      retirement: ['退休準備度的估算', `${row('既有退休年收入', money(rp.pension))}${row('推估新增年金年給付', money(rp.annuity))}${row('退休年生活費目標', money(rp.expense))}<div class="explanation">準備度 ＝（既有退休收入＋新增年金）÷ 退休年生活費<br>目前估計：${pct(rp.ratio)}</div><p class="fine-print">假設未來 ${rp.years} 年持續投入目前年金單位，每年累積 1%，65 歲帳戶÷18 轉成年給付。此指標未將一般資產提領、通膨或投資報酬納入，不代表完整退休規劃。</p>`]
    };
    const d = details[id]; if (d) dialog(d[0], d[1], '計算依據');
  }
  function reportCash() {
    const records = game.records;
    if (!records.length) return '';
    const series = key => [records[0][key].before.cash, ...records.map(r=>r[key].after.cash)];
    return `<section class="panel report-section"><h2>歷年期末現金</h2>
      ${cashChart(['開局', ...records.map(r=>'第'+r.round+'年')],series('actual'),series('baseline'))}
      ${row('期末現金（規劃 ／ 不新增投保）', money(game.client.cash)+' ／ '+money(game.baseline.cash))}
      ${row('累計自付事件損失',money(records.reduce((sum,r)=>sum+Math.max(0,r.actual.outOfPocket),0))+' 元')}
      ${row('期末現金差額', signed(game.client.cash-game.baseline.cash)+' 元')}</section>`;
  }
  function assessmentPanel() {
    if (!game.completed) return '';
    return `<section class="panel report-section"><h2>契約理解評量</h2><p>三題相同案例讓每局可比較；全部完成後列入 20 分。每題提交一次。</p>
      ${E.assessmentSet.map(q=>{
        const choice=game.assessment[q.id];
        return `<div class="quiz"><h3>${q.question}</h3><div class="quiz-options">${q.options.map((o,i)=>
          `<button class="quiz-option ${choice != null && i===q.correct?'correct':''}" data-action="assessment" data-id="${q.id}" data-index="${i}" ${choice!=null?'disabled':''}>${o}</button>`).join('')}</div>
          ${choice!=null?`<p>你選了「${q.options[choice]}」 · ${choice===q.correct?'正確':'再留意這項條件'}。 ${q.explanation}</p>`:''}</div>`;
      }).join('')}</section>`;
  }

  let coachTimer, activeRequest, coachOwner, activeKey, lastError;
  function mountCoach(review, retry = false) {
    const g = game, box = app.querySelector('[data-coach]') || document.querySelector('[data-coach]');
    if (!box) return;
    const stage = review ? (g.completed ? 'final' : 'review') : 'round';
    const pool = window.LifeCoach.candidates(g, review), input = window.LifeCoach.requestData(g,pool,stage);
    const stamp = JSON.stringify(input), slot = stage + '-' + g.round;
    const current = () => game === g && (app.querySelector('[data-coach]') || document.querySelector('[data-coach]')) === box;
    const paint = (report, status, canRetry=false) => {
      if (!current()) return;
      const section = (key,title) => `<h4>${title}</h4><ul class="coach-lines">${report[key].length ? report[key].map(f => `<li>第 ${f.round} 回合 · ${esc(f.observation)}${f.insight ? '<br>'+esc(f.insight) : ''}</li>`).join('') : '<li>目前紀錄不足以判定。</li>'}</ul>`;
      box.innerHTML = `<p class="mini-badge" role="status">${esc(status)}</p>${section('risks','目前風險')}${report.strengths.length ? section('strengths', review ? '決策優點' : '做得好的地方') : ''}${review ? section('weaknesses','缺點與待補強處'):''}
        ${canRetry ? '<button class="small-link" data-action="retry-coach">重試 AI 解說</button>' : ''}
        ${review ? '<details><summary>查看固定 JSON</summary><pre>'+esc(JSON.stringify(report,null,2))+'</pre></details>' : ''}`;
    };
    clearTimeout(coachTimer);
    const saved = g.coaching?.[slot];
    if (saved?.stamp === stamp && saved.report.mode === 'llm') {
      paint(saved.report,'AI 教練 · 已引用本局紀錄'); return;
    }
    if (coachOwner !== g || activeKey !== stamp || retry) {
      activeRequest?.abort(); activeRequest=null; lastError=null; coachOwner=g; activeKey=stamp;
    }
    const fallback = window.LifeCoach.rules(pool,stage);
    g.coaching ??= {};
    g.coaching[slot] = {stamp, report:fallback};
    if (!review && g.phase !== 'planning') { paint(fallback,'事件已結算 · 規則摘要'); return; }
    if (lastError && !retry) { paint(fallback,lastError,true); return; }
    paint(fallback,'規則摘要 · 正在取得 AI 解說');
    coachTimer = setTimeout(async()=>{
      if (!current()) return;
      // A newly rendered panel owns its request, even if the underlying state stayed the same.
      activeRequest?.abort();
      const ctrl=new AbortController();
      activeRequest=ctrl;
      const deadline=setTimeout(()=>ctrl.abort(),35000);
      try {
        const res=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:stamp,signal:ctrl.signal});
        if(!res.ok) throw Error(res.status===503?'AI 尚未設定或暫時無法服務':res.status===429?'AI 請求繁忙':'AI 服務未能產生解說');
        const report=window.LifeCoach.fromModel(pool,await res.json(),stage);
        if (!current() || ctrl!==activeRequest) return;
        g.coaching[slot]={stamp,report};  paint(report,'AI 教練 · 已引用本局紀錄');
      } catch(error) {
        if (!current() || ctrl!==activeRequest) return;
        lastError= (error.name==='AbortError'?'AI 回覆逾時':error.message) + ' · 顯示規則摘要';
        paint(fallback,lastError,true);
      } finally { clearTimeout(deadline); }
    },450);
  }
  function radar(items) {
    const n = items.length, cx = 125, cy = 112, R = 64;
    const pt = (r, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const ring = r => `<polygon class="ring" points="${items.map((_, i) => pt(r, i).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
    const axes = items.map((it, i) => { const [x, y] = pt(R, i), [lx, ly] = pt(R + 26, i); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle">${it.label}</text>`; }).join('');
    const ratio = (it, i) => pt(R * ((it.score ?? 0) / it.max), i);
    return `<svg class="radar" viewBox="0 0 250 218" role="img" aria-label="五個評量構面的雷達圖；未完成的契約理解以零分呈現">${ring(R)}${ring(R * .5)}${axes}<polygon class="score-shape" points="${items.map((it, i) => ratio(it, i).map(v => v.toFixed(1)).join(',')).join(' ')}"/>${items.map((it, i) => { const [x, y] = ratio(it, i); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#56814a"/>`; }).join('')}</svg>`;
  }
  function storyLine(s, m) {
    const bits = [`六回合共經歷 ${game.records.length} 個事件`, `累計契約給付 ${wan(s.claims)} 元`, `期末淨資產 ${wan(m.net)}`];
    bits.push(!s.alive ? '客戶身故後由家屬接續完成' : m.gap > 0 ? `仍有身故保障缺口 ${wan(m.gap)}` : '身故保障已達估計需求');
    return bits.join(' · ') + '。';
  }
  function stressPanel(st, base) {
    const cases = [
      { key: 'unemployment', title: '失業六個月', note: '可用現金＋一般投資 − 半年必要支出' },
      { key: 'medical', title: '重大醫療支出 50 萬', note: '可用現金＋一般投資 − 扣理賠後醫療費' },
      { key: 'death', title: '家庭收入永久中斷', note: '有效身故保障 − 負債及五年家庭生活費' }
    ];
    return `<section class="panel report-section"><span class="eyebrow">固定壓力測試</span><p class="section-subtitle">保險用可負擔的年繳，換取最差情況的下限。三種壓力同時比較目前規劃與不新增投保。</p><div class="stress-grid">${cases.map(c => {
      const d = st[c.key], alt = base[c.key];
      return `<div class="stress-card"><h3>${c.title}</h3><p>${c.note}</p><strong class="${d.remaining<0?'negative':'positive'}">${d.remaining<0?'缺口 ':'餘裕 '}${wan(Math.abs(d.remaining))}</strong><p>需求 ${wan(d.required)} · 可用 ${wan(d.available)}</p><p class="stress-alt">不新增投保：${alt.remaining<0?'缺口 ':'餘裕 '}${wan(Math.abs(alt.remaining))}${d.remaining>=0&&alt.remaining<0?' · 規劃接住了這個風險':''}</p></div>`;
    }).join('')}</div><p class="fine-print">使用目前狀態做相同壓力測試，不再抽機率；家庭責任的情境也採相同五年支出假設。此處呈現財務韌性，不增加或扣除原局資產。</p></section>`;
  }
  function renderReport() {
    const s = game.client, m = E.metrics(s), b = E.metrics(game.baseline), scoring = E.score(game), st = scoring.stress, bs = E.stress(game.baseline);
    app.innerHTML = `<section class="report-page"><div class="report-heading"><h1>${game.completed ? '學習報告' : '階段回顧'}</h1><p>${s.name} · ${s.job} · ${game.round} / 6 回合${game.completed ? ' · 六回合學習成果' : ' · 尚非最終成績'}</p><p class="story-line">${storyLine(s, m)}</p></div><div class="report-grid"><section class="panel score-card"><span class="eyebrow">理專學習成果</span><div class="score-number">${scoring.total}<small> / ${scoring.max}</small></div><p>${scoring.max === 80 ? "契約理解尚未完成，目前列出其餘四項的 80 分小計。" : "五項評量已完成。"}</p><div class="score-items">${scoring.items.map(i => `<div class="score-item">${row(i.label, i.score == null ? "未評量" : `${i.score} / ${i.max}`)}<div class="bar"><span style="width:${i.score/i.max*100}%"></span></div></div>`).join('')}</div>${radar(scoring.items)}<button class="small-link" data-action="scoring">查看完整評分依據 ↗</button></section><section class="panel outcomes"><span class="eyebrow">人生財務成果</span><div class="detail-grid"><div class="detail-card"><h3>期末淨資產</h3><strong>${wan(m.net)}</strong><p>不新增投保路徑 ${wan(b.net)}</p></div><div class="detail-card"><h3>現金預備金</h3><strong>${m.reserve.toFixed(1)} 個月</strong><p>年度現金流 ${signed(m.flow)}</p></div><div class="detail-card"><h3>身故保障缺口</h3><strong class="${m.gap ? 'negative' : ''}">${wan(m.gap)}</strong><p>估計家庭需求 ${wan(m.need)}</p></div><div class="detail-card"><h3>退休準備度</h3><strong>${pct(m.retirement.ratio)}</strong><p>條件式收入試算</p></div></div><div class="divider"></div>${row('累計年繳（含投資與年金投入）', wan(s.premiumsPaid))}${row('其中保障險保費', wan(s.protectionCosts))}${row('另計帳戶費用與保障成本', wan(s.fees))}${row('累計契約給付', wan(s.claims))}${row('投資型與年金剩餘帳戶', wan(s.investAccount+s.annuityAccount))}<p class="fine-print">帳戶費用已從年繳或帳戶扣除，不在此再次扣款。兩條路徑都保留既有壽險。已發生支付缺口 ${wan(s.shortfall)}，按規則列入負債。</p></section></div>${stressPanel(st, bs)}<section class="panel report-section"><h2>決策復盤</h2><div data-coach></div>${initialNotes()}</section>${reportCash()}${assessmentPanel()}<section class="panel report-section"><h2>回合總覽</h2><div class="table-wrap"><table><thead><tr><th>回合</th><th>人生情境</th><th>年繳</th><th>契約給付</th><th>事件後淨資產</th><th>觀念題</th></tr></thead><tbody>${game.records.map(r=>`<tr><td>${r.round}</td><td><button class="small-link" data-action="history" data-round="${r.round}">${r.event.subtitle}</button></td><td>${wan(r.actual.paid)}</td><td>${wan(r.actual.claim)}</td><td>${wan(r.actual.after.net)}</td><td>${!r.quiz ? '無練習題' : game.answers.find(a=>a.round===r.round)?.correct === true ? '答對' : game.answers.some(a=>a.round===r.round) ? '答錯' : '未答'}</td></tr>`).join('')}</tbody></table></div></section><div class="report-actions">${game.completed ? '' : '<button class="secondary" data-action="resume">返回人生棋盤</button>'}<button class="secondary" data-action="export">下載完整決策紀錄 JSON ↓</button><button class="primary" data-action="restart">再練習一種人生 →</button></div></section>`;
    mountCoach(true);
  }
  function scoringDetail() {
    const result = E.score(game);
    dialog('評分依據', `<p class="event-description">每回合把你的保單配置放回同一個初始客戶作為標準情境，再平均評估。隨機事件的理賠金與期末資產不直接計分。</p>${result.items.map(i=>`<div class="priority-box"><h4>${i.label} · ${i.score ?? '未評量'} / ${i.max}</h4><p>${i.detail}</p></div>`).join('')}<p class="fine-print">需求分析採角色預設的兩項優先需求；本版開局不另勾選。契約理解使用終局固定三題；完成前其 20 分不列入分母。這是一套可檢查的 MVP 教學規則，尚未經正式教學成效驗證。</p>`, '固定評分依據');
  }
  let introEvidence = [], introPriorities = [];
  function introAnalysis() {
    const facts = E.evidenceOptions(game.initialRole);
    const pick = (id, label, sel, action) => `<button class="priority-choice ${sel.includes(id) ? 'selected' : ''}" aria-pressed="${sel.includes(id)}" data-action="${action}" data-id="${id}">${sel.includes(id) ? '✓ ' : ''}${label}</button>`;
    dialog('開局分析', `<p class="section-subtitle">開始之前，先做第一步：記下你注意到的客戶資料，並選兩項優先需求，作為本局的判斷依據。</p>
      <div class="intro-block"><h3>你會留意哪些客戶資料？</h3><div class="priority-choices">${Object.entries(facts).map(([id, label]) => pick(id, label, introEvidence, 'intro-evidence')).join('')}</div></div>
      <div class="intro-block"><h3>哪些需求優先？（選兩項 · ${introPriorities.length}/2）</h3><div class="priority-choices">${Object.entries(E.priorities).map(([id, label]) => pick(id, label, introPriorities, 'intro-priority')).join('')}</div></div>`,
      '第一步 · 需求分析', `<button class="primary" data-action="intro-confirm" ${introPriorities.length !== 2 || !introEvidence.length ? 'disabled' : ''}>開始第一回合 →</button>`, false);
  }
  function journalDialog() {
    const entries = game.records.length ? [...game.records].reverse().map(r => `<button class="journal-entry" data-action="history" data-round="${r.round}"><span class="journal-dot">${r.event.icon}</span><div><small>第 ${String(r.round).padStart(2,'0')} 回合${r.scheduled ? ' · 必修情境' : r.teaching ? ' · 指定演練' : ''}</small><h4>${r.event.subtitle}</h4><p>${r.actual.claim ? '契約給付 ' + wan(r.actual.claim) : r.actual.marketChange ? '市場損益 ' + wan(r.actual.marketChange) : '本次損失 ' + wan(r.actual.loss)}</p></div></button>`).join('') : '<div class="empty-journal"><span>▤</span><p>還沒發生的故事，<br>從你的第一份規劃開始。</p></div>';
    dialog('人生手帳', `<div class="journal-list">${entries}</div>`, '至今的經歷', '<button class="secondary" data-action="export">匯出決策紀錄 ↓</button>');
  }
  function guide() {
    dialog('玩法指南', `<div class="guide-steps">
      <div class="guide-step"><span class="guide-num">1</span><div><h3>認識客戶</h3><p>選擇一位角色，他的人生立即開局：家庭、負債與收入都寫在客戶卡上。</p></div></div>
      <div class="guide-step"><span class="guide-num">2</span><div><h3>規劃保障</h3><p>點「保險規劃」調整五類教學商品，對照年度現金流與風險試算，擲骰前生效。</p></div></div>
      <div class="guide-step"><span class="guide-num">3</span><div><h3>擲骰走棋</h3><p>每回合一年。落點決定事件類別，再從該客戶的專屬牌組抽卡；同類未見過的卡優先。</p></div></div>
      <div class="guide-step"><span class="guide-num">4</span><div><h3>結算復盤</h3><p>比較本次給付、自付與兩條現金路徑。完成六回合後查看財務成果與教練復盤。</p></div></div>
      </div>`, 'LifeRisk', '<button class="primary" data-action="close">了解</button>');
  }
  function exportGame() {
    const blob = new Blob([JSON.stringify({ ...game, evaluation: E.score(game), exportedAt: new Date().toISOString(), coaching:game.coaching || null }, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`liferisk-${game.roleId}-round-${game.round}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000); toast('完整紀錄已匯出。');
  }
  const pause = ms => new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
  async function doRoll() {
    if (!game || game.phase !== 'planning' || rolling || walking) return;
    close();
    const fromPos = game.position;
    rolling = true; renderGame();
    const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); const die = bytes[0] % 6 + 1;
    await pause(700);
    try { E.roll(game, die); } catch(error) { rolling = false; renderGame(); return toast(error.message); }
    rolling = false;
    walking = true;
    tokenPos = fromPos; renderGame();
    await pause(250);
    for (let step = 1; step <= die; step++) {
      tokenPos = (fromPos + step) % 20;
      renderGame();
      await pause(300);
    }
    tokenPos = null; renderGame();
    await pause(500);
    walking = false;
    showEvent();
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if(!button || button.disabled) return;
    const {action,id} = button.dataset;
    try {
      if(action==='close') return close();
      if(action==='guide') return guide();
      if(action==='role') { const role = E.roles.find(r => r.id === id); if (!role) return; introEvidence = []; introPriorities = []; game = E.create(id, []); view='game'; render(); window.scrollTo(0,0); return introAnalysis(); }
      if(action==='restart') { close(); if(rolling) return; game = null; introEvidence = []; introPriorities = []; view='setup'; render();window.scrollTo(0,0);return; }
      if(action==='resume'||action==='game') { close(); if(!game){view='setup';} else view=game.completed?'report':'game'; render();window.scrollTo(0,0);return; }
      if(!game) return;
      if(action==='intro-evidence') { introEvidence = introEvidence.includes(id) ? introEvidence.filter(x => x !== id) : [...introEvidence, id]; return introAnalysis(); }
      if(action==='intro-priority') { if (introPriorities.includes(id)) introPriorities = introPriorities.filter(p => p !== id); else if (introPriorities.length < 2) introPriorities.push(id); else return toast('請先取消一項，再選新的優先需求。'); return introAnalysis(); }
      if(action==='intro-confirm') { if (introPriorities.length !== 2 || !introEvidence.length) return; game.evidence = [...introEvidence]; game.selectedPriorities = [...introPriorities]; close(); render(); return; }
      if(action==='journal') { return journalDialog(); }
      if(action==='policy') {
        const p=E.products.find(p=>p.id===id), target=game.client.policies[id]+Number(button.dataset.delta);
        if(target<game.client.policies[id] && ['investment','annuity'].includes(id)) { const account=game.client[id==='investment'?'investAccount':'annuityAccount']; if(account>0) { const amount=Math.round(account/game.client.policies[id]); return dialog('調整前，先看解約成本。', `<p class="event-description">${p.name}減少一單位，會按比例提領帳戶並收取 5% 解約費。</p>${row('提領帳戶',money(amount))}${row('解約費',money(Math.round(amount*.05)))}${row('加入現金',money(amount-Math.round(amount*.05)))}`, '調整前確認', `<button class="secondary" data-action="planning">保留配置</button><button class="primary" data-action="policy-confirm" data-id="${id}" data-units="${target}">確認調整 →</button>`); } }
        E.setPolicy(game,id,target);renderGame();planning(); document.querySelector(`[data-action="policy"][data-id="${id}"][data-delta="${button.dataset.delta}"]`)?.focus({preventScroll:true});return;
      }
      if(action==='policy-confirm') { E.setPolicy(game,id,Number(button.dataset.units));renderGame();planning();return; }
      if(action==='terms') { const p=E.products.find(p=>p.id===id), t=TERMS_PLAIN[id]||{plain:'',example:''};
        let example = t.example;
        if (id==='annuity' && game) { const rp = E.retirement(game.client); example = `以你目前 ${game.client.age} 歲、年金 ${game.client.policies.annuity} 單位試算，65 歲時帳戶約 ${wan(rp.account)}，換算每年約領 ${wan(rp.annuity)} 元。`; }
        return dialog(p.name+' · '+p.type, `<span class="tag">${p.group}</span><p class="event-description" style="margin-top:15px">${p.terms}</p><div class="plain-box"><h3>AI 白話解釋</h3><p>${t.plain}</p><div class="plain-example"><b>生活例子</b><p>${example}</p></div></div>${row('每單位年繳',money(p.premium)+' 元')}${row('最多單位',p.max)}<div class="explanation">規劃階段調整後，在本回合事件前生效；不保障已發生事件。這是簡化的虛構教學契約。</div>`, '契約條款', '<button class="secondary" data-action="planning">返回保險規劃</button>'); }
      if(action==='planning') return planning();
      if(action==='roll') return doRoll();
      if(action==='event') { if (walking) return; return showEvent(); }
      if(action==='history') return showEvent(Number(button.dataset.round));
      if(action==='answer') { E.answer(game,Number(button.dataset.index));showEvent();document.querySelector('.quiz-answer')?.scrollIntoView({block:'nearest'});return; }
      if(action==='next') { E.next(game);close();view=game.completed?'report':'game';render();window.scrollTo(0,0); return; }
      if(action==='assessment') { E.recordAssessment(game,id,Number(button.dataset.index));renderReport();return; }
      if(action==='retry-coach') return mountCoach(view==='report', true);
      if(action==='metric') return metricDetail(id);
      if(action==='scoring') return scoringDetail();
      if(action==='client') { const s=game.client;return dialog(s.name+'的完整客戶卡', `${row('職業 / 年齡',s.job+' / '+s.age+' 歲')}${row('初始家庭',esc(game.initialRole.family))}${row('目前扶養對象',s.dependents+' 人')}${row('年工作收入',money(s.alive?s.income:0))}${row('年生活支出',money(s.expense))}${row('一般投資',money(s.investments))}${row('房產',money(s.property))}${row('剩餘負債',money(s.debt))}${row('累計還款本金',money(s.principalPaid))}${row('累計緊急借款',money(s.shortfall))}${row('既有退休年收入假設',money(s.pension))}${row('可用現金',money(s.cash))}${initialNotes()}`, 'CLIENT PROFILE'); }
      if(action==='report') { close();view='report';render();window.scrollTo(0,0);return; }
      if(action==='export') return exportGame();
    } catch(error) { toast(error.message||'操作未完成，請再試一次。'); }
  });
  modal.addEventListener('click',event=>{ if (modalLocked) return; if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  window.addEventListener('pageshow',()=>{if(game && !rolling) render();});
  render();
})();
