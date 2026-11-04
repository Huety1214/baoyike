/* Browser view only. All financial and claim calculations live in academy-engine.js. */
(() => {
  'use strict';
  const E = window.Academy, app = document.querySelector('#app'), modal = document.querySelector('#modal'), content = document.querySelector('#modal-content');
  const KEY = 'baoyike-academy-v1', money = n => Math.round(n).toLocaleString('zh-TW'), wan = n => (n / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + ' 萬', pct = n => Math.round(n * 100) + '%';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const signed = n => (n > 0 ? '+' : '') + money(n), row = (label, value, cls = '') => `<div class="data-row"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
  let game = null, selectedRole = null, selectedPriorities = [], initialJudgments = [], view = 'setup', rolling = false, toastTimer, storageWarning = false;
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && E.validSave(saved)) { game = saved; view = game.completed ? 'report' : 'game'; } } catch { /* A broken or blocked save never prevents a new game. */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(game)); } catch { if (!storageWarning) { toast('此瀏覽器無法保存進度；仍可遊玩並匯出紀錄。'); storageWarning = true; } } }
  function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
  function dialog(title, body, eyebrow = 'LIFE QUEST', actions = '') {
    content.innerHTML = `<div class="modal-body"><div class="modal-top"><div><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2></div><button class="icon-btn" data-action="close" aria-label="關閉對話框">×</button></div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ''}</div>`;
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
  }
  function close() { modal.close(); }
  function render() {
    if (view === 'setup') renderSetup(); else if (view === 'report') renderReport(); else renderGame();
  }
  function renderSetup() {
    app.innerHTML = `<section class="onboarding">${game ? `<div class="resume-banner"><div>一段人生，還在進行中。<small>${esc(game.client.name)} · ${esc(game.client.job)} · 已完成 ${game.round} / 6 回合。開始新局前，原進度仍會保留。</small></div><button class="secondary" data-action="resume">返回進度 →</button></div>` : ''}
      <div class="setup-heading"><h1>選擇客戶</h1><span>四位角色 · 每局六回合</span></div>
      <div class="role-grid" role="group" aria-label="選擇模擬客戶">${E.roles.map(r => `<button class="role-card ${r.color} ${r.id === selectedRole ? 'selected' : ''}" data-action="role" data-id="${r.id}" aria-pressed="${r.id === selectedRole}"><span class="role-radio">${r.id === selectedRole ? '✓' : ''}</span><div class="avatar" aria-hidden="true">${r.icon}</div><h3>${r.name}<small>${r.job}</small></h3><p class="role-detail">${r.age} 歲 · ${r.family}</p><div class="divider"></div>${row('年收入', wan(r.income))}${row('年生活費', wan(r.expense))}${row('現金 / 負債', `${wan(r.cash)} / ${wan(r.debt)}`)}</button>`).join('')}</div>
      ${selectedRole ? `<section class="analysis-panel panel" id="assessment"><div>
        <h2>${E.roles.find(r => r.id === selectedRole).name}的哪些需求值得優先關注？</h2>
        <p>依上方資料選兩項（${selectedPriorities.length} / 2）</p>
        <div class="priority-choices">${choices(E.priorities, selectedPriorities, 'priority')}</div></div>
        <div><h2>你的初步判斷是什麼？</h2><p>至少選一項，可複選。勾選內容會存入開局紀錄。</p>
        <div class="judgment-list">${choices(E.judgments, initialJudgments, 'judgment')}</div></div></section>` : ''}
      <div class="start-bar"><button class="secondary" data-action="guide">玩法指南</button>
      <button class="primary" data-action="start" ${selectedPriorities.length !== 2 || !initialJudgments.length ? 'disabled' : ''}>開始遊戲 →</button></div></section>`;
  }
  function choices(options, selection, action) {
    return Object.entries(options).map(([id, label]) => {
      const active = selection.includes(id);
      return `<button class="priority-choice ${active ? 'selected' : ''}" aria-pressed="${active}" data-action="${action}" data-id="${id}">${active ? '✓ ' : ''}${label}</button>`;
    }).join('');
  }
  function initialNotes() {
    const labels = [...game.selectedPriorities.map(id => E.priorities[id]), ...(game.initialJudgments || []).map(id => E.judgments[id])];
    return `<div class="priority-box"><h4>開局判斷</h4><ul>${labels.map(label => `<li>${esc(label)}</li>`).join('')}</ul>${game.rationale ? `<p>${esc(game.rationale)}</p>` : ''}</div>`;
  }
  function metric(label, value, detail, id, icon = '↗', cls = '') { return `<button class="metric" data-action="metric" data-id="${id}" aria-label="${label}：${value}。查看計算依據"><span class="metric-title">${label}</span><span class="metric-icon">${icon}</span><strong class="${cls}">${value}</strong><small>${detail}</small></button>`; }
  function tiles() {
    const positions = [];
    for (let x = 1; x <= 6; x++) positions.push([1, x]);
    for (let y = 2; y <= 5; y++) positions.push([y, 6]);
    for (let x = 6; x >= 1; x--) positions.push([6, x]);
    for (let y = 5; y >= 2; y--) positions.push([y, 1]);
    const icons = { life: '✿', risk: '♡', market: '↗', contract: '▤' }, labels = { life: '人生', risk: '風險', market: '市場', contract: '契約' };
    return positions.map(([y,x], i) => { const c = E.tileCategory(i); return `<div class="tile ${c} ${i === game.position ? 'current' : ''}" style="grid-area:${y}/${x}" aria-label="第 ${i + 1} 格 ${E.categories[c]}${i === game.position ? '，目前位置' : ''}"><b class="tile-num">${String(i + 1).padStart(2, '0')}</b><span aria-hidden="true">${i === 0 ? '⌂' : icons[c]}</span><small>${labels[c]}</small></div>`; }).join('');
  }
  function renderGame() {
    if (!game) { view = 'setup'; return renderSetup(); }
    const s = game.client, m = E.metrics(s), pending = game.pending;
    const checks = [{ pass: m.flow >= 0, text: m.flow >= 0 ? '年度收支足以支應目前保費' : '保費已使年度收支出現缺口' }, { pass: m.reserve >= 6, text: `現金預備金約 ${m.reserve.toFixed(1)} 個月` }, { pass: m.gap === 0, text: m.gap ? `家庭保障還有 ${wan(m.gap)}缺口` : '身故保障已涵蓋估計家庭需求' }];
    app.innerHTML = `<header class="play-toolbar"><div class="client-summary"><h1>${s.name}<small>${s.alive ? s.job + ' · ' + s.age + ' 歲' : '家屬接續'}</small></h1><button class="small-link" data-action="client">客戶資料 ↗</button></div>
      <button class="primary" data-action="planning">保險規劃</button></header><div class="workspace">
    <section class="center-column"><div class="metrics-grid" aria-label="財務與保障儀表板">${metric('年度現金流', signed(m.flow), '收入－生活－還款－年繳', 'flow', '↗', m.flow < 0 ? 'negative' : '')}${metric('家庭保障缺口', wan(m.gap), '點擊查看估算依據', 'gap', '♡', m.gap ? 'negative' : '')}${metric('財務韌性', m.reserve.toFixed(1) + ' 個月', '現金預備金・目標 6 個月', 'reserve', '◎')}${metric('淨資產', wan(m.net), '含資產與保單帳戶－負債', 'net', '▥')}${metric('退休準備度', pct(m.retirement.ratio), '退休收入／退休生活支出', 'retirement', '◷')}${metric('年度保費與投入', wan(m.premium), '含保障、投資與年金投入', 'premium', '◇')}</div>
      ${s.insolvent ? '<div class="status-note">曾出現支付缺口：系統已先變現一般投資，再將不足額記為緊急借款。請檢查現金流與負債。</div>' : ''}
      <section class="panel board-panel"><div class="board-label"><h2>人生棋盤 <span class="eyebrow">THE JOURNEY</span></h2><span class="round-tag">第 ${Math.min(game.round + (game.phase === 'planning' ? 1 : 0), 6)} / 6 回合</span></div><div class="board">${tiles()}<div class="board-center"><div class="dice ${rolling ? 'rolling' : ''}" aria-label="骰子 ${game.dice} 點">${['⚀','⚁','⚂','⚃','⚄','⚅'][game.dice - 1]}</div><button class="primary" data-action="${pending ? 'event' : 'roll'}" ${rolling ? 'disabled' : ''}>${rolling ? '擲骰中…' : pending ? '查看本回合結算' : '擲骰'}</button></div></div><div class="legend"><span><i class="risk"></i>風險事件</span><span><i class="market"></i>市場事件</span><span><i class="life"></i>人生事件</span><span><i></i>契約事件</span></div></section>
    </section><aside class="right-column">${riskPanel(s)}<section class="panel coach-panel"><div class="coach-label"><span class="coach-icon">✧</span><div><h2>你的決策教練</h2><small>規則回饋 · 尚未串接 LLM</small></div></div><div class="coach-hero"><h3>${m.gap > 0 ? '先看見缺口，<br>再選擇能接住它的保障。' : '保障的價值，<br>是讓生活能夠繼續。'}</h3><p>${m.gap > 0 ? '客戶有家庭責任與負債。保單多，不代表需求都被照顧到了。' : '下一步檢查醫療、現金緩衝與退休。每份配置，都要能長期負擔。'}</p></div><ul class="checklist">${checks.map(c => `<li><span class="check-circle ${c.pass ? '' : 'warn'}">${c.pass ? '✓' : '!'}</span><span>${c.text}</span></li>`).join('')}</ul><button class="secondary full" data-action="coach">查看規劃回饋 ↗</button><button class="small-link" data-action="report">${game.completed ? '查看學習成果' : '查看階段回顧'} ↗</button></section><section class="panel journal-panel"><div class="journal-head"><h2>人生手帳</h2><small>${game.records.length ? game.records.length + ' 段經歷' : '等待第一個故事'}</small></div>${game.records.length ? [...game.records].reverse().map(r => `<button class="journal-entry" data-action="history" data-round="${r.round}"><span class="journal-dot">${r.event.icon}</span><div><small>ROUND ${String(r.round).padStart(2,'0')}${r.scheduled ? ' · 必修情境' : r.teaching ? ' · 指定演練' : ''}</small><h4>${r.event.subtitle}</h4><p>${r.actual.claim ? '契約給付 ' + wan(r.actual.claim) : r.actual.marketChange ? '市場損益 ' + wan(r.actual.marketChange) : '本次損失 ' + wan(r.actual.loss)}</p></div></button>`).join('') : '<div class="empty-journal"><span>▤</span><p>還沒發生的故事，<br>從你的第一份規劃開始。</p></div>'}<button class="small-link" data-action="export">匯出決策紀錄 ↓</button></section></aside></div>`;
  }
  function riskPanel(client) {
    const scenarios = [
      ['疾病住院', 'hospital', 100000],
      ['意外門診', 'accident', 60000]
    ];
    return `<section class="panel risk-panel"><div class="eyebrow">RISK CHECK</div><h2>風險由誰承擔？</h2>
      <p class="section-subtitle">用目前的保單試算，金額不計入本局。</p>
      ${scenarios.map(([title, kind, loss]) => {
        const claim = E.claimEstimate(client, kind, loss);
        return `<div class="risk-case"><h3>${title}<small>支出 ${wan(loss)}</small></h3>
          <div class="risk-meter" aria-hidden="true"><i style="width:${claim / loss * 100}%"></i></div>
          ${row('保單給付', wan(claim), 'positive')}${row('自行負擔', wan(loss - claim))}</div>`;
      }).join('')}</section>`;
  }
  function planning() {
    const s = game.client, m = E.metrics(s), locked = game.phase !== 'planning' || rolling;
    dialog('保險規劃', `<p class="section-subtitle">${locked || !s.alive ? '目前僅供查看。' : '調整立即儲存，本回合擲骰前生效。'}</p><div class="products">${E.products.map(p => `<article class="product"><div class="product-icon" aria-hidden="true">${p.icon}</div><div><h3>${p.name}<small>${p.type}</small></h3><p>${p.description}</p><div class="product-bottom"><strong>NT$ ${money(p.premium)} <small>/ 年 / 單位</small></strong><button class="terms-btn" data-action="terms" data-id="${p.id}">查看條款 ↗</button></div></div><div class="stepper"><button data-action="policy" data-id="${p.id}" data-delta="-1" aria-label="減少${p.name}" ${locked || s.policies[p.id] === 0 || !s.alive ? 'disabled' : ''}>−</button><strong aria-label="${p.name} ${s.policies[p.id]} 單位">${s.policies[p.id]}</strong><button data-action="policy" data-id="${p.id}" data-delta="1" aria-label="增加${p.name}" ${locked || s.policies[p.id] >= p.max || !s.alive ? 'disabled' : ''}>＋</button></div></article>`).join('')}</div><div class="budget-line"><span>年繳佔收入 ${s.alive && s.income ? pct(m.premium / s.income) : '—'} · 當回合收取全年費用</span><strong class="${m.flow < 0 ? 'negative' : ''}">年餘額 ${signed(m.flow)}</strong></div>`, '本年度保單', '<button class="primary" data-action="close">返回棋盤</button>');
  }
  function compare(r) {
    return `<div class="counterfactual"><h3>同一事件，兩條財務路徑</h3><div class="compare-grid"><div class="compare-box"><small>從開局起未投保</small><strong>${wan(r.baseline.after.net)}</strong><small>事件後淨資產</small>${row('本次給付', wan(r.baseline.claim))}</div><div class="compare-box with"><small>你的實際規劃</small><strong>${wan(r.actual.after.net)}</strong><small>事件後淨資產</small>${row('本次給付', wan(r.actual.claim))}</div></div><p class="fine-print">兩條路徑採同一組人生與市場事件，分別累積收支、保費、費用、還款與帳戶價值。未投保路徑保留原本可用於保費的現金，不另假設再投資。只計本局保費與費用，不含既有已繳清保單的歷史成本。淨資產差不等於保險投資報酬；保障的重點是風險轉移。</p></div>`;
  }
  function showEvent(historyRound) {
    const historic = Number.isInteger(historyRound), r = historic ? game.records.find(r => r.round === historyRound) : game.pending;
    if (!r) return;
    const a = game.answers.find(a => a.round === r.round), q = r.quiz;
    dialog(r.event.title, `<span class="event-badge ${r.event.category}">${E.categories[r.event.category]} · ${r.event.subtitle}</span><p class="event-description" style="margin-top:15px">${r.event.description}</p><div class="ledger"><article><small>事件損失</small><strong>${money(r.actual.loss)}</strong></article><article><small>契約給付</small><strong class="positive">${money(r.actual.claim)}</strong></article><article><small>${r.event.kind === 'death' ? '給付扣除事件費用' : '本次自付'}</small><strong class="${r.actual.outOfPocket > 0 ? 'negative' : 'positive'}">${money(r.event.kind === 'death' ? -r.actual.outOfPocket : r.actual.outOfPocket)}</strong></article></div>${r.actual.marketChange ? `<div class="explanation">市場帳戶損益 ${signed(r.actual.marketChange)} 元；市場跌幅不屬於健康或意外險理賠。</div>` : ''}<div class="explanation"><strong>${r.actual.policy}</strong><br>${r.actual.reason}</div>${row('本回合年繳（含投入）', money(r.actual.paid))}${row('其中保障險保費', money(r.actual.protection))}${row('其中帳戶費用與保障成本', money(r.actual.fees))}${compare(r)}<details class="quiz" ${a ? 'open' : ''}><summary>契約觀念練習（選答）</summary><h3>${q.question}</h3><div class="quiz-options">${q.options.map((o,i) => `<button class="quiz-option ${a && i === q.correct ? 'correct' : a && i === a.index ? 'incorrect' : ''}" data-action="answer" data-index="${i}" ${a || historic ? 'disabled' : ''}><b>${String.fromCharCode(65+i)}</b>${o}</button>`).join('')}</div>${a ? `<p class="quiz-answer">${a.correct ? '✓ 判斷正確。' : '這裡可以再想一想。'} ${q.explanation}</p>` : historic ? `<p class="fine-print">本回合未作答。</p>` : ''}</details>`, `ROUND ${String(r.round).padStart(2,'0')} · ${r.scheduled ? '必修情境' : r.teaching ? '指定演練' : E.categories[r.event.category]}`, historic ? '<button class="secondary" data-action="close">返回棋盤</button>' : `<button class="primary" data-action="next">${game.round === 6 ? '查看六回合結算' : '下一回合'} →</button>`);
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
    const d = details[id]; if (d) dialog(d[0], d[1], 'SHOW THE MATH · 計算依據');
  }
  function coach() {
    dialog('讓每一份配置，都有理由。', `<span class="mini-badge">規則教練 · 非 LLM 生成</span><ul class="coach-lines">${E.feedback(game).map(l => `<li>${l}</li>`).join('')}</ul><p class="fine-print">回饋由可重現的條件模板產生。財務計算、理賠與分數均由規則引擎負責；未將資料傳給外部 AI。</p>`, 'YOUR DECISION COACH');
  }
  function renderReport() {
    const s = game.client, m = E.metrics(s), b = E.metrics(game.baseline), scoring = E.score(game), st = scoring.stress;
    app.innerHTML = `<section class="report-page"><div class="report-heading"><span class="intro-badge">${game.completed ? 'YOUR LEARNING JOURNEY' : 'MID-GAME REVIEW'}</span><h1>${game.completed ? '每一次選擇，都讓你更接近專業。' : '停一下，看看目前的規劃。'}</h1><p>${s.name} · ${s.job} · ${game.round} / 6 回合 · ${game.completed ? '學習成果報告' : '階段回顧，尚非最終成績'}</p></div><div class="report-grid"><section class="panel score-card"><span class="eyebrow">理專學習成果</span><div class="score-number">${scoring.total}<small> / 100</small></div><p>看規劃品質，也看你的理解。<br>不以資產最多或理賠最多決定勝負。</p><div class="score-items">${scoring.items.map(i => `<div class="score-item">${row(i.label, `${i.score} / ${i.max}`)}<div class="bar"><span style="width:${i.score/i.max*100}%"></span></div></div>`).join('')}</div><button class="small-link" data-action="scoring">查看完整評分依據 ↗</button></section><section class="panel outcomes"><span class="eyebrow">人生財務成果</span><h2>財務的結果，與決策分開看。</h2><div class="detail-grid"><div class="detail-card"><h3>期末淨資產</h3><strong>${wan(m.net)}</strong><p>無保險路徑 ${wan(b.net)}</p></div><div class="detail-card"><h3>現金預備金</h3><strong>${m.reserve.toFixed(1)} 個月</strong><p>年度現金流 ${signed(m.flow)}</p></div><div class="detail-card"><h3>身故保障缺口</h3><strong class="${m.gap ? 'negative' : ''}">${wan(m.gap)}</strong><p>估計家庭需求 ${wan(m.need)}</p></div><div class="detail-card"><h3>退休準備度</h3><strong>${pct(m.retirement.ratio)}</strong><p>條件式收入試算</p></div></div><div class="divider"></div>${row('累計年繳（含投資與年金投入）', wan(s.premiumsPaid))}${row('其中保障險保費', wan(s.protectionCosts))}${row('另計帳戶費用與保障成本', wan(s.fees))}${row('累計契約給付', wan(s.claims))}${row('投資型與年金剩餘帳戶', wan(s.investAccount+s.annuityAccount))}<p class="fine-print">帳戶費用已從年繳或帳戶扣除，不在此再次扣款。無保險路徑不含既有壽險。已發生支付缺口 ${wan(s.shortfall)}，按規則列入負債。</p></section></div><section class="panel report-section"><div class="coach-label"><span class="coach-icon">✧</span><div><h2>決策教練的回饋</h2><small>透明規則產生 · 尚未串接 LLM</small></div></div><ul class="coach-lines">${E.feedback(game).map(l=>`<li>${l}</li>`).join('')}</ul>${initialNotes()}</section><section class="panel report-section"><span class="eyebrow">FIXED STRESS TESTS</span><h2>把同一份規劃，放進三種壓力。</h2><div class="stress-grid">${[{title:'失業六個月',data:st.unemployment,note:'可用現金＋一般投資 − 半年必要支出'}, {title:'重大醫療支出 50 萬',data:st.medical,note:'可用現金＋一般投資 − 扣理賠後醫療費'}, {title:'家庭收入永久中斷',data:st.death,note:'有效身故保障 − 負債及五年家庭生活費'}].map(t=>`<div class="stress-card"><h3>${t.title}</h3><p>${t.note}</p><strong class="${t.data.remaining<0?'negative':'positive'}">${t.data.remaining<0?'缺口 ':'餘裕 '}${wan(Math.abs(t.data.remaining))}</strong><p>需求 ${wan(t.data.required)} · 可用 ${wan(t.data.available)}</p></div>`).join('')}</div><p class="fine-print">使用目前狀態做相同壓力測試，不再抽機率；家庭責任的情境也採相同五年支出假設。此處呈現財務韌性，不增加或扣除原局資產。</p></section><section class="panel report-section"><h2>回顧每一個轉彎。</h2><div class="table-wrap"><table><thead><tr><th>回合</th><th>人生情境</th><th>年繳</th><th>契約給付</th><th>事件後淨資產</th><th>觀念題</th></tr></thead><tbody>${game.records.map(r=>`<tr><td>${r.round}</td><td><button class="small-link" data-action="history" data-round="${r.round}">${r.event.subtitle}</button></td><td>${wan(r.actual.paid)}</td><td>${wan(r.actual.claim)}</td><td>${wan(r.actual.after.net)}</td><td>${game.answers.find(a=>a.round===r.round)?.correct?'✓':'—'}</td></tr>`).join('')}</tbody></table></div></section><div class="report-actions">${game.completed ? '' : '<button class="secondary" data-action="resume">返回人生棋盤</button>'}<button class="secondary" data-action="export">下載完整決策紀錄 JSON ↓</button><button class="primary" data-action="restart">再練習一種人生 →</button></div></section>`;
  }
  function scoringDetail() {
    const result = E.score(game);
    dialog('分數可追溯，決策才能改善。', `<p class="event-description">每回合把你的保單配置放回同一個初始客戶作為標準情境，再平均評估。隨機事件的理賠金與期末資產不直接計分。</p>${result.items.map(i=>`<div class="priority-box"><h4>${i.label} · ${i.score} / ${i.max}</h4><p>${i.detail}</p></div>`).join('')}<p class="fine-print">需求分析以角色預設的兩項優先需求評估；勾選的開局判斷另行保存。契約理解按已作答題的正確率。這是一套可檢查的 MVP 教學規則，尚未經正式教學成效驗證。</p>`, 'DETERMINISTIC SCORING');
  }
  function guide() {
    dialog('玩法指南', `<ol class="guide-list">
      <li><strong>認識客戶。</strong> 選一位角色，勾選兩個優先需求和至少一個初步判斷。選擇會存入決策紀錄。</li>
      <li><strong>規劃本年度保單。</strong> 點「保險規劃」調整五類商品，對照年度現金流與風險試算。</li>
      <li><strong>擲骰走棋。</strong> 每回合一年。落點決定風險、市場、人生或契約類別，再從該客戶的牌組隨機抽一張；該類的牌看完前不重複。</li>
      <li><strong>核對結算。</strong> 比較本次給付、自付及兩條財務路徑。事件發生後保單鎖定，下一回合才能調整。</li>
      <li><strong>完成六回合。</strong> 直接查看財務結果、開局判斷及每回合紀錄。若客戶身故，剩餘回合由家屬接續。</li>
      </ol>`, 'LIFE QUEST', '<button class="primary" data-action="close">了解</button>');
  }
  function exportGame() {
    const blob = new Blob([JSON.stringify({ ...game, evaluation: E.score(game), exportedAt: new Date().toISOString(), feedbackMode:'deterministic-rules-no-llm' }, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`life-quest-${game.roleId}-round-${game.round}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000); toast('完整紀錄已匯出。');
  }
  async function doRoll() {
    if (!game || game.phase !== 'planning' || rolling) return;
    close(); rolling = true; renderGame();
    const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); const die = bytes[0] % 6 + 1;
    await new Promise(resolve=>setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches?0:650));
    try { E.roll(game,die); save(); } catch(error) { toast(error.message); }
    rolling = false; renderGame(); showEvent();
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if(!button || button.disabled) return;
    const {action,id} = button.dataset;
    try {
      if(action==='close') return close();
      if(action==='guide') return guide();
      if(action==='role') { if (selectedRole === id) return; selectedRole=id; selectedPriorities=[]; initialJudgments=[]; return renderSetup(); }
      if(action==='priority') { if(selectedPriorities.includes(id)) selectedPriorities=selectedPriorities.filter(p=>p!==id); else if(selectedPriorities.length<2) selectedPriorities.push(id); else return toast('請先取消一項需求，再選擇新的優先需求。'); return renderSetup(); }
      if(action==='judgment') { initialJudgments = initialJudgments.includes(id) ? initialJudgments.filter(j => j !== id) : [...initialJudgments, id]; return renderSetup(); }
      if(action==='start') { if(selectedPriorities.length!==2 || !initialJudgments.length) return; game=E.create(selectedRole,selectedPriorities,initialJudgments); view='game';save();render();window.scrollTo(0,0);return; }
      if(action==='restart') { close(); if(rolling) return; view='setup'; selectedRole=null; selectedPriorities=[];initialJudgments=[];render();window.scrollTo(0,0);return; }
      if(action==='resume'||action==='game') { close(); if(!game){view='setup';} else view=game.completed?'report':'game'; render();window.scrollTo(0,0);return; }
      if(!game) return;
      if(action==='policy') {
        const p=E.products.find(p=>p.id===id), target=game.client.policies[id]+Number(button.dataset.delta);
        if(target<game.client.policies[id] && ['investment','annuity'].includes(id)) { const account=game.client[id==='investment'?'investAccount':'annuityAccount']; if(account>0) { const amount=Math.round(account/game.client.policies[id]); return dialog('調整前，先看解約成本。', `<p class="event-description">${p.name}減少一單位，會按比例提領帳戶並收取 5% 解約費。</p>${row('提領帳戶',money(amount))}${row('解約費',money(Math.round(amount*.05)))}${row('加入現金',money(amount-Math.round(amount*.05)))}`, 'REVIEW YOUR CHANGE', `<button class="secondary" data-action="planning">保留配置</button><button class="primary" data-action="policy-confirm" data-id="${id}" data-units="${target}">確認調整 →</button>`); } }
        E.setPolicy(game,id,target);save();renderGame();planning(); document.querySelector(`[data-action="policy"][data-id="${id}"][data-delta="${button.dataset.delta}"]`)?.focus({preventScroll:true});return;
      }
      if(action==='policy-confirm') { E.setPolicy(game,id,Number(button.dataset.units));save();renderGame();planning();return; }
      if(action==='terms') { const p=E.products.find(p=>p.id===id); return dialog(p.name+' · '+p.type, `<span class="tag">${p.group}</span><p class="event-description" style="margin-top:15px">${p.terms}</p>${row('每單位年繳',money(p.premium)+' 元')}${row('最多單位',p.max)}<div class="explanation">規劃階段調整後，在本回合事件前生效；不保障已發生事件。這是簡化的虛構教學契約。</div>`, 'READ THE CONTRACT', '<button class="secondary" data-action="planning">返回保險規劃</button>'); }
      if(action==='planning') return planning();
      if(action==='roll') return doRoll();
      if(action==='event') return showEvent();
      if(action==='history') return showEvent(Number(button.dataset.round));
      if(action==='answer') { E.answer(game,Number(button.dataset.index));save();showEvent();document.querySelector('.quiz-answer')?.scrollIntoView({block:'nearest'});return; }
      if(action==='next') { E.next(game);close();save();view=game.completed?'report':'game';render();window.scrollTo(0,0); return; }
      if(action==='metric') return metricDetail(id);
      if(action==='coach') return coach();
      if(action==='scoring') return scoringDetail();
      if(action==='client') { const s=game.client;return dialog(s.name+'的完整客戶卡', `${row('職業 / 年齡',s.job+' / '+s.age+' 歲')}${row('初始家庭',esc(game.initialRole.family))}${row('目前扶養對象',s.dependents+' 人')}${row('年工作收入',money(s.alive?s.income:0))}${row('年生活支出',money(s.expense))}${row('一般投資',money(s.investments))}${row('房產',money(s.property))}${row('剩餘負債',money(s.debt))}${row('累計還款本金',money(s.principalPaid))}${row('累計緊急借款',money(s.shortfall))}${row('既有退休年收入假設',money(s.pension))}${row('可用現金',money(s.cash))}${initialNotes()}`, 'CLIENT PROFILE'); }
      if(action==='report') { close();view='report';render();window.scrollTo(0,0);return; }
      if(action==='export') return exportGame();
    } catch(error) { toast(error.message||'操作未完成，請再試一次。'); }
  });
  modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  window.addEventListener('pageshow',()=>{if(game && !rolling) render();});
  render();
})();
