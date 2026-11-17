/* ============================================================
   Profile page
   ============================================================ */
let profileDraft = null;

function renderProfile(draft = null) {
  document.body.classList.remove('auth-mode');
  profileDraft = JSON.parse(JSON.stringify(draft || state.profile));
  delete profileDraft.tag;delete profileDraft.desc;delete profileDraft.id;
  const root = $('#view');
  root.innerHTML = `
    <div class="callout info" style="margin-bottom:16px">
      ${icon('info')}
      <span><strong>画像直接参与推荐公式。</strong>技能命中率、城市是否一致、薪资区间重叠比例都会实时影响排序；修改后点击“保存画像”保存到你的账号。右侧预览会随编辑即时重算，但不会自动保存。</span>
    </div>
    <div class="profile-grid">
      <div class="panel profile-form">
        <div class="form-section">
          <div class="form-section-head">
            <div><h3>${icon('spark')}从预设开始</h3><p>五个画像覆盖数据、算法、后端与应届场景，可一键套用后微调。</p></div>
            <span class="tag tag-muted">共 ${DB.profiles.length} 个预设</span>
          </div>
          <div class="preset-grid" id="preset-grid">
            ${DB.profiles.map((p) => `
              <button class="preset-card ${profileDraft.preset === p.id ? 'active' : ''}" data-preset="${esc(p.id)}" type="button">
                <strong>${esc(p.name)}</strong>
                <small>${esc(p.city)} · ${kFmt(p.salaryMin)}-${kFmt(p.salaryMax)}</small>
              </button>`).join('')}
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <div><h3>${icon('user')}基本信息</h3><p>画像名称会和你的求职偏好一起保存在当前账号中。</p></div>
          </div>
          <div class="form-grid">
            <div class="field full">
              <label for="p-name">画像名称</label>
              <input class="input" id="p-name" maxlength="24" value="${esc(profileDraft.name || '')}" placeholder="例如：数据分析 · 杭州">
            </div>
            <div class="field">
              <label for="p-type">期望岗位方向</label>
              <select class="select" id="p-type">
                <option value="" ${!profileDraft.jobType ? 'selected' : ''}>请选择期望方向</option>
                ${JOB_TYPES.map((t) => `<option value="${esc(t)}" ${profileDraft.jobType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="p-city">期望城市</label>
              <select class="select" id="p-city">
                <option value="" ${!profileDraft.city ? 'selected' : ''}>不限城市（城市项中性 50 分）</option>
                ${CITIES.map((c) => `<option value="${esc(c)}" ${profileDraft.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <div><h3>${icon('zap')}技能画像</h3><p>点击选择你已具备的技能，至少 3 项才能让匹配分更有区分度。</p></div>
            <span class="tag tag-accent" id="skill-selected-count">已选 ${profileDraft.skills.length} 项</span>
          </div>
          <div class="input-wrap" style="margin-bottom:12px">
            ${icon('search')}
            <input class="input input-sm" id="skill-search" placeholder="在 73 项技能词典中筛选…">
          </div>
          <div class="skill-picker" id="skill-picker">
            ${SKILL_GROUPS.map((g) => `
              <div class="skill-group" data-group="${esc(g.name)}">
                <div class="skill-group-label">${esc(g.name)} <span class="dim">${g.skills.length}</span></div>
                <div class="skill-options">
                  ${g.skills.map((s) => {
                    const on = profileDraft.skills.some((x) => normSkill(x) === normSkill(s.name));
                    return `<button class="skill-opt ${on ? 'active' : ''}" data-skill="${esc(s.name)}" type="button">${esc(s.name)}<span class="count">${s.count}</span></button>`;
                  }).join('')}
                </div>
              </div>`).join('')}
          </div>
          <p class="field-hint" style="margin-top:10px">技能后面的数字是 400 条样本中的出现次数，用来提示该技能在岗位样本中的支撑强度。</p>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <div><h3>${icon('coins')}期望月薪</h3><p>推荐页默认过滤与期望区间毫无交集的岗位。</p></div>
            <span class="tag tag-mint" id="salary-tag">${kFmt(profileDraft.salaryMin)} - ${kFmt(profileDraft.salaryMax)}</span>
          </div>
          <div class="salary-editor">
            <div class="salary-values"><output id="salary-min-out">${kFmt(profileDraft.salaryMin)}</output><span>—</span><output id="salary-max-out">${kFmt(profileDraft.salaryMax)}</output><span>/ 月</span></div>
            <div class="salary-sliders">
              <div class="slider-line"><span>最低</span><input type="range" id="salary-min" min="3000" max="50000" step="500" value="${profileDraft.salaryMin}"><b id="salary-min-val">${fmt(profileDraft.salaryMin)}</b></div>
              <div class="slider-line"><span>最高</span><input type="range" id="salary-max" min="3000" max="50000" step="500" value="${profileDraft.salaryMax}"><b id="salary-max-val">${fmt(profileDraft.salaryMax)}</b></div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <div><h3>${icon('award')}应届身份</h3><p>A 集只有 90 条岗位带“应届优先”标签，开启后会显著收窄结果。</p></div>
          </div>
          <label class="switch-line" style="font-size:12px">
            <span class="switch"><input type="checkbox" id="p-campus" ${profileDraft.campusOnly ? 'checked' : ''}><i></i></span>
            推荐时只看应届优先岗位
          </label>
        </div>

        <div class="profile-actions">
          <span class="profile-save-state" id="profile-save-state" role="status"></span>
          <button class="btn btn-primary" id="profile-save" type="button">${icon('check')}保存画像</button>
          <button class="btn" id="profile-recommend" type="button">${icon('arrow')}去看推荐</button>
          <button class="btn btn-quiet" id="profile-reset" type="button">恢复预设</button>
        </div>
      </div>

      <aside class="profile-side">
        <div class="panel completeness" id="profile-side-inner"></div>
      </aside>
    </div>`;

  paintProfileSide();
  bindProfileEvents();
  syncProfileSaveState();
}

function profileCompleteness(p) {
  const skillPct = clamp((p.skills.length / 5) * 40, 0, 40);
  const cityPct = p.city ? 15 : 0;
  const salaryPct = p.salaryMin && p.salaryMax && p.salaryMax > p.salaryMin ? 25 : 0;
  const typePct = p.jobType ? 20 : 0;
  return Math.round(skillPct + cityPct + salaryPct + typePct);
}

function paintProfileSide() {
  const p = profileDraft;
  const wrap = $('#profile-side-inner');
  if (!wrap) return;
  const score = profileCompleteness(p);
  let previewPool = JOBS;
  if (state.filters.salaryOnly && p.salaryMin && p.salaryMax) {
    previewPool = previewPool.filter((job) => job.salaryMax >= p.salaryMin && job.salaryMin <= p.salaryMax);
  }
  if (p.campusOnly) previewPool = previewPool.filter((job) => job.campus);
  const top = previewPool.map((job) => ({ job, score: scoreJobRule(p, job).total }))
    .sort((a, b) => b.score - a.score || b.job.salaryAvg - a.job.salaryAvg || a.job.id.localeCompare(b.job.id))
    .slice(0, 5);
  const checks = [
    [p.skills.length >= 3, `至少 3 项技能（当前 ${p.skills.length} 项）`],
    [!!p.city, '填写期望城市'],
    [p.salaryMin && p.salaryMax && p.salaryMax > p.salaryMin, '设置有效的薪资区间'],
    [!!p.jobType, '选择期望岗位方向'],
  ];
  wrap.innerHTML = `
    <div class="completeness-top">
      ${ring(score, score >= 75 ? '#0f766e' : score >= 50 ? '#2563eb' : '#a16207', '', '完整度')}
      <div class="completeness-copy"><strong>画像完整度</strong><p>${score >= 75 ? '画像信息比较完整，推荐结果具备解释力。' : '补充技能、城市与薪资后，匹配分更有区分度。'}</p></div>
    </div>
    <div class="check-list">
      ${checks.map(([ok, text]) => `<div class="check-item ${ok ? 'done' : ''}">${icon(ok ? 'check' : 'circle')}${esc(text)}</div>`).join('')}
    </div>
    <div class="divider"></div>
    <div class="row" style="justify-content:space-between">
      <h3 style="font-size:12px;display:flex;align-items:center;gap:7px">${icon('spark')}当前画像 Top 5</h3>
      <span class="tag tag-muted">规则分</span>
    </div>
    <div class="preview-list">
      ${top.map(({ job, score: s }) => `
        <button class="preview-job" data-preview="${esc(job.id)}" type="button" style="width:100%;text-align:left">
          <span class="score-mini" style="color:${scoreColor(s)}">${Math.round(s)}</span>
          <span style="min-width:0;flex:1"><strong>${esc(job.title)}</strong><small>${esc(job.company)} · ${esc(job.city)} · ${salaryText(job)}</small></span>
        </button>`).join('')}
    </div>
    <div class="divider"></div>
    <div class="callout" style="padding:10px;font-size:12px">${icon('database')}<span>保存成功后，画像会随账号保留；右侧预览仅使用当前编辑内容。</span></div>`;
  $$('[data-preview]', wrap).forEach((btn) => {
    btn.addEventListener('click', () => {
      openJobDrawer(btn.dataset.preview, { from: 'profile', profile: profileDraft, algorithm: 'rule' });
    });
  });
}

function bindProfileEvents() {
  const root = $('#view');
  const markDirty = () => {
    profileDraft.basePreset = profileDraft.basePreset || (profileDraft.preset !== 'custom' ? profileDraft.preset : state.profile.basePreset) || DB.profiles[0].id;
    profileDraft.preset = 'custom';
    syncProfileSaveState();
    $$('.preset-card', root).forEach((c) => c.classList.remove('active'));
  };

  $('#p-name').addEventListener('input', (e) => { profileDraft.name = e.target.value; markDirty(); });
  $('#p-type').addEventListener('change', (e) => { profileDraft.jobType = e.target.value; markDirty(); paintProfileSide(); });
  $('#p-city').addEventListener('change', (e) => { profileDraft.city = e.target.value; markDirty(); paintProfileSide(); });
  $('#p-campus').addEventListener('change', (e) => { profileDraft.campusOnly = e.target.checked; markDirty(); paintProfileSide(); });

  const syncSalary = (which) => {
    let min = Number($('#salary-min').value);
    let max = Number($('#salary-max').value);
    if (min > max - 500) {
      if (which === 'min') min = Math.max(3000, max - 500);
      else max = Math.min(50000, min + 500);
      $('#salary-min').value = min;
      $('#salary-max').value = max;
    }
    profileDraft.salaryMin = min;
    profileDraft.salaryMax = max;
    $('#salary-min-out').textContent = kFmt(min);
    $('#salary-max-out').textContent = kFmt(max);
    $('#salary-min-val').textContent = fmt(min);
    $('#salary-max-val').textContent = fmt(max);
    $('#salary-tag').textContent = `${kFmt(min)} - ${kFmt(max)}`;
    markDirty();
    paintProfileSide();
  };
  $('#salary-min').addEventListener('input', () => syncSalary('min'));
  $('#salary-max').addEventListener('input', () => syncSalary('max'));

  $$('.preset-card', root).forEach((card) => {
    card.addEventListener('click', () => {
      const preset = DB.profiles.find((p) => p.id === card.dataset.preset);
      if (!preset) return;
      const next = { ...preset, preset: preset.id, basePreset: preset.id, campusOnly: profileDraft.campusOnly };
      toast(`已套用「${preset.name}」预设，可继续微调。`, { title: '画像预设', type: 'info' });
      renderProfile(next);
    });
  });

  $$('.skill-opt', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.skill;
      const idx = profileDraft.skills.findIndex((s) => normSkill(s) === normSkill(name));
      if (idx >= 0) profileDraft.skills.splice(idx, 1);
      else profileDraft.skills.push(name);
      btn.classList.toggle('active', idx < 0);
      $('#skill-selected-count').textContent = `已选 ${profileDraft.skills.length} 项`;
      markDirty();
      paintProfileSide();
    });
  });

  $('#skill-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('.skill-group', root).forEach((group) => {
      let visible = 0;
      $$('.skill-opt', group).forEach((btn) => {
        const show = !q || btn.dataset.skill.toLowerCase().includes(q);
        btn.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      group.style.display = visible ? '' : 'none';
    });
  });

  $('#profile-save').addEventListener('click', () => commitProfile());
  $('#profile-recommend').addEventListener('click', async () => {
    if(await commitProfile({ silent: true }))location.hash = '#/recommend';
  });
  $('#profile-reset').addEventListener('click', () => {
    const preset = DB.profiles.find((p) => p.id === (profileDraft.basePreset || state.profile.basePreset || state.profile.preset)) || DB.profiles[0];
    renderProfile({ ...preset, preset: preset.id, basePreset: preset.id, campusOnly: profileDraft.campusOnly });
    toast('已恢复到最近一次使用的预设（尚未保存）', { type: 'info' });
  });
}

let profileSaving=false;
async function commitProfile(opts={}) {
  if(profileSaving)return false;
  if(!profileDraft.name.trim()){toast('请填写画像名称',{type:'warn'});$('#p-name')?.focus();return false;}
  const generation=accountGeneration;
  const old=JSON.parse(JSON.stringify(state.profile)),oldFilters={...state.filters};
  const next=JSON.parse(JSON.stringify(profileDraft));next.name=next.name.trim();next.skills=[...new Set(next.skills)];
  state.profile=next;state.filters.campusOnly=!!next.campusOnly;
  if(old.city&&state.filters.city===old.city&&old.city!==next.city)state.filters.city='';
  profileSaving=true;
  const controls=$$('input,select,button',$('#view'));controls.forEach(el=>el.disabled=true);$('#profile-save-state').textContent='正在保存…';
  try {
    const saved=await saveState({retry:true});if(generation!==accountGeneration)return false;
    if(!saved){
      if(state.loggedIn){state.profile=old;state.filters=oldFilters;}
      return false;
    }
    profileDraft=JSON.parse(JSON.stringify(next));syncChrome();
    if(!opts.silent)toast('画像已保存到账号，推荐排序已更新',{type:'success'});
    return true;
  } finally {if(generation===accountGeneration){profileSaving=false;controls.forEach(el=>el.disabled=false);syncProfileSaveState();}}
}

// 仅比较用户编辑的字段，预设来源等元信息不影响未保存判断。
function profileSignature(p) {
  return JSON.stringify([p.name, p.city, p.jobType, p.salaryMin, p.salaryMax, !!p.campusOnly, [...p.skills].sort()]);
}
function hasUnsavedProfile() {
  return page === "profile" && (profileSaving || (profileDraft && profileSignature(profileDraft) !== profileSignature(state.profile)));
}
function syncProfileSaveState() {
  const el = $("#profile-save-state");
  if (el) { el.textContent = hasUnsavedProfile() ? "有未保存的更改" : "画像已保存"; el.classList.toggle("dirty", !!hasUnsavedProfile()); }
}
