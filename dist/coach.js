/* The model selects verified evidence. Amounts, scores and displayed observations come from the engine. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./academy-engine.js'));
  else root.LifeCoach = factory(root.Academy);
})(globalThis, function (E) {
  const value = n => Math.round(n).toLocaleString('zh-TW') + ' 元';
  const groups = ['risks', 'strengths', 'weaknesses'];
  function candidates(g, final) {
    const pool = { risks: [], strengths: [], weaknesses: [] };
    const add = (group, round, kind, text) => pool[group].push({ id: round + '-' + kind, round, text });
    const round = Math.min(6, g.round + (g.phase === 'planning' ? 1 : 0));
    const s = g.client, m = E.metrics(s);
    if (s.alive && m.gap > 0) add('risks', round, 'family-shortfall', '依五年支出假設，現有身故保障仍差 ' + value(m.gap) + '。可核對剩餘負債與扶養支出。');
    if (s.alive && s.policies.health < 2) add('risks', round, 'hospital', '若住院支出 10 萬元，目前配置需自付 ' + value(100000 - E.claimEstimate(s, 'hospital', 100000)) + '。');
    if (s.alive && !s.policies.accident) add('risks', round, 'accident', '目前沒有意外險，若意外門診花 6 萬元，將由客戶全額負擔。');
    add('risks', round, 'reserve', '以目前保費與必要支出估算，現金可支應 ' + m.reserve.toFixed(1) + ' 個月。' + (m.reserve < 6 ? '低於本局六個月的緩衝目標。' : '檢查長期收入中斷時的資金來源。'));
    // Round-stage context: react to the last event, the chosen priorities and the latest adjustments.
    const last = g.records[g.records.length - 1];
    if (last) add('risks', round, 'last-event', '上回合「' + last.event.subtitle + '」損失 ' + value(last.actual.loss) + '、給付 ' + value(last.actual.claim) + '、自付 ' + value(Math.max(0, last.actual.outOfPocket)) + '。');
    if (m.flow < 0) add('risks', round, 'flow-negative', '目前年度現金流為 ' + value(m.flow) + '，長期恐難持續，先檢查保費配置。');
    const needChecks = [
      ['medical', s.alive && !s.policies.health, '你開局把「醫療風險」列為優先，但目前住院支出仍全額自付。'],
      ['family', s.alive && m.gap > 0, '你開局關注家庭保障，依五年支出假設仍差 ' + value(m.gap) + '。'],
      ['accident', s.alive && !s.policies.accident, '你開局關注工作意外，但目前沒有配置意外險。'],
      ['liquidity', m.reserve < 6, '你開局關注緊急預備金，目前現金只夠 ' + m.reserve.toFixed(1) + ' 個月。'],
      ['retirement', m.retirement.ratio < 1, '你開局關注退休現金流，目前退休準備度約 ' + Math.round(m.retirement.ratio * 100) + '%。']
    ];
    for (const [p, hit, text] of needChecks) if (hit && g.selectedPriorities.includes(p)) add('risks', round, 'need-' + p, text);
    for (const d of g.decisions.filter(d => d.round === round)) {
      const product = E.products.find(x => x.id === d.product);
      if (d.to > d.from && d.afterFlow >= 0) add('strengths', round, 'adjust-' + d.product, '你把「' + (product ? product.name : d.product) + '」調到 ' + d.to + ' 單位，年度現金流仍有 ' + value(d.afterFlow) + '。');
      else if (d.to > d.from) add('risks', round, 'adjust-' + d.product, '「' + (product ? product.name : d.product) + '」調到 ' + d.to + ' 單位後，年度現金流變成 ' + value(d.afterFlow) + '。');
    }
    if (!final) return pool;
    for (const r of g.records) {
      const m0 = r.metricsBefore, p = r.policies;
      if (m0.flow >= 0 && m0.reserve >= 6) add('strengths', r.round, 'budget', '按事件前配置，年度收支餘額為 ' + value(m0.flow) + '，現金能支應 ' + m0.reserve.toFixed(1) + ' 個月。');
      if (m0.flow < 0 || m0.reserve < 6) add('weaknesses', r.round, 'budget', '事件前年度收支餘額為 ' + value(m0.flow) + '，現金能支應 ' + m0.reserve.toFixed(1) + ' 個月；調整年繳前要先核對流動性。');
      if (!r.actual.income && r.metricsBefore.need === 0) continue;
      if (g.selectedPriorities.includes('medical') && p.health) add('strengths', r.round, 'medical', '開局關注醫療，本回合配置 ' + p.health + ' 單位健康險，住院給付上限為 ' + value(p.health * 80000) + '。');
      if (r.actual.claim > r.baseline.claim) add('strengths', r.round, 'payout', '在「' + r.event.title + '」中，新增保單比只保留既有保障多給付 ' + value(r.actual.claim-r.baseline.claim) + '。');
      if (m0.gap > 0) add('weaknesses', r.round, 'gap', '依教學假設，事件前仍有 ' + value(m0.gap) + ' 的身故保障缺口，應與家庭承擔能力一起檢視。');
      if (!p.health) add('weaknesses', r.round, 'hospital', '本回合未配置住院保障，疾病住院支出須由可用資金支應。');
      if (g.selectedPriorities.includes('accident') && !p.accident) add('weaknesses', r.round, 'accident', '開局關注工作意外，但本年度配置未包含意外險。');
      for (const d of g.decisions.filter(d => d.round === r.round && d.to !== d.from && d.to === p[d.product])) {
        const name = E.products.find(x => x.id === d.product).name;
        if (d.to > d.from && d.afterFlow >= 0) add('strengths', r.round, 'adjust-' + d.product, '調高「' + name + '」至 ' + d.to + ' 單位後，年度現金流仍為 ' + value(d.afterFlow) + '。');
      }
    }
    return pool;
  }
  function resolve(pool, selection, stage, mode) {
    if (!selection || Object.keys(selection).sort().join() !== [...groups].sort().join()) throw Error('欄位不符');
    const result = { schemaVersion: 1, stage, mode };
    for (const key of groups) {
      const ids = selection[key];
      if (!Array.isArray(ids) || ids.length > 3 || (pool[key].length && !ids.length) || new Set(ids).size !== ids.length) throw Error('證據清單無效');
      result[key] = ids.map(id => {
        const fact = pool[key].find(item => item.id === id);
        if (!fact) throw Error('回合證據無效');
        return { evidenceId: id, round: fact.round, observation: fact.text, insight: null };
      });
    }
    return result;
  }
  // Fallback ordering: contextual evidence (last event, unmet priority, latest adjustment) first.
  const kindRank = id => {
    const kind = id.slice(id.indexOf('-') + 1);
    if (kind === 'last-event' || kind === 'flow-negative') return 0;
    if (kind.startsWith('need-')) return 1;
    if (kind.startsWith('adjust-')) return 2;
    return 9;
  };
  function rules(pool, stage) {
    const ids = {};
    for (const key of groups) {
      const used = new Set();
      ids[key] = pool[key].slice().sort((a, b) => kindRank(a.id) - kindRank(b.id)).filter(x => {
        const kind = x.id.slice(x.id.indexOf('-') + 1);
        if (used.has(kind)) return false;
        used.add(kind); return true;
      }).slice(0, 3).map(x => x.id);
    }
    return resolve(pool, ids, stage, 'rules');
  }
  function requestData(g, pool, stage) {
    return { stage, role:g.roleId, needs:g.selectedPriorities, evidence:g.evidence,
      client:{age:g.client.age, dependents:g.client.dependents, cash:g.client.cash, debt:g.client.debt, policies:g.client.policies},
      actions:g.decisions.slice(-60).map(d => [d.round,d.product,d.from,d.to,d.afterFlow]),
      rounds:g.records.map(r => [r.round,r.event.id,r.policies,r.actual.loss,r.actual.claim,r.actual.paid]),
      candidates:pool };
  }
  function fromModel(pool, raw, stage) {
    if (!raw || Object.keys(raw).sort().join() !== [...groups].sort().join()) throw Error('復盤格式錯誤');
    const ids = {};
    for (const k of groups) {
      if (!Array.isArray(raw[k])) throw Error('復盤格式錯誤');
      ids[k] = raw[k].map(x => {
        if (!x || typeof x.insight !== 'string' || !x.insight.trim() || x.insight.length > 220) throw Error('解說內容無效');
        return x.evidenceId;
      });
    }
    const result = resolve(pool, ids, stage, 'llm');
    for (const k of groups) result[k].forEach((x,i) => { x.insight = raw[k][i].insight; });
    return result;
  }
  return { candidates, rules, resolve, requestData, fromModel };
});
