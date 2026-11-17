/* ============================================================
   Applications board
   ============================================================ */
let mobileAppStatus = 'applied';

function renderApplications() {
  document.body.classList.remove('auth-mode');
  const apps = getApplications();
  const counts = APPLICATION_STATUSES.map((s) => ({
    ...s,
    n: apps.filter((a) => a.status === s.id).length,
  }));
  const active = apps.filter((a) => a.status !== 'closed').length;
  const interview = apps.filter((a) => a.status === 'interview').length;
  const offers = apps.filter((a) => a.status === 'offer').length;
  const applied = apps.filter((a) => a.status === 'applied').length;

  const root = $('#view');
  root.innerHTML = `
    <div class="app-stats">
      <div class="stat"><div class="stat-label">${icon('briefcase')}累计投递</div><div class="stat-value">${apps.length}<small>条</small></div><div class="stat-foot">当前账号的独立记录</div></div>
      <div class="stat"><div class="stat-label">${icon('clock')}进行中</div><div class="stat-value">${active}<small>条</small></div><div class="stat-foot"><span class="up">含笔试 / 面试 / Offer</span></div></div>
      <div class="stat"><div class="stat-label">${icon('message')}面试阶段</div><div class="stat-value">${interview}<small>条</small></div><div class="stat-foot">建议 3 天内跟进一次</div></div>
      <div class="stat"><div class="stat-label">${icon('award')}Offer</div><div class="stat-value">${offers}<small>个</small></div><div class="stat-foot">${offers ? '<span class="up">已进入选择阶段</span>' : '继续推进流程'}</div></div>
    </div>

    <div class="app-summary panel">
      <div class="funnel">
        <span class="funnel-step"><b>${apps.length}</b>总投递</span><span class="funnel-arrow">→</span>
        <span class="funnel-step"><b>${applied}</b>待反馈</span><span class="funnel-arrow">→</span>
        <span class="funnel-step"><b>${counts.find((c) => c.id === 'written').n}</b>笔试</span><span class="funnel-arrow">→</span>
        <span class="funnel-step"><b>${interview}</b>面试</span><span class="funnel-arrow">→</span>
        <span class="funnel-step"><b>${offers}</b>Offer</span>
        <span class="funnel-step" style="margin-left:6px"><b>${counts.find((c) => c.id === 'closed').n}</b>已结束</span>
      </div>
      <div class="row gap-8" style="margin-left:auto">
        <button class="btn btn-sm" id="apps-export" type="button">${icon('download')}导出 CSV</button>
        <button class="btn btn-sm btn-primary" id="apps-add" type="button">${icon('plus')}添加投递</button>
      </div>
    </div>

    ${apps.length ? `
    <nav class="board-status-tabs" aria-label="按投递状态查看">${counts.map((col) => `<button class="board-status-button ${col.id === mobileAppStatus ? 'active' : ''}" data-board-status="${col.id}" type="button" aria-pressed="${col.id === mobileAppStatus}">${col.label}<span>${col.n}</span></button>`).join('')}</nav>
    <div class="board-wrap">
      <div class="board">
        ${counts.map((col) => `
          <section class="board-col ${col.id === mobileAppStatus ? 'mobile-active' : ''}" data-status-col="${col.id}">
            <div class="board-col-head"><span class="dot" style="background:${col.color};color:${col.color}"></span><strong>${col.label}</strong><span class="count">${col.n}</span></div>
            <div class="board-col-body">
              ${apps.filter((a) => a.status === col.id).map((a) => appCardHtml(a)).join('') || `<div class="raw-note" style="padding:12px 4px;text-align:center">暂无${col.label}记录</div>`}
              ${col.id === 'applied' ? `<button class="board-add" id="board-add" type="button">${icon('plus')}手动添加</button>` : ''}
            </div>
          </section>`).join('')}
      </div>
    </div>` : emptyState('briefcase', '看板还是空的', '从推荐页加入一个岗位，或点击右上角“添加投递”手动选择。', `<button class="btn btn-primary" id="empty-add" type="button">${icon('plus')}添加第一条投递</button>`)}
    <div class="callout info" style="margin-top:16px">${icon('info')}<span><strong>求职进度记录：</strong>状态、备注与时间线按账号保存。加入看板用于跟进求职进度，不会自动向企业发送简历；请先在企业官方渠道完成投递。</span></div>`;

  $$('[data-board-status]', root).forEach((btn) => btn.addEventListener('click', () => {
    mobileAppStatus = btn.dataset.boardStatus;
    $$('[data-board-status]', root).forEach((item) => { const active = item.dataset.boardStatus === mobileAppStatus; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
    $$('[data-status-col]', root).forEach((col) => col.classList.toggle('mobile-active', col.dataset.statusCol === mobileAppStatus));
  }));
  $('#apps-add')?.addEventListener('click', openApplicationPicker);
  $('#board-add')?.addEventListener('click', openApplicationPicker);
  $('#empty-add')?.addEventListener('click', openApplicationPicker);
  $('#apps-export')?.addEventListener('click', exportApplications);
  $$('.app-card', root).forEach((card) => {
    card.addEventListener('click', () => openApplicationDrawer(card.dataset.app));
  });
}

function appCardHtml(app) {
  const job = app.job;
  const idx = Math.max(0, APPLICATION_STATUSES.findIndex((s) => s.id === app.status));
  const pctDone = ((idx + 1) / APPLICATION_STATUSES.length) * 100;
  const status = STATUS_MAP.get(app.status) || APPLICATION_STATUSES[0];
  return `
    <button class="app-card" data-app="${esc(app.id)}" type="button" style="width:100%;text-align:left">
      <div class="app-card-top">${sourceBadge(job)}${job.campus ? `<span class="badge badge-mint">应届</span>` : ''}<span class="badge" style="color:${status.color};border-color:${hexToRgba(status.color, .25)}">${status.label}</span></div>
      <h4>${esc(job.title)}</h4>
      <div class="co">${esc(job.company)} · ${esc(job.city)}</div>
      <div class="sal">${salaryText(job)} / 月</div>
      <div class="app-card-foot"><span>${relTime(app.updatedAt)}</span><span class="progress" style="width:54px;height:3px"><i style="width:${pctDone}%;background:${status.color}"></i></span></div>
    </button>`;
}

function openApplicationPicker() {
  const appliedIds = new Set(state.applications.map((a) => a.jobId));
  const candidates = JOBS.filter((j) => !appliedIds.has(j.id))
    .map((j) => ({ job: j, score: scoreJobRule(state.profile, j).total }))
    .sort((a, b) => b.score - a.score);

  const renderList = (q = '') => {
    const needle = q.trim().toLowerCase();
    const list = candidates.filter(({ job }) => !needle
      || `${job.title} ${job.company} ${job.city} ${job.skills.join(' ')}`.toLowerCase().includes(needle)).slice(0, 24);
    if (!list.length) return `<div class="palette-empty">没有可添加的岗位，换个关键词试试。</div>`;
    return list.map(({ job, score }) => `
      <button class="picker-row" data-pick="${esc(job.id)}" type="button">
        <span class="p-ico" style="width:28px;height:28px;border-radius:7px;display:grid;place-items:center;background:rgba(15,23,42,.05)">${icon('briefcase')}</span>
        <span style="min-width:0;flex:1"><strong>${esc(job.title)}</strong><small>${esc(job.company)} · ${esc(job.city)} · ${salaryText(job)}</small></span>
        <span class="sal">${Math.round(score)}</span>
      </button>`).join('');
  };

  openModal({
    title: '添加一条投递',
    sub: `从 400 条样本里选择，按当前画像的规则匹配分排序；已投递岗位不会重复出现。`,
    wide: true,
    body: `
      <div class="input-wrap" style="margin-bottom:12px">${icon('search')}<input class="input" id="picker-search" placeholder="搜索岗位、公司、城市或技能…" autocomplete="off"></div>
      <div class="picker-list" id="picker-list">${renderList()}</div>`,
    onMount(root, close) {
      const list = $('#picker-list', root);
      const bind = () => {
        $$('[data-pick]', list).forEach((row) => {
          row.addEventListener('click', () => {
            const res = addApplication(row.dataset.pick, { silent: true });
            if (!res.ok) {
              toast('该岗位已在投递看板中', { type: 'info' });
              return;
            }
            close();
            renderApplications();
            toast('已添加到“已投递”列，可在详情中推进状态。', { title: '投递已创建', type: 'success' });
          });
        });
      };
      bind();
      $('#picker-search', root).addEventListener('input', debounce((e) => {
        list.innerHTML = renderList(e.target.value);
        bind();
      }, 120));
    },
  });
}

function openApplicationDrawer(appId) {
  const app = state.applications.find((a) => a.id === appId);
  if (!app) return;
  const job = JOB_MAP.get(app.jobId);
  if (!job) return;
  const idx = Math.max(0, APPLICATION_STATUSES.findIndex((s) => s.id === app.status));
  const current = APPLICATION_STATUSES[idx];
  const next = ['offer', 'closed'].includes(app.status) ? null : APPLICATION_STATUSES[idx + 1];
  const history = [...(app.history || [])].reverse();
  const appliedAt = app.createdAt ? dateCN(app.createdAt) : '—';

  const track = APPLICATION_STATUSES.map((s, i) => `
    <div class="app-status-step ${i < idx ? 'done' : i === idx ? 'now' : ''}"></div>`).join('');
  const labels = APPLICATION_STATUSES.map((s, i) => `<span style="${i === idx ? 'color:var(--accent)' : ''}">${s.short}</span>`).join('');

  const html = `
    <div class="drawer-head">
      <div style="min-width:0">
        <div class="row gap-6 wrap" style="margin-bottom:7px">${sourceBadge(job)}<span class="badge" style="color:${current.color};border-color:${hexToRgba(current.color, .25)}">${current.label}</span></div>
        <h2 style="font-size:19px;letter-spacing:-.02em;line-height:1.35">${esc(job.title)}</h2>
        <div class="detail-head-company">${icon('building')}<span class="detail-company-name">${esc(job.company)}</span><span class="detail-company-meta">${esc(job.city)} · ${salaryText(job)} / 月</span></div>
      </div>
      <button class="drawer-close" id="drawer-close" type="button" aria-label="关闭">${icon('x')}</button>
    </div>
    <div class="drawer-body">
      <div class="detail-section" style="margin-top:0">
        <h4>${icon('flag')}流程进度</h4>
        <div class="app-status-track">${track}</div>
        <div class="app-status-labels">${labels}</div>
        <p class="raw-note" style="margin-top:10px">当前阶段：<b style="color:${current.color}">${current.label}</b> · ${current.hint}。最近更新于 ${dateTimeCN(app.updatedAt)}。</p>
      </div>

      <div class="detail-section">
        <h4>${icon('sliders')}更新状态</h4>
        <div class="row gap-6 wrap">
          ${APPLICATION_STATUSES.map((s) => `<button class="btn btn-sm ${s.id === app.status ? 'btn-soft' : ''}" data-status="${s.id}" type="button" style="height:27px;padding:0 9px;font-size:12px">${s.label}</button>`).join('')}
        </div>
        ${next ? `<button class="btn btn-primary" id="app-next" type="button" style="margin-top:10px;width:100%">${icon('arrow')}推进到「${next.label}」</button>` : `<p class="raw-note" style="margin-top:10px">${app.status === 'offer' ? '已收到 Offer。确认接受、拒绝或关闭后，可点选“已结束”记录结果。' : '流程已结束。如需重新跟进，可点选“已投递”重新打开。'}</p>`}
      </div>

      <div class="detail-section">
        <h4>${icon('file')}跟进备注</h4>
        <textarea class="input" id="app-note" rows="3" maxlength="2000" placeholder="例如：一面反馈、HR 联系方式、待补材料…" style="resize:vertical;height:auto;padding:9px 11px;line-height:1.6">${esc(app.note || '')}</textarea>
        <div class="row gap-8" style="margin-top:8px">
          <button class="btn btn-sm" id="app-note-save" type="button">${icon('check')}保存备注</button>
          <span class="raw-note">备注仅在当前账号中可见</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>${icon('clock')}状态时间线</h4>
        <div class="timeline">
          ${history.map((h) => {
            const st = STATUS_MAP.get(h.status) || current;
            return `<div class="timeline-item ${h.status === app.status ? 'now' : 'done'}"><strong>${st.label}</strong><small>${dateTimeCN(h.at)}</small>${h.note ? `<p class="raw-note" style="margin-top:4px">${esc(h.note)}</p>` : ''}</div>`;
          }).join('') || '<div class="raw-note">暂无状态记录</div>'}
        </div>
      </div>

      <div class="detail-section">
        <h4>${icon('database')}投递信息</h4>
        <div class="company-grid">
          <div class="kv"><span>投递日期</span><b>${appliedAt}</b></div>
          <div class="kv"><span>当前阶段</span><b>${current.label}</b></div>
          <div class="kv"><span>岗位方向</span><b>${esc(job.jobType)}</b></div>
          <div class="kv"><span>数据来源</span><b>${job.source === 'B' ? '数据集 B' : '数据集 A'} #${esc(job.srcIndex)}</b></div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn" id="app-view-job" type="button">${icon('eye')}查看岗位详情</button>
        <button class="btn btn-danger" id="app-remove" type="button" style="flex:none">${icon('trash')}移除</button>
      </div>
    </div>`;

  openDrawer(html, (content) => {
    $('#drawer-close', content).addEventListener('click', () => closeDrawer());
    $('#app-next', content)?.addEventListener('click', () => {
      if (!next) return;
      updateApplicationStatus(app.id, next.id);
      mobileAppStatus = next.id;
      toast(`已推进到「${next.label}」`, { title: '状态已更新', type: 'success' });
      renderApplications();
      openApplicationDrawer(app.id);
    });
    $$('[data-status]', content).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.status === app.status) return;
        const st = STATUS_MAP.get(btn.dataset.status);
        updateApplicationStatus(app.id, btn.dataset.status);
        mobileAppStatus = btn.dataset.status;
        toast(`状态已改为「${st.label}」`, { type: 'success' });
        renderApplications();
        openApplicationDrawer(app.id);
      });
    });
    $('#app-note-save', content).addEventListener('click', async () => {
      const button=$('#app-note-save',content);button.disabled=true;
      app.note = $('#app-note', content).value.trim();
      if(await saveState())toast('备注已保存到账号', { type: 'success' });
      button.disabled=false;
    });
    $('#app-view-job', content).addEventListener('click', () => {
      closeDrawer();
      setTimeout(() => openJobDrawer(job.id, { from: 'applications' }), 120);
    });
    $('#app-remove', content).addEventListener('click', () => {
      confirmModal({
        title: '移除这条投递记录？',
        message: `将从看板中移除「${esc(job.title)}」的投递与时间线，岗位数据本身不受影响。`,
        confirmText: '确认移除',
        danger: true,
        onConfirm: () => {
          state.applications = state.applications.filter((a) => a.id !== app.id);
          saveState();
          syncChrome();
          closeDrawer();
          renderApplications();
          toast('已从投递看板移除', { type: 'info' });
        },
      });
    });
  });
}

function exportApplications() {
  const rows = [['岗位', '公司', '城市', '月薪下限', '月薪上限', '当前状态', '投递日期', '最近更新', '备注']];
  getApplications().forEach((a) => {
    const j = a.job;
    rows.push([
      j.title, j.company, j.city, j.salaryMin, j.salaryMax,
      (STATUS_MAP.get(a.status) || {}).label || a.status,
      (a.createdAt || '').slice(0, 10), (a.updatedAt || '').slice(0, 10), a.note || '',
    ]);
  });
  const csv = '\ufeff' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadFile('campus-compass-applications.csv', csv, 'text/csv;charset=utf-8');
  toast(`已导出 ${rows.length - 1} 条投递记录`, { title: 'CSV 已生成', type: 'success' });
}
