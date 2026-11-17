/* ============================================================
   Recommend page + global job detail drawer
   ============================================================ */
let recView = null;

function renderRecommend() {
  document.body.classList.remove('auth-mode');
  const profile = state.profile;
  const root = $('#view');
  const algo = state.algorithm;
  const name = state.user.name || '同学';
  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  root.innerHTML = `
  ${!profile.skills.length ? '<div class="callout info" style="margin-bottom:16px">'+icon('user')+'<span>还没有填写技能画像，当前匹配分仅供初步浏览。<a href="#/profile" style="text-decoration:underline">完善画像，让推荐更贴合你</a></span></div>' : ''}
  <div class="rec-hero panel">
    <div class="rec-hero-main">
      <span class="kicker">${icon('target')}为你排序 · ${fmt(JOBS.length)} 条样本</span>
      <h2>${greet}，${esc(name)}。<b id="rec-strong-count">—</b> 个岗位值得优先看。</h2>
      <p id="rec-hero-sub">画像：${esc(profile.jobType || '方向待完善')} · ${esc(profile.city || '城市不限')} · ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)} · ${profile.skills.length} 项技能</p>
      <div class="rec-hero-chips">
        <span class="tag tag-accent">${icon('pin')}${esc(profile.city || '城市不限')}</span>
        <span class="tag">${icon('coins')}${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}</span>
        <span class="tag">${icon('zap')}${esc(profile.jobType || '方向待完善')}</span>
        ${profile.skills.slice(0, 4).map((s) => `<span class="tag tag-muted">${esc(s)}</span>`).join('')}
        ${profile.skills.length > 4 ? `<span class="tag tag-muted">+${profile.skills.length - 4}</span>` : ''}
      </div>
    </div>
    <div class="algo-picker">
      <div class="algo-picker-head"><span>推荐算法</span><span>可实时切换</span></div>
      <div class="algo-options">
        <button class="algo-option ${algo === 'rule' ? 'active' : ''}" data-algo="rule" type="button">
          <strong>${icon('sliders')}规则加权</strong>
          <small>技能 · 城市 · 薪资</small>
        </button>
        <button class="algo-option ${algo === 'tfidf' ? 'active' : ''}" data-algo="tfidf" type="button">
          <strong>${icon('file')}TF-IDF</strong>
          <small>岗位文本余弦相似度</small>
        </button>
      </div>
    </div>
  </div>

  <div class="rec-mobile-controls">
    <span>历史岗位样本 · 非实时招聘</span>
    <button class="btn btn-soft" id="rec-filter-toggle" type="button" aria-expanded="false" aria-controls="rec-filters">${icon('filter')}筛选</button>
  </div>
  <div class="rec-grid" id="rec-grid">
    <aside class="filter-rail panel" id="rec-filters">
      <div class="rail-head"><strong>${icon('filter')}筛选条件</strong><button class="btn btn-quiet btn-sm" id="rec-reset" type="button">清空</button></div>
      <div class="rail-body">
        <div class="rail-section">
          <div class="rail-profile">
            <div class="rail-profile-top">
              <span class="avatar">${initials(name)}</span>
              <div style="min-width:0"><strong>${esc(profile.name || '我的求职画像')}</strong><small>${esc(profile.city || '城市不限')} · ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}</small></div>
            </div>
            <div class="rail-profile-meta">${profile.skills.slice(0, 5).map((s) => `<span class="tag tag-muted">${esc(s)}</span>`).join('')}</div>
            <a class="link" href="#/profile">编辑画像 ${icon('arrow')}</a>
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-label">匹配开关 <b id="match-switch-count">${Number(state.filters.salaryOnly) + Number(state.filters.campusOnly)} / 2</b></div>
          <label class="rail-toggle">
            <span>薪资有交集<small>过滤与期望毫不重叠的岗位</small></span>
            <span class="switch"><input type="checkbox" id="f-salary" ${state.filters.salaryOnly ? 'checked' : ''}><i></i></span>
          </label>
          <label class="rail-toggle">
            <span>只看应届优先<small>A 集含 90 条应届标签岗位</small></span>
            <span class="switch"><input type="checkbox" id="f-campus" ${state.filters.campusOnly ? 'checked' : ''}><i></i></span>
          </label>
        </div>

        <div class="rail-section">
          <div class="rail-label">城市 <b id="f-city-note">${state.filters.city || '全部'}</b></div>
          <select class="select" id="f-city">
            <option value="">全部城市（推荐画像所在城市优先）</option>
            ${CITIES.map((c) => `<option value="${esc(c)}" ${state.filters.city === c ? 'selected' : ''}>${esc(c)} · ${countBy(JOBS, (j) => j.city).get(c)} 条</option>`).join('')}
          </select>
          <div class="rail-label" style="margin-top:14px">岗位类型</div>
          <select class="select" id="f-type">
            <option value="">全部类型</option>
            ${JOB_TYPES.map((t) => `<option value="${esc(t)}" ${state.filters.jobType === t ? 'selected' : ''}>${esc(t)} · ${countBy(JOBS, (j) => j.jobType).get(t)} 条</option>`).join('')}
          </select>
        </div>

        <div class="rail-section" id="rail-algo-note">
          ${algoNoteHtml(algo)}
        </div>
      </div>
    </aside>

    <section class="rec-results">
      <div class="rec-toolbar">
        <label class="check favorite-filter"><input type="checkbox" id="f-favorites" ${state.filters.favoritesOnly ? 'checked' : ''}>${icon('star')}只看收藏</label>
        <span class="result-count">找到 <b id="rec-count">—</b> 条岗位 <span class="dim" id="rec-count-note"></span></span>
        <div class="input-wrap">
          ${icon('search')}
          <input class="input" id="rec-search" type="search" placeholder="搜索岗位 / 技能…" value="${esc(state.filters.keyword)}">
        </div>
        <select class="select" id="rec-sort" style="height:32px;font-size:12px;width:116px">
          <option value="score" ${state.filters.sort === 'score' ? 'selected' : ''}>匹配分优先</option>
          <option value="salary" ${state.filters.sort === 'salary' ? 'selected' : ''}>薪资从高到低</option>
          <option value="date" ${state.filters.sort === 'date' ? 'selected' : ''}>发布时间</option>
        </select>
      </div>
      <div class="job-list" id="job-list"></div>
      <div class="rec-more" id="rec-more"></div>
    </section>
  </div>`;

  recView = { ranked: [], filtered: [], visible: 8 };

  const refresh = (resetPage = true) => {
    if (resetPage) recView.visible = 8;
    paintRecommend();
  };

  $$('.algo-option', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.algo;
      if (next === state.algorithm) return;
      state.algorithm = next;
      saveState();
      $$('.algo-option', root).forEach((b) => b.classList.toggle('active', b.dataset.algo === next));
      $('#rail-algo-note').innerHTML = algoNoteHtml(next);
      refresh();
      toast(next === 'tfidf'
        ? '已切换为 TF-IDF：分数是文本余弦相似度×100，与规则分的量纲不同。'
        : '已切换为规则加权：技能 0.5、城市 0.3、薪资 0.2。', { title: '推荐算法已切换', type: 'info' });
    });
  });

  $('#rec-filter-toggle').addEventListener('click', (e) => {
    const open = $('#rec-grid').classList.toggle('filters-open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
    e.currentTarget.innerHTML = icon('filter') + (open ? '收起筛选' : '筛选');
  });
  $('#f-favorites').addEventListener('change', (e) => { state.filters.favoritesOnly = e.target.checked; saveState(); refresh(); });
  $('#f-salary').addEventListener('change', (e) => { state.filters.salaryOnly = e.target.checked; saveState(); refresh(); });
  $('#f-campus').addEventListener('change', (e) => { state.filters.campusOnly = e.target.checked; saveState(); refresh(); });
  $('#f-city').addEventListener('change', (e) => {
    state.filters.city = e.target.value;
    $('#f-city-note').textContent = e.target.value || '全部';
    saveState(); refresh();
  });
  $('#f-type').addEventListener('change', (e) => { state.filters.jobType = e.target.value; saveState(); refresh(); });
  $('#rec-sort').addEventListener('change', (e) => { state.filters.sort = e.target.value; saveState(); refresh(false); });
  $('#rec-search').addEventListener('input', debounce((e) => {
    state.filters.keyword = e.target.value.trim();
    saveState();
    refresh();
  }, 180));

  $('#rec-reset').addEventListener('click', () => {
    state.filters = { salaryOnly: true, city: '', jobType: '', campusOnly: false, favoritesOnly: false, keyword: '', sort: 'score' };
    saveState();
    renderRecommend();
    toast('筛选条件已恢复默认', { type: 'info' });
  });

  refresh();
}

function algoNoteHtml(algo) {
  if (algo === 'tfidf') {
    return `<div class="rail-label">当前算法 <b>TF-IDF</b></div>
      <p class="tiny dim" style="line-height:1.7;margin:0 0 8px">用户文档 = 技能 ×3 + 城市 + 岗位类型；在 400 条岗位文本上构建词表，余弦相似度 ×100。</p>
      <div class="callout warn" style="padding:9px 10px;font-size:12px">${icon('alert')}<span>TF-IDF <b>不做城市硬过滤</b>，分数只反映文本相关度，最高约 30–40 分。</span></div>`;
  }
  return `<div class="rail-label">规则权重 <b>按计划书 7.3</b></div>
    <div class="weight-row"><span>技能</span><span class="meter"><i style="width:50%"></i></span><b>50%</b></div>
    <div class="weight-row"><span>城市</span><span class="meter"><i style="width:30%"></i></span><b>30%</b></div>
    <div class="weight-row"><span>薪资</span><span class="meter"><i style="width:20%"></i></span><b>20%</b></div>
    <p class="tiny dim" style="line-height:1.7;margin:10px 0 0">技能分 = 命中技能数 ÷ 岗位技能数。岗位未标注技能按 60 分中性处理，避免分母为 0。</p>`;
}

function computeRanked() {
  const profile = state.profile;
  const algo = state.algorithm;
  const qvec = algo === 'tfidf' ? queryVector(profile) : null;
  return JOBS.map((job) => {
    const detail = algo === 'tfidf' ? scoreJobTfidf(profile, job, qvec) : scoreJobRule(profile, job);
    return { job, score: detail.total, detail };
  });
}

function filterRanked(rows) {
  const f = state.filters;
  const profile = state.profile;
  let out = rows.filter(({ job }) => {
    if (f.salaryOnly && profile.salaryMin && profile.salaryMax) {
      if (!(job.salaryMax >= profile.salaryMin && job.salaryMin <= profile.salaryMax)) return false;
    }
    if (f.city && job.city !== f.city) return false;
    if (f.jobType && job.jobType !== f.jobType) return false;
    if (f.campusOnly && !job.campus) return false;
    if (f.favoritesOnly && !favoriteJob(job.id)) return false;
    if (f.keyword) {
      const hay = `${job.title} ${job.company} ${job.city} ${job.jobType} ${job.skills.join(' ')}`.toLowerCase();
      if (!hay.includes(f.keyword.toLowerCase())) return false;
    }
    return true;
  });
  if (f.sort === 'salary') out = out.sort((a, b) => b.job.salaryAvg - a.job.salaryAvg || b.score - a.score);
  else if (f.sort === 'date') out = out.sort((a, b) => String(b.job.dateKey || '').localeCompare(String(a.job.dateKey || '')) || b.score - a.score);
  else out = out.sort((a, b) => b.score - a.score || b.job.salaryAvg - a.job.salaryAvg);
  return out;
}

function paintRecommend() {
  if (!recView) return;
  const profile = state.profile;
  const algo = state.algorithm;
  $('#match-switch-count').textContent = `${Number(state.filters.salaryOnly) + Number(state.filters.campusOnly)} / 2`;
  const rows = computeRanked();
  const filtered = filterRanked(rows);
  recView.ranked = rows;
  recView.filtered = filtered;

  const isRule = algo === 'rule';
  const strong = filtered.filter((r) => r.score >= (isRule ? 60 : 20)).length;
  $('#rec-strong-count').textContent = String(strong);
  $('#rec-hero-sub').innerHTML = isRule
    ? `画像：${esc(profile.jobType || '方向待完善')} · ${esc(profile.city || '城市不限')} · ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)} · ${profile.skills.length} 项技能`
    : `TF-IDF 文本排序 · 城市未参与硬过滤 · 分数为余弦相似度×100`;
  $('#rec-count').textContent = fmt(filtered.length);
  $('#rec-count-note').textContent = filtered.length !== rows.length ? ` / 全部 ${rows.length} 条` : '';

  const list = $('#job-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="panel rec-empty">${emptyState('search', '没有符合条件的岗位', '当前筛选组合过窄。可以关闭“只看应届优先”、放宽城市或清空搜索词。', '<button class="btn btn-soft" id="rec-empty-reset" type="button">重置筛选</button>')}</div>`;
    $('#rec-more').innerHTML = '';
    $('#rec-empty-reset')?.addEventListener('click', () => $('#rec-reset').click());
    return;
  }

  const visible = filtered.slice(0, recView.visible);
  list.innerHTML = visible.map((row) => jobCardHtml(row, algo)).join('');

  $$('.job-card', list).forEach((card) => {
    const jobId = card.dataset.job;
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) return;
      if (e.target.closest('[data-goto-apps]')) return;
      if (e.target.closest('[data-fav]')) return;
      openJobDrawer(jobId, { from: 'recommend' });
    });
    card.querySelector('[data-add]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addApplication(jobId);
      paintRecommend();
    });
    card.querySelector('[data-goto-apps]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      location.hash = '#/applications';
    });
    card.querySelector('[data-fav]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = toggleFavorite(jobId);
      toast(added ? '已收藏，可用“只看收藏”找回该岗位' : '已取消收藏', { type: 'info' });
      paintRecommend();
    });
  });

  const remain = filtered.length - visible.length;
  $('#rec-more').innerHTML = remain > 0
    ? `<button class="btn btn-soft" id="rec-more-btn" type="button">加载更多 <span class="dim">（剩余 ${fmt(remain)} 条）</span></button>`
    : `<div class="list-end">已展示全部 ${fmt(filtered.length)} 条岗位 · 数据来自 A/B 两套真实样本</div>`;
  $('#rec-more-btn')?.addEventListener('click', () => {
    recView.visible += 8;
    paintRecommend();
  });
}

function jobCardHtml({ job, score, detail }, algo) {
  const profile = state.profile;
  const isRule = algo === 'rule';
  const applied = !!applicationForJob(job.id);
  const fav = favoriteJob(job.id);
  const color = scoreColor(score);
  const hits = new Set((profile.skills || []).map(normSkill));
  const skills = job.skills.slice(0, 6).map((s) => `<span class="skill-tag ${hits.has(normSkill(s)) ? 'hit' : ''}">${esc(s)}</span>`).join('');
  const more = job.skills.length > 6 ? `<span class="skill-tag more">+${job.skills.length - 6}</span>` : '';
  let reason;
  if (isRule) {
    const p = detail.parts;
    const skillPart = `${detail.hits.length}/${p[0].score === 60 && !job.skills.length ? 0 : job.skills.length} 技能`;
    reason = `<b>${detail.hits.length ? detail.hits.slice(0, 3).join(' / ') : '技能未命中'}</b> · ${job.city === profile.city ? '同城' : '跨城'} · ${p[2].reason.split('，').slice(-1)[0]}`;
  } else {
    reason = `<b>文本最相关</b>：${detail.contributions.slice(0, 3).map((c) => esc(c.label)).join('、') || '暂无共同词项'} · 城市未参与硬过滤`;
  }
  return `<article class="job-card ${applied ? 'is-added' : ''}" data-job="${esc(job.id)}" style="--ring:${color}">
    <div class="job-score">
      ${ring(score, color)}
      <small>${isRule ? scoreLabel(score) : '文本相似'}</small>
    </div>
    <div class="job-main">
      <div class="job-top">
        <span class="mobile-match-score">${isRule ? '匹配' : '文本相似'} ${Math.round(score)}</span>${sourceBadge(job)}${campusBadge(job)}
        <button class="icon-btn-sm" data-fav type="button" aria-label="${fav ? '取消收藏' : '收藏'}" data-tip="${fav ? '取消收藏' : '收藏岗位'}" style="margin-left:2px;color:${fav ? 'var(--amber)' : 'var(--ink-4)'}">
          ${icon('star', fav ? 'fill' : '')}
        </button>
        <span class="job-date" title="历史岗位样本，非当前在招信息">历史样本 · ${icon('calendar')}${esc(job.date || job.dateKey || '')}</span>
      </div>
      <button class="job-title" type="button">${esc(job.title)}</button>
      <div class="job-company">${icon('building')}<span class="company-name">${esc(job.company)}</span><span class="company-extra">${esc(job.industry || job.companyType || '行业未标注')} · ${esc(job.companySize || '规模未标注')}</span></div>
      <div class="job-meta">
        <span>${icon('pin')}${esc(job.city)}</span>
        <span>${icon('clock')}${esc(job.experience || '经验未标注')}</span>
        <span>${icon('book')}${esc(job.education || '学历不限')}</span>
        <span>${icon('layers')}${esc(job.jobType)}</span>
      </div>
      <div class="job-skills">${skills}${more}</div>
      <div class="job-reason">${icon(isRule ? 'spark' : 'file')}<span>${reason}</span></div>
    </div>
    <div class="job-side">
      <div class="job-salary">${salaryText(job)}<small>月薪参考 · 历史样本</small></div>
      <div class="job-side-actions">
        <button class="btn btn-soft btn-sm" type="button">查看详情</button>
        ${applied
          ? `<button class="btn btn-mint btn-sm" data-goto-apps type="button">${icon('check')}已投递 · 看板</button>`
          : `<button class="btn btn-primary btn-sm" data-add type="button">${icon('plus')}加入投递</button>`}
      </div>
      <div class="match-note"><i class="dot" style="background:${color}"></i>${isRule ? '规则加权' : 'TF-IDF'} · ${applied ? '已在看板' : '未投递'}</div>
    </div>
  </article>`;
}

/* ---------------- global detail drawer ---------------- */
function openJobDrawer(jobId, opts = {}) {
  const job = JOB_MAP.get(jobId);
  if (!job) {
    toast('岗位数据不存在', { type: 'error' });
    return;
  }
  const profile = opts.profile || state.profile;
  const algo = opts.algorithm || state.algorithm;
  const isRule = algo === 'rule';
  const detail = isRule ? scoreJobRule(profile, job) : scoreJobTfidf(profile, job);
  const ruleScore = isRule ? detail.total : scoreJobRule(profile, job).total;
  const applied = applicationForJob(job.id);
  const fav = favoriteJob(job.id);
  const color = scoreColor(detail.total);
  const hits = new Set((profile.skills || []).map(normSkill));
  const jd = String(job.description || '').trim();

  const breakdown = isRule
    ? `<div class="score-breakdown">${detail.parts.map((p) => `
        <div class="breakdown-row"><span>${p.label} <em class="dim" style="font-style:normal">×${p.weight}</em></span><span class="meter"><i style="width:${clamp(p.score, 0, 100)}%;background:${scoreColor(p.score)}"></i></span><b>${Math.round(p.score)}</b></div>
        <p class="raw-note" style="margin:-4px 0 4px 70px">${esc(p.reason)}</p>`).join('')}</div>`
    : `<div class="score-breakdown">
        <div class="breakdown-row"><span>文本相似度</span><span class="meter"><i style="width:${clamp(detail.total * 3, 0, 100)}%;background:${color}"></i></span><b>${detail.total.toFixed(1)}</b></div>
        <p class="raw-note" style="margin:2px 0 8px">余弦相似度 ×100；为了可视化把条宽放大了 3 倍。分数不按城市加权，也不与规则分同量纲。</p>
        <div class="row gap-6 wrap">${detail.contributions.map((c) => `<span class="tag tag-violet">${esc(c.label)}</span>`).join('') || '<span class="dim tiny">没有共同词项</span>'}</div>
      </div>`;

  const skillTags = job.skills.length
    ? job.skills.map((s) => {
        const hit = hits.has(normSkill(s));
        return `<span class="skill-tag ${hit ? 'hit' : 'miss'}" data-tip="${hit ? '画像已具备' : '画像未填写'}">${esc(s)}</span>`;
      }).join('')
    : '<span class="raw-note">岗位 JD 未标注技能要求</span>';

  const benefitTags = job.benefits.length
    ? job.benefits.map((b) => `<span class="tag tag-mint">${esc(b)}</span>`).join('')
    : '<span class="raw-note">JD 未注明福利，未补充未提供的信息。</span>';

  const html = `
  <div class="drawer-head">
    <div style="min-width:0">
      <div class="row gap-6 wrap" style="margin-bottom:7px">${sourceBadge(job)}${campusBadge(job)}<span class="tag tag-muted">${esc(job.jobType)}</span></div>
      <h2 style="font-size:19px;letter-spacing:-.02em;line-height:1.35">${esc(job.title)}</h2>
      <div class="detail-head-company">${icon('building')}<span class="detail-company-name">${esc(job.company)}</span><span class="detail-company-meta">${esc(job.industry || '行业未标注')} · ${esc(job.city)}</span></div>
    </div>
    <button class="drawer-close" id="drawer-close" type="button" aria-label="关闭">${icon('x')}</button>
  </div>
  <div class="drawer-body">
    <div class="detail-hero">
      <div style="min-width:0">
        <div class="detail-meta">
          <span class="tag tag-accent">${icon('coins')}${salaryText(job)} / 月</span>
          <span class="tag">${icon('clock')}${esc(job.experience || '经验不限')}</span>
          <span class="tag">${icon('book')}${esc(job.education || '学历不限')}</span>
          <span class="tag">${icon('pin')}${esc(job.city)}</span>
        </div>
        <p class="tiny dim" style="margin-top:10px;line-height:1.7">${isRule ? '规则加权分' : 'TF-IDF 文本分'} · 画像“${esc(opts.profileLabel || profile.name || '当前画像')}” · ${isRule ? `规则分 ${ruleScore}` : `同画像规则分 ${ruleScore}`}</p>
      </div>
      ${ring(detail.total, color, 'lg')}
    </div>

    <div class="detail-section">
      <h4>${icon('sliders')}匹配分解</h4>
      ${breakdown}
    </div>

    <div class="detail-section">
      <h4>${icon('zap')}岗位技能与命中</h4>
      <div class="job-skills">${skillTags}</div>
      <p class="raw-note" style="margin-top:7px">已具备与待补充技能以颜色区分；待补充项来自岗位要求，技能分按“命中数 ÷ 岗位技能数”计算。</p>
    </div>

    <div class="detail-section">
      <h4>${icon('award')}福利与标签</h4>
      <div class="benefit-list">${benefitTags}</div>
    </div>

    <div class="detail-section">
      <h4>${icon('file')}岗位描述</h4>
      <div class="detail-jd">${esc(jd || '该样本没有可用 JD 文本。')}</div>
    </div>

    <div class="detail-section">
      <h4>${icon('database')}数据来源与口径</h4>
      <div class="company-grid">
        <div class="kv"><span>来源</span><b>${job.source === 'B' ? '数据集 B · 招聘 JD' : '数据集 A · 数据岗子集'} #${esc(job.srcIndex)}</b></div>
        <div class="kv"><span>原始薪资</span><b>${esc(job.salaryRaw || '—')}</b></div>
        <div class="kv"><span>公司类型</span><b>${esc(job.companyType || '—')}</b></div>
        <div class="kv"><span>公司规模</span><b>${esc(job.companySize || '—')}</b></div>
        <div class="kv"><span>发布日期</span><b>${esc(job.date || '—')}</b></div>
        <div class="kv"><span>B 集原 label</span><b>${esc(job.bLabel || '—')}</b></div>
      </div>
      <p class="raw-note" style="margin-top:8px">岗位样本，历史招聘信息；薪资统一折算为月薪，原始文本保留。B 集 label 不可信处已按 JD 重判。</p>
    </div>

    <div class="detail-actions">
      ${applied
        ? `<button class="btn btn-mint" id="drawer-apps" type="button">${icon('briefcase')}查看投递看板</button>`
        : `<button class="btn btn-primary" id="drawer-add" type="button">${icon('plus')}加入投递看板</button>`}
      <button class="btn" id="drawer-fav" type="button" aria-label="${fav ? '取消收藏' : '收藏岗位'}" style="flex:none;width:44px" data-tip="${fav ? '取消收藏' : '收藏'}">${icon('star', fav ? 'fill' : '')}</button>
      <button class="btn" id="drawer-copy" type="button" aria-label="复制岗位摘要" style="flex:none;width:44px" data-tip="复制岗位摘要">${icon('copy')}</button>
    </div>
  </div>`;

  openDrawer(html, (content) => {
    $('#drawer-close', content).addEventListener('click', () => closeDrawer());
    $('#drawer-add', content)?.addEventListener('click', () => {
      addApplication(job.id);
      if (page === 'recommend') paintRecommend();
      openJobDrawer(job.id, opts);
    });
    $('#drawer-apps', content)?.addEventListener('click', () => {
      closeDrawer();
      location.hash = '#/applications';
    });
    $('#drawer-fav', content).addEventListener('click', (e) => {
      const added = toggleFavorite(job.id);
      e.currentTarget.innerHTML = icon('star', added ? 'fill' : '');
      e.currentTarget.style.color = added ? 'var(--amber)' : '';
      e.currentTarget.setAttribute('aria-label', added ? '取消收藏' : '收藏岗位');
      if (page === 'recommend') paintRecommend();
      toast(added ? '已收藏该岗位' : '已取消收藏', { type: 'info' });
    });
    $('#drawer-copy', content).addEventListener('click', () => {
      copyText(`${job.title}｜${job.company}｜${job.city}｜${salaryText(job)}/月｜匹配分 ${detail.total}`);
    });
  });
}
