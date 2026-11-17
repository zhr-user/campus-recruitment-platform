/* ============================================================
   Dashboard — hand-drawn SVG charts (no chart library)
   ============================================================ */
let dashSource = 'all';

const DASH_PALETTE = ['#2563eb', '#7c3aed', '#0f766e', '#a16207', '#be123c', '#2563eb', '#7c3aed', '#15803d', '#9f1239'];

function renderDashboard() {
  document.body.classList.remove('auth-mode');
  const jobs = dashSource === 'all' ? JOBS : JOBS.filter((j) => j.source === dashSource);
  const salaries = jobs.map((j) => j.salaryAvg).filter(Number.isFinite);
  const med = median(salaries);
  const p25 = percentile(salaries, 0.25);
  const p75 = percentile(salaries, 0.75);
  const cityStats = dashCityStats(jobs);
  const skillStats = dashSkillStats(jobs);
  const typeStats = [...countBy(jobs, (j) => j.jobType)].sort((a, b) => b[1] - a[1]);
  const campus = jobs.filter((j) => j.campus).length;
  const top5Share = cityStats.slice(0, 5).reduce((s, c) => s + c.n, 0) / Math.max(1, jobs.length) * 100;

  const root = $('#view');
  root.innerHTML = `
    <div class="row wrap" style="justify-content:space-between;margin-bottom:14px;gap:10px">
      <div class="seg" id="dash-source">
        <button data-src="all" class="${dashSource === 'all' ? 'active' : ''}">全部样本</button>
        <button data-src="A" class="${dashSource === 'A' ? 'active' : ''}">数据集 A · 数据岗</button>
        <button data-src="B" class="${dashSource === 'B' ? 'active' : ''}">数据集 B · 招聘 JD</button>
      </div>
      <span class="tag tag-muted">${icon('database')}当前 ${fmt(jobs.length)} 条 · 薪资中位数 ${kFmt(med)}</span>
    </div>

    <div class="dash-kpis">
      <div class="stat"><div class="stat-label">${icon('briefcase')}样本岗位</div><div class="stat-value">${fmt(jobs.length)}<small>条</small></div><div class="stat-foot">来自合并去重后的 34,296 条</div></div>
      <div class="stat"><div class="stat-label">${icon('pin')}覆盖城市</div><div class="stat-value">${cityStats.length}<small>个</small></div><div class="stat-foot">Top 5 城市占 ${pct(top5Share)}</div></div>
      <div class="stat"><div class="stat-label">${icon('coins')}月薪中位数</div><div class="stat-value">${kFmt(med)}</div><div class="stat-foot">P25 ${kFmt(p25)} · P75 ${kFmt(p75)}</div></div>
      <div class="stat"><div class="stat-label">${icon('grad')}应届优先</div><div class="stat-value">${fmt(campus)}<small>条</small></div><div class="stat-foot">占当前样本 ${pct(campus / Math.max(1, jobs.length) * 100)}</div></div>
    </div>

    <div class="chart-grid">
      <div class="chart-card span7">
        <div class="chart-head"><div><h3>${icon('chart')}薪资分布与四分位</h3><p>月薪统一折算，5K 一档；底部为 P25–P75 箱体与中位数。</p></div><span class="chart-note">n = ${fmt(jobs.length)}<br>缺失薪资不纳入</span></div>
        <div class="chart-body">${dashSalaryChart(jobs, p25, med, p75)}</div>
      </div>

      <div class="chart-card span5">
        <div class="chart-head"><div><h3>${icon('pin')}城市岗位量 Top 10</h3><p>样本集中在长三角、珠三角与北京。</p></div><span class="chart-note">共 ${cityStats.length} 城</span></div>
        <div class="chart-body">${dashCityChart(cityStats)}</div>
      </div>

      <div class="chart-card span7">
        <div class="chart-head"><div><h3>${icon('zap')}技能词云</h3><p>字号按出现次数的平方根缩放，颜色仅作区分。</p></div><span class="chart-note">Top 34 / 73</span></div>
        <div class="chart-body"><div class="cloud">${skillStats.slice(0, 34).map((s, i) => {
          const size = 10.5 + Math.sqrt(s.count) * 1.05;
          return `<span data-tip="${esc(s.name)}：${s.count} 条岗位" style="font-size:${clamp(size, 14, 25).toFixed(1)}px;font-weight:${s.count > 80 ? 500 : 400};color:${DASH_PALETTE[i % DASH_PALETTE.length]};opacity:1">${esc(s.name)}</span>`;
        }).join('')}</div></div>
      </div>

      <div class="chart-card span5">
        <div class="chart-head"><div><h3>${icon('pie')}岗位类型构成</h3><p>按标题规则重判，不直接采信 B 集 label。</p></div></div>
        <div class="chart-body">${dashDonut(typeStats, jobs.length)}</div>
      </div>

      <div class="chart-card span7">
        <div class="chart-head"><div><h3>${icon('sliders')}城市薪资区间</h3><p>横线为最小值–最大值，色带为 P25–P75，圆点为中位数。</p></div><span class="chart-note">Top 8 城市<br>按岗位量排序</span></div>
        <div class="chart-body">${dashCityRange(cityStats)}</div>
      </div>

      <div class="chart-card span5">
        <div class="chart-head"><div><h3>${icon('target')}技能普及度 × 中位薪资</h3><p>每个点是一项技能：横轴出现岗位数，纵轴含该技能岗位的薪资中位数。</p></div><span class="chart-note">点大小 ∝ 岗位数<br>相关不等于因果</span></div>
        <div class="chart-body">${dashSkillScatter(skillStats)}</div>
      </div>

      <div class="chart-card span12">
        <div class="chart-head"><div><h3>${icon('info')}读图结论</h3><p>这些结论会随上方的数据源切换而变化。</p></div></div>
        <div class="insight-list">
          <div class="insight">${icon('pin')}<span><b>城市集中度：</b>${esc(cityStats[0]?.city || '—')} 以 ${cityStats[0]?.n || 0} 条居首，Top 5 城市合计占 ${pct(top5Share)}，城市是比“岗位类型”更强的分层变量。</span></div>
          <div class="insight">${icon('zap')}<span><b>技能结构：</b>${esc(skillStats[0]?.name || '—')} 出现在 ${skillStats[0]?.count || 0} 条岗位中，${esc(skillStats[1]?.name || '—')} 与 ${esc(skillStats[2]?.name || '—')} 紧随其后；通用分析技能比单一编程语言更常见。</span></div>
          <div class="insight">${icon('grad')}<span><b>校招口径：</b>仅 ${fmt(campus)} 条带“应届优先”标签，占 ${pct(campus / Math.max(1, jobs.length) * 100)}；其余为社招/不限经验样本，不作为校招岗位统计。</span></div>
        </div>
        <div class="source-strip"><span>A · 数据岗</span><span class="split"><i style="width:${SOURCE_COUNTS.A / JOBS.length * 100}%"></i><i style="width:${SOURCE_COUNTS.B / JOBS.length * 100}%"></i></span><span>B · 招聘 JD</span><span style="margin-left:auto">A ${SOURCE_COUNTS.A} · B ${SOURCE_COUNTS.B}</span></div>
      </div>
    </div>

    <div class="callout info" style="margin-top:16px">${icon('database')}<span><strong>口径说明：</strong>图表仅统计当前 400 条岗位样本，不代表全量招聘市场；A 集为数据岗子集，B 集已剔除经济金融/生物统计等非 IT 岗位。技能由 18 个哑变量与 JD 词典联合抽取，未标注技能的岗位不参与技能相关统计。</span></div>`;

  $$('#dash-source button').forEach((btn) => {
    btn.addEventListener('click', () => {
      dashSource = btn.dataset.src;
      renderDashboard();
    });
  });
  playChartEntrance(root);
}

function dashCityStats(jobs) {
  const map = new Map();
  jobs.forEach((j) => {
    if (!map.has(j.city)) map.set(j.city, { city: j.city, n: 0, salaries: [] });
    const row = map.get(j.city);
    row.n++;
    if (Number.isFinite(j.salaryAvg)) row.salaries.push(j.salaryAvg);
  });
  return [...map.values()].map((r) => ({
    ...r,
    median: median(r.salaries),
    p25: percentile(r.salaries, 0.25),
    p75: percentile(r.salaries, 0.75),
    min: r.salaries.length ? Math.min(...r.salaries) : 0,
    max: r.salaries.length ? Math.max(...r.salaries) : 0,
  })).sort((a, b) => b.n - a.n);
}

function dashSkillStats(jobs) {
  const map = new Map();
  jobs.forEach((j) => {
    j.skills.forEach((s) => {
      if (!map.has(s)) map.set(s, { name: s, count: 0, salaries: [] });
      const row = map.get(s);
      row.count++;
      if (Number.isFinite(j.salaryAvg)) row.salaries.push(j.salaryAvg);
    });
  });
  return [...map.values()].map((r) => ({ ...r, median: median(r.salaries) })).sort((a, b) => b.count - a.count);
}

function dashSalaryChart(jobs, p25, med, p75) {
  const W = 640, H = 250, P = { l: 38, r: 14, t: 44, b: 48 };
  const lo = 0, hi = 50000, bins = 10, step = (hi - lo) / bins;
  const counts = Array(bins).fill(0);
  jobs.forEach((j) => {
    if (!Number.isFinite(j.salaryAvg)) return;
    const i = clamp(Math.floor((j.salaryAvg - lo) / step), 0, bins - 1);
    counts[i]++;
  });
  const maxCount = Math.max(...counts, 1);
  const plotW = W - P.l - P.r, plotH = H - P.t - P.b;
  const bw = plotW / bins;
  const x = (v) => P.l + (v - lo) / (hi - lo) * plotW;
  const y = (v) => P.t + plotH - (v / maxCount) * plotH;
  const bars = counts.map((c, i) => {
    const bx = P.l + i * bw;
    const bh = (c / maxCount) * plotH;
    return `<g class="bar"><rect data-chart-motion="bar-y" x="${bx + 2}" y="${P.t + plotH - bh}" width="${bw - 4}" height="${bh}" rx="3" fill="${i === 4 || i === 5 ? '#8cb8ff' : '#2563eb'}" opacity="${i === 4 || i === 5 ? .92 : .52}"><title>${kFmt(lo + i * step)}–${kFmt(lo + (i + 1) * step)}：${c} 条</title></rect><text x="${bx + bw / 2}" y="${P.t + plotH - bh - 5}" text-anchor="middle" class="val-label">${c || ''}</text></g>`;
  }).join('');
  const ticks = [0, 10000, 20000, 30000, 40000, 50000].map((v) => `<text x="${x(v)}" y="${H - 28}" text-anchor="middle">${v === 0 ? '0' : kFmt(v)}</text><line x1="${x(v)}" y1="${P.t}" x2="${x(v)}" y2="${P.t + plotH}" class="grid-line"/>`).join('');
  const markers = [[p25, 'P25'], [med, '中位'], [p75, 'P75']].map(([v, label], i) => `<line x1="${x(v)}" y1="${P.t - 4}" x2="${x(v)}" y2="${P.t + plotH}" stroke="${DASH_PALETTE[i === 1 ? 2 : 0]}" stroke-width="1" stroke-dasharray="3 4" opacity=".8"/><text x="${x(v)}" y="${P.t - 9 - (i === 1 ? 18 : 0)}" text-anchor="middle" fill="${DASH_PALETTE[i === 1 ? 2 : 0]}" style="font-size:12px">${label} ${kFmt(v)}</text>`).join('');
  const boxY = H - 18;
  const boxX1 = x(p25), boxX2 = x(p75), medX = x(med);
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="薪资分布直方图">
    ${ticks}${markers}
    <line x1="${P.l}" y1="${P.t + plotH}" x2="${W - P.r}" y2="${P.t + plotH}" class="axis-line"/>
    ${bars}
    <g data-chart-motion="reveal"><line x1="${x(0)}" y1="${boxY}" x2="${x(50000)}" y2="${boxY}" stroke="rgba(15,23,42,.12)"/>
    <line x1="${x(0)}" y1="${boxY - 4}" x2="${x(0)}" y2="${boxY + 4}" stroke="rgba(15,23,42,.2)"/>
    <line x1="${x(50000)}" y1="${boxY - 4}" x2="${x(50000)}" y2="${boxY + 4}" stroke="rgba(15,23,42,.2)"/>
    <rect x="${boxX1}" y="${boxY - 5}" width="${Math.max(2, boxX2 - boxX1)}" height="10" rx="2" fill="rgba(94,234,212,.22)" stroke="rgba(94,234,212,.7)"/>
    <line x1="${medX}" y1="${boxY - 7}" x2="${medX}" y2="${boxY + 7}" stroke="#0f766e" stroke-width="2"/>
    <text x="${P.l}" y="${H - 5}" style="font-size:12px" fill="var(--ink-4)">箱体 = P25–P75，深绿线 = 中位数</text></g>
  </svg>`;
}

function dashCityChart(cityStats) {
  const rows = cityStats.slice(0, 10);
  const W = 470, H = 260, left = 46, right = 42, top = 6, rowH = (H - top - 8) / rows.length;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="城市岗位量">
    ${rows.map((r, i) => {
      const y = top + i * rowH + rowH / 2;
      const w = Math.max(2, (r.n / max) * (W - left - right));
      return `<text x="${left - 8}" y="${y + 3}" text-anchor="end" fill="var(--ink-2)" style="font-size:12px">${esc(r.city)}</text>
        <rect data-chart-motion="bar-x" x="${left}" y="${y - 6}" width="${w}" height="12" rx="3" fill="${DASH_PALETTE[i % DASH_PALETTE.length]}" opacity=".62"><title>${esc(r.city)}：${r.n} 条</title></rect>
        <text x="${left + w + 7}" y="${y + 3}" fill="var(--ink-3)" style="font-size:12px;font-family:var(--font-num)">${r.n}</text>`;
    }).join('')}
  </svg>`;
}

function dashDonut(typeStats, total) {
  const top = typeStats.slice(0, 6);
  const rest = typeStats.slice(6).reduce((s, t) => s + t[1], 0);
  if (rest) top.push(['长尾类型', rest]);
  const R = 50, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = top.map(([name, n], i) => {
    const len = Math.max(0, (n / total) * C - 2);
    const seg = `<circle data-chart-motion="donut" cx="75" cy="75" r="${R}" fill="none" stroke="${DASH_PALETTE[i % DASH_PALETTE.length]}" stroke-width="17" stroke-linecap="butt" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 75 75)" opacity=".88"><title>${esc(name)}：${n} 条（${pct(n / total * 100)}）</title></circle>`;
    offset += (n / total) * C;
    return seg;
  }).join('');
  return `<div class="donut-wrap">
    <svg class="chart-svg" viewBox="0 0 150 150" style="width:132px;flex:none" role="img" aria-label="岗位类型构成">
      <circle cx="75" cy="75" r="${R}" fill="none" stroke="rgba(15,23,42,.06)" stroke-width="17"/>
      ${segs}
      <text x="75" y="72" text-anchor="middle" fill="var(--ink)" style="font-size:21px;font-family:var(--font-num)">${fmt(total)}</text>
      <text x="75" y="88" text-anchor="middle" fill="var(--ink-4)" style="font-size:12px">条岗位</text>
    </svg>
    <div class="donut-legend">${top.map(([name, n], i) => `<div class="donut-legend-row"><i style="background:${DASH_PALETTE[i % DASH_PALETTE.length]}"></i><span>${esc(name)}</span><b>${n}</b></div>`).join('')}</div>
  </div>`;
}

function dashCityRange(cityStats) {
  const rows = cityStats.slice(0, 8);
  const W = 680, H = 270, left = 52, right = 30, top = 14, rowH = (H - top - 12) / rows.length;
  const lo = 0, hi = 50000;
  const x = (v) => left + (clamp(v, lo, hi) - lo) / (hi - lo) * (W - left - right);
  const ticks = [0, 10000, 20000, 30000, 40000, 50000].map((v) => `<text x="${x(v)}" y="${H - 4}" text-anchor="middle">${v === 0 ? '0' : kFmt(v)}</text><line x1="${x(v)}" y1="${top - 4}" x2="${x(v)}" y2="${H - 18}" class="grid-line"/>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="城市薪资区间">
    ${ticks}
    ${rows.map((r, i) => {
      const y = top + i * rowH + rowH / 2;
      const x1 = x(r.min), x2 = x(r.max), b1 = x(r.p25), b2 = x(r.p75), m = x(r.median);
      return `<text x="${left - 8}" y="${y + 3}" text-anchor="end" fill="var(--ink-2)" style="font-size:12px">${esc(r.city)}</text>
        <g data-chart-motion="reveal"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="rgba(15,23,42,.18)" stroke-width="1"/>
        <line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}" stroke="rgba(15,23,42,.28)"/>
        <line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}" stroke="rgba(15,23,42,.28)"/>
        <rect x="${b1}" y="${y - 5}" width="${Math.max(2, b2 - b1)}" height="10" rx="3" fill="${DASH_PALETTE[i % DASH_PALETTE.length]}" opacity=".34"/>
        <circle cx="${m}" cy="${y}" r="3.2" fill="#fff" stroke="${DASH_PALETTE[i % DASH_PALETTE.length]}" stroke-width="1.5"><title>${esc(r.city)}：P25 ${kFmt(r.p25)} · 中位 ${kFmt(r.median)} · P75 ${kFmt(r.p75)}，n=${r.n}</title></circle>
        <text x="${Math.min(W - 8, x2 + 6)}" y="${y + 3}" fill="var(--ink-4)" style="font-size:12px;font-family:var(--font-num)">${kFmt(r.median)}</text></g>`;
    }).join('')}
  </svg>`;
}

function dashSkillScatter(skillStats) {
  const rows = skillStats.filter((s) => s.count >= 15).slice(0, 9);
  const W = 600, H = 278, P = { l: 42, r: 26, t: 18, b: 30 };
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const medians = rows.map((r) => r.median).filter(Number.isFinite);
  const yMax = Math.max(10000, Math.ceil(Math.max(...medians, 1) * 1.15 / 5000) * 5000);
  const plotW = W - P.l - P.r, plotH = H - P.t - P.b;
  const x = (v) => P.l + (v / maxCount) * plotW;
  const y = (v) => P.t + plotH - (clamp(v, 0, yMax) / yMax) * plotH;
  const yStep = yMax <= 30000 ? 5000 : 10000;
  const yTicks = [];
  for (let v = 0; v <= yMax; v += yStep) {
    yTicks.push(`<text x="${P.l - 7}" y="${y(v) + 3}" text-anchor="end">${v === 0 ? '0' : kFmt(v)}</text><line x1="${P.l}" y1="${y(v)}" x2="${W - P.r}" y2="${y(v)}" class="grid-line"/>`);
  }
  const xTicks = [0, Math.round(maxCount / 2), maxCount].map((v) => `<text x="${x(v)}" y="${H - 10}" text-anchor="middle">${v}</text>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="技能普及度与中位薪资">
    ${yTicks.join('')}${xTicks}
    <line x1="${P.l}" y1="${P.t + plotH}" x2="${W - P.r}" y2="${P.t + plotH}" class="axis-line"/>
    ${rows.map((r, i) => {
      const cx = x(r.count), cy = y(r.median), rad = 4.5 + (r.count / maxCount) * 6;
      const anchor = cx > W - 130 ? 'end' : 'start';
      const tx = anchor === 'end' ? cx - rad - 5 : cx + rad + 5;
      const ty = cy + [-19, -10, 13, 20][i % 4];
      return `<g><circle data-chart-motion="point" cx="${cx}" cy="${cy}" r="${rad}" fill="${DASH_PALETTE[i % DASH_PALETTE.length]}" opacity=".38" stroke="${DASH_PALETTE[i % DASH_PALETTE.length]}" stroke-width="1.2"><title>${esc(r.name)}：${r.count} 条岗位，薪资中位数 ${kFmt(r.median)}</title></circle>
        <text x="${tx}" y="${ty}" text-anchor="${anchor}" fill="var(--ink-2)" style="font-size:12px">${esc(r.name)}</text></g>`;
    }).join('')}
  </svg>`;
}
