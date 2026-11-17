/* ============================================================
   Algorithm experiment
   ============================================================ */
let expSelected = 'U1';

const EXP_NAMES = {
  U1: '后端 · 杭州', U2: '算法 · 北京', U3: '数据分析 · 上海', U4: 'Java 后端 · 深圳', U5: '前端 · 广州',
  U6: '大模型 · 北京', U7: '数据分析 · 成都', U8: 'Python 后端 · 武汉', U9: 'C++ 后端 · 西安', U10: '算法 · 南京',
};
const EXP_COLORS = { rule: '#2563eb', tfidf: '#7c3aed', hybrid: '#0f766e' };
const EXP_STRATEGY_LABEL = { rule: '规则加权', tfidf: 'TF-IDF', hybrid: '混合策略' };

function renderExperiment() {
  document.body.classList.remove('auth-mode');
  const exp = runExperiment();
  const rows = exp.rows;
  const selected = rows.find((r) => r.profile.id === expSelected) || rows[0];
  const avg = exp.avg;
  const gap = round1(avg.rule.precision - avg.tfidf.precision);

  const root = $('#view');
  root.innerHTML = `
    <div class="exp-hero panel">
      <div class="exp-hero-main">
        <div class="row gap-6" style="margin-bottom:7px"><span class="tag tag-violet">离线实验</span><span class="tag tag-muted">10 个虚拟画像 × 3 种策略</span></div>
        <h2>同一批 400 条岗位，两种推荐逻辑谁更懂求职者？</h2>
        <p>实验不读线上点击日志，也不伪造 Precision。相关性标签采用可复核的启发式口径：<b>岗位城市与画像城市一致，且至少命中 1 项画像技能</b>。A 为规则加权，B 为 TF-IDF 文本相似度，混合策略先按城市过滤再做文本排序。</p>
        <div class="exp-formula">
          <span class="formula"><b>A 规则：</b>0.5×技能 + 0.3×城市 + 0.2×薪资</span>
          <span class="formula"><b>B TF-IDF：</b>cos(画像, JD)×100 · min_df=2</span>
          <span class="formula"><b>混合：</b>城市过滤 → TF-IDF 排序</span>
        </div>
      </div>
    </div>

    <div class="exp-metrics">
      <div class="stat"><div class="stat-label">A · 规则加权</div><div class="stat-value" style="color:${EXP_COLORS.rule}">${avg.rule.precision.toFixed(1)}<small>%</small></div><div class="stat-foot">平均严格 Precision@10</div></div>
      <div class="stat"><div class="stat-label">B · TF-IDF</div><div class="stat-value" style="color:${EXP_COLORS.tfidf}">${avg.tfidf.precision.toFixed(1)}<small>%</small></div><div class="stat-foot">平均严格 Precision@10</div></div>
      <div class="stat"><div class="stat-label">差值 A − B</div><div class="stat-value" style="color:var(--mint)">+${gap.toFixed(1)}<small>pp</small></div><div class="stat-foot">城市硬约束带来的差距</div></div>
      <div class="stat"><div class="stat-label">混合策略</div><div class="stat-value" style="color:${EXP_COLORS.hybrid}">${avg.hybrid.precision.toFixed(1)}<small>%</small></div><div class="stat-foot">城市过滤 + 文本排序</div></div>
    </div>

    <div class="exp-profile-bar">
      <span class="mini-label" style="margin-right:2px">选择画像</span>
      ${rows.map((r) => `<button class="profile-pill ${r.profile.id === selected.profile.id ? 'active' : ''}" data-exp="${r.profile.id}" type="button">${r.profile.id}<b>${esc(EXP_NAMES[r.profile.id] || r.profile.jobType)}</b></button>`).join('')}
      <span class="tag tag-muted" style="margin-left:auto">${icon('database')}400 条岗位 · 每个策略取 Top 10</span>
    </div>

    <div class="exp-grid">
      <div class="chart-card">
        <div class="chart-head"><div><h3>${icon('chart')}各画像严格 Precision@10</h3><p>每个画像取 Top 10，严格相关 = 同城且至少命中 1 项技能。</p></div><span class="chart-note">A vs B vs 混合<br>单位：%</span></div>
        <div class="chart-body">${expGroupedBars(rows, selected.profile.id)}</div>
        <div class="chart-legend"><span><i style="background:${EXP_COLORS.rule}"></i>规则加权</span><span><i style="background:${EXP_COLORS.tfidf}"></i>TF-IDF</span><span><i style="background:${EXP_COLORS.hybrid}"></i>混合策略</span></div>
      </div>

      <div class="chart-card exp-detail">
        <div class="chart-head"><div><h3>${icon('user')}${selected.profile.id} · ${esc(EXP_NAMES[selected.profile.id] || '')}</h3><p>${esc(selected.profile.city)} · ${kFmt(selected.profile.salaryMin)}–${kFmt(selected.profile.salaryMax)} · ${esc(selected.profile.jobType)}</p></div></div>
        <div class="job-skills" style="margin-bottom:12px">${selected.profile.skills.map((s) => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div>
        <div class="strategy-list">
          ${['rule', 'tfidf', 'hybrid'].map((key) => {
            const m = selected[key];
            return `<div class="strategy-row" style="border-color:${hexToRgba(EXP_COLORS[key], .28)}">
              <div class="row" style="justify-content:space-between"><span style="font-size:12px;color:var(--ink-2)">${EXP_STRATEGY_LABEL[key]}</span><b style="font-family:var(--font-num);font-size:17px;color:${EXP_COLORS[key]}">${m.precision.toFixed(0)}<small style="font-size:12px;color:var(--ink-4)">%</small></b></div>
              <div class="progress" style="margin-top:6px;height:4px"><i style="width:${m.precision}%;background:${EXP_COLORS[key]}"></i></div>
              <div class="tiny dim" style="margin-top:5px">严格命中 ${m.strict}/10 · 技能命中 ${m.skillRate.toFixed(0)}% · 城市命中 ${m.cityRate.toFixed(0)}%</div>
              <div class="strategy-jobs">${m.top.slice(0, 3).map((x) => `<button class="mini-job" data-exp-job="${esc(x.job.id)}" data-exp-algo="${key}" type="button"><span>${esc(x.job.title)}</span><b>${x.score.toFixed(0)}</b></button>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        <p class="raw-note" style="margin-top:9px">点击岗位标题可打开详情；分数为当前策略原始分，A 与 B 不同量纲，不直接比较绝对值。</p>
      </div>
    </div>

    <div class="chart-grid" style="margin-bottom:14px">
      <div class="chart-card span6">
        <div class="chart-head"><div><h3>${icon('trend')}Top-N 累计严格命中</h3><p>${selected.profile.id} · 每多取 1 个岗位，累计命中数如何增长。</p></div><span class="chart-note">理想上限 = N<br>曲线越高越好</span></div>
        <div class="chart-body">${expCurve(selected)}</div>
        <div class="chart-legend"><span><i style="background:${EXP_COLORS.rule}"></i>规则</span><span><i style="background:${EXP_COLORS.tfidf}"></i>TF-IDF</span><span><i style="background:${EXP_COLORS.hybrid}"></i>混合</span></div>
      </div>
      <div class="chart-card span6">
        <div class="chart-head"><div><h3>${icon('target')}三策略能力雷达</h3><p>${selected.profile.id} · 严格命中 / 技能命中 / 城市命中，各自归一化到 0–100。</p></div><span class="chart-note">面积不是精度<br>只看形状差异</span></div>
        <div class="chart-body">${expRadar(selected)}</div>
        <div class="radar-legend"><span><i style="background:${EXP_COLORS.rule}"></i>规则</span><span><i style="background:${EXP_COLORS.tfidf}"></i>TF-IDF</span><span><i style="background:${EXP_COLORS.hybrid}"></i>混合</span></div>
      </div>
    </div>

    <div class="chart-card span12" style="margin-bottom:14px">
      <div class="chart-head"><div><h3>${icon('samples')}逐画像指标</h3><p>严格 Precision@10 与技能/城市命中率；城市命中率低是 B 的主要失效模式。</p></div><span class="chart-note">标签口径可复核<br>非线上点击</span></div>
      <div class="table-wrap" style="border:0;background:transparent">
        <table class="data" style="min-width:760px">
          <thead><tr><th>画像</th><th>城市</th><th class="num">A 严格 P@10</th><th class="num">B 严格 P@10</th><th class="num">混合 P@10</th><th class="num">B 技能命中</th><th class="num">B 城市命中</th><th>读法</th></tr></thead>
          <tbody>${rows.map((r) => {
            const note = r.rule.precision - r.tfidf.precision >= 50 ? 'A 明显占优' : r.tfidf.cityRate < 50 ? 'B 城市约束失效' : 'A 略优';
            return `<tr><td><span class="strong">${r.profile.id}</span><span class="cell-sub">${esc(EXP_NAMES[r.profile.id] || r.profile.jobType)}</span></td><td>${esc(r.profile.city)}</td><td class="num" style="color:${EXP_COLORS.rule}">${r.rule.precision.toFixed(0)}%</td><td class="num" style="color:${EXP_COLORS.tfidf}">${r.tfidf.precision.toFixed(0)}%</td><td class="num" style="color:${EXP_COLORS.hybrid}">${r.hybrid.precision.toFixed(0)}%</td><td class="num">${r.tfidf.skillRate.toFixed(0)}%</td><td class="num">${r.tfidf.cityRate.toFixed(0)}%</td><td><span class="tiny dim">${note}</span></td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p class="exp-table-note">U5 前端、U9 C++/Linux 的绝对分偏低，主要因为 400 条样本中对应岗位稀缺（前端 11 条、C++ 29 条），不是策略本身退化；这类样本结构问题应在结论中单独披露。</p>
    </div>

    <div class="exp-conclusions">
      <div class="conclusion"><div class="c-tag">${icon('pin')}发现一</div><h4>城市是硬约束，不是可加权项</h4><p>A 的城市命中率接近 100%，B 平均只有 <b>${avg.tfidf.cityRate.toFixed(0)}%</b>。TF-IDF 把“杭州”当成普通词项，文本相似度不足以压过 JD 里高频的技能词，导致异地岗位挤进 Top 10。</p></div>
      <div class="conclusion"><div class="c-tag">${icon('zap')}发现二</div><h4>B 的技能文本匹配并不弱</h4><p>B 的技能命中率平均 <b>${avg.tfidf.skillRate.toFixed(0)}%</b>，与 A 接近；它的问题在排序目标——文本相似不等于求职相关性。B 更适合做“技能召回”，不适合单独做最终排序。</p></div>
      <div class="conclusion"><div class="c-tag">${icon('layers')}结论</div><h4>混合策略：先约束，再排序</h4><p>城市过滤把候选集收敛到同城，再用 TF-IDF 排序，严格 P@10 达到 <b>${avg.hybrid.precision.toFixed(1)}%</b>。生产上还可叠加技能权重与薪资过滤，形成“规则约束 + 文本召回 + 业务重排”的分层架构。</p></div>
    </div>

    <div class="callout warn" style="margin-top:16px">${icon('alert')}<span><strong>实验边界：</strong>Precision@10 使用启发式相关性标签，只衡量“同城 + 技能命中”，不衡量薪资满意度、成长性、企业偏好；10 个画像是人为设定，不代表真实用户分布。该结果用于说明算法差异，不应外推为线上效果。</span></div>`;

  $$('[data-exp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      expSelected = btn.dataset.exp;
      renderExperiment();
    });
  });
  $$('[data-exp-job]').forEach((btn) => {
    btn.addEventListener('click', () => openJobDrawer(btn.dataset.expJob, { from: 'experiment', profile: selected.profile, profileLabel: selected.profile.id + ' · ' + (EXP_NAMES[selected.profile.id] || selected.profile.jobType), algorithm: btn.dataset.expAlgo === 'rule' ? 'rule' : 'tfidf' }));
  });
  playChartEntrance(root);
}

/* ---------------- charts ---------------- */
function expGroupedBars(rows, selectedId) {
  const W = 760, H = 320, P = { l: 34, r: 10, t: 18, b: 42 };
  const plotW = W - P.l - P.r, plotH = H - P.t - P.b;
  const groupW = plotW / rows.length;
  const barW = Math.min(15, (groupW - 10) / 3);
  const y = (v) => P.t + plotH - (clamp(v, 0, 100) / 100) * plotH;
  const grids = [0, 25, 50, 75, 100].map((v) => `<line x1="${P.l}" y1="${y(v)}" x2="${W - P.r}" y2="${y(v)}" class="grid-line"/><text x="${P.l - 7}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  const selIndex = rows.findIndex((r) => r.profile.id === selectedId);
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="各画像 Precision@10">
    ${selIndex >= 0 ? `<rect x="${P.l + selIndex * groupW + 2}" y="${P.t}" width="${groupW - 4}" height="${plotH}" rx="4" fill="rgba(15,23,42,.035)"/>` : ''}
    ${grids}
    ${rows.map((r, i) => {
      const gx = P.l + i * groupW + groupW / 2;
      const vals = [['rule', r.rule.precision], ['tfidf', r.tfidf.precision], ['hybrid', r.hybrid.precision]];
      return `<g>${vals.map(([key, v], j) => {
        const bx = gx - barW * 1.5 - 1.5 + j * (barW + 1.5);
        const bh = Math.max(1, (clamp(v, 0, 100) / 100) * plotH);
        return `<rect data-chart-motion="bar-y" x="${bx}" y="${P.t + plotH - bh}" width="${barW}" height="${bh}" rx="2.5" fill="${EXP_COLORS[key]}" opacity="${r.profile.id === selectedId ? .92 : .62}"><title>${r.profile.id} · ${EXP_STRATEGY_LABEL[key]}：${v.toFixed(0)}%</title></rect>`;
      }).join('')}<text x="${gx}" y="${H - 22}" text-anchor="middle" fill="${r.profile.id === selectedId ? 'var(--ink)' : 'var(--ink-4)'}" style="font-size:12px">${r.profile.id}</text></g>`;
    }).join('')}
    <line x1="${P.l}" y1="${P.t + plotH}" x2="${W - P.r}" y2="${P.t + plotH}" class="axis-line"/>
    <text x="${P.l}" y="${H - 6}" fill="var(--ink-4)" style="font-size:12px">严格相关定义：同城且至少命中 1 项画像技能</text>
  </svg>`;
}

function expCurve(row) {
  const W = 560, H = 250, P = { l: 34, r: 18, t: 16, b: 30 };
  const plotW = W - P.l - P.r, plotH = H - P.t - P.b;
  const x = (n) => P.l + ((n - 1) / 9) * plotW;
  const y = (v) => P.t + plotH - (clamp(v, 0, 10) / 10) * plotH;
  const grids = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${P.l}" y1="${y(v)}" x2="${W - P.r}" y2="${y(v)}" class="grid-line"/><text x="${P.l - 7}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  const xt = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<text x="${x(n)}" y="${H - 10}" text-anchor="middle">${n}</text>`).join('');
  const lines = ['rule', 'tfidf', 'hybrid'].map((key) => {
    const curve = row[key].curve;
    const pts = curve.map((c) => `${x(c.n)},${y(c.hits)}`).join(' ');
    return `<polyline data-chart-motion="line" points="${pts}" fill="none" stroke="${EXP_COLORS[key]}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>${curve.map((c) => `<circle data-chart-motion="point" cx="${x(c.n)}" cy="${y(c.hits)}" r="2.6" fill="#ffffff" stroke="${EXP_COLORS[key]}" stroke-width="1.6"><title>Top ${c.n} · ${EXP_STRATEGY_LABEL[key]}：${c.hits} / 10</title></circle>`).join('')}`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top-N 累计命中">
    ${grids}${xt}
    <line x1="${P.l}" y1="${P.t + plotH}" x2="${W - P.r}" y2="${P.t + plotH}" class="axis-line"/>
    ${lines}
  </svg>`;
}

function expRadar(row) {
  const W = 360, H = 280, cx = 180, cy = 140, R = 92;
  const axes = [
    { key: 'precision', label: '严格命中', color: '#e2e8f0' },
    { key: 'skillRate', label: '技能命中', color: '#e2e8f0' },
    { key: 'cityRate', label: '城市命中', color: '#e2e8f0' },
  ];
  const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / axes.length;
  const pt = (i, v) => {
    const a = angle(i);
    const r = (clamp(v, 0, 100) / 100) * R;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [25, 50, 75, 100].map((v) => {
    const pts = axes.map((_, i) => pt(i, v).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(15,23,42,.09)" stroke-width="1"/>`;
  }).join('');
  const spokes = axes.map((a, i) => {
    const [x, y] = pt(i, 100);
    const [lx, ly] = pt(i, 124);
    const anchor = i === 0 ? 'middle' : i === 1 ? 'start' : 'end';
    const dx = i === 1 ? 5 : i === 2 ? -5 : 0;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(15,23,42,.08)"/><text x="${lx + dx}" y="${ly}" text-anchor="${anchor}" fill="var(--ink-3)" style="font-size:12px">${a.label}</text>`;
  }).join('');
  const polys = ['rule', 'tfidf', 'hybrid'].map((key) => {
    const pts = axes.map((a, i) => pt(i, row[key][a.key]).join(',')).join(' ');
    return `<g data-chart-motion="radar" data-motion-origin="${cx}px ${cy}px"><polygon points="${pts}" fill="${hexToRgba(EXP_COLORS[key], .14)}" stroke="${EXP_COLORS[key]}" stroke-width="1.8" stroke-linejoin="round"/>${axes.map((a, i) => { const [x, y] = pt(i, row[key][a.key]); return `<circle cx="${x}" cy="${y}" r="2.4" fill="${EXP_COLORS[key]}"><title>${EXP_STRATEGY_LABEL[key]} · ${a.label}：${row[key][a.key].toFixed(0)}</title></circle>`; }).join('')}</g>`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="三策略能力雷达">
    ${rings}${spokes}${polys}
    <text x="${cx}" y="${H - 4}" text-anchor="middle" fill="var(--ink-4)" style="font-size:12px">归一化指标，不是绝对精度</text>
  </svg>`;
}
