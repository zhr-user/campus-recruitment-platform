/* ============================================================
   校招罗盘 · core
   Data, state, formatting, overlays and shared helpers.
   All js/*.js files are wrapped into one IIFE by the build script, so later
   page modules can use these declarations directly.
   ============================================================ */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function bootError(message) {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.innerHTML = `<div class="empty-ico">${icon('alert')}</div><strong>岗位数据装载失败</strong><p style="max-width:420px;text-align:center;color:var(--ink-3);font-size:12px;line-height:1.7">${esc(message)}</p>`;
    }
    throw new Error(message);
  }

  let DB;
  try {
    DB = JSON.parse(document.getElementById('job-data').textContent);
  } catch (err) {
    bootError('内嵌 JSON 无法解析：' + err.message);
  }
  if (!DB || !Array.isArray(DB.jobs) || !DB.jobs.length) bootError('没有读到岗位样本。');

  const JOBS = DB.jobs.map((j) => ({
    ...j,
    skills: Array.isArray(j.skills) ? j.skills.filter(Boolean) : [],
    benefits: Array.isArray(j.benefits) ? j.benefits.filter(Boolean) : [],
  }));
  const JOB_MAP = new Map(JOBS.map((j) => [j.id, j]));
  const SKILLS = DB.skills || [];
  const SKILL_MAP = new Map(SKILLS.map((s) => [s.name, s]));
  const SKILL_GROUPS = [];
  for (const s of SKILLS) {
    let g = SKILL_GROUPS.find((x) => x.name === s.group);
    if (!g) { g = { name: s.group, skills: [] }; SKILL_GROUPS.push(g); }
    g.skills.push(s);
  }
  const CITIES = [...new Set(JOBS.map((j) => j.city))].filter((c) => c && c !== '未标注');
  CITIES.sort((a, b) => JOBS.filter((j) => j.city === b).length - JOBS.filter((j) => j.city === a).length);
  const JOB_TYPES = [...new Set(JOBS.map((j) => j.jobType))].filter(Boolean);
  const SOURCE_COUNTS = {
    A: JOBS.filter((j) => j.source === 'A').length,
    B: JOBS.filter((j) => j.source === 'B').length,
  };

  const APPLICATION_STATUSES = [
    { id: 'applied', label: '已投递', short: '投递', color: '#2563eb', hint: '简历已进入企业流程' },
    { id: 'written', label: '笔试', short: '笔试', color: '#7c3aed', hint: '在线测评 / 笔试进行中' },
    { id: 'interview', label: '面试', short: '面试', color: '#a16207', hint: '一面 / 二面 / HR 面' },
    { id: 'offer', label: 'Offer', short: 'Offer', color: '#15803d', hint: '已收到录用意向' },
    { id: 'closed', label: '已结束', short: '结束', color: '#94a3b8', hint: '流程结束或主动放弃' },
  ];
  const STATUS_MAP = new Map(APPLICATION_STATUSES.map((s) => [s.id, s]));

  const PAGE_META = {
    recommend: { kicker: '求职工作台', title: '智能推荐', sub: '把 400 条抽样岗位，收敛成一条可执行的求职路径', icon: 'spark' },
    profile: { kicker: '求职工作台', title: '我的画像', sub: '技能、城市与薪资偏好会即时进入推荐公式', icon: 'user' },
    applications: { kicker: '求职工作台', title: '投递看板', sub: '从投递到 Offer，每一次状态变化都有记录', icon: 'briefcase' },
    dashboard: { kicker: '数据洞察', title: '招聘洞察', sub: '400 条真实抽样岗位的城市、薪资与技能结构', icon: 'chart' },
    experiment: { kicker: '数据洞察', title: '算法实验', sub: '同一批岗位、十个虚拟画像，比较两种推荐策略', icon: 'flask' },
    admin: { kicker: '系统管理', title: '后台管理', sub: '数据源、采集任务、技能词典与质量监控', icon: 'shield' },
  };

  const DEFAULT_PROFILE = {name:'我的求职画像',preset:'custom',basePreset:'da-hz',skills:[],city:'',salaryMin:8000,salaryMax:18000,jobType:'',campusOnly:false};
  function freshState() {
    return {loggedIn:false,role:'candidate',user:{id:null,name:'',email:''},profile:{...DEFAULT_PROFILE,skills:[]},applications:[],favorites:[],algorithm:'rule',filters:{salaryOnly:true,city:'',jobType:'',campusOnly:false,favoritesOnly:false,keyword:'',sort:'score'},adminTab:'jobs',adminJobsOff:[],skillOff:[],lastPage:'recommend'};
  }
  let state=freshState();
  let serverVersion=0, savedSnapshot='', saveChain=Promise.resolve(true), pendingWrites=0, saveFailed=false, saveConflict=false, savePaused=false, accountGeneration=0;
  let authReady=false, logoutPending=false;
  async function api(url,method='GET',body) {
    // 双击 html（file://）时没有本地服务，改由浏览器本地存储应答。
    if(LOCAL_MODE)return localApi(url,method,body);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const headers={...(state.loggedIn?{'X-Account-Id':String(state.user.id)}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})};
      const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await response.json();
      if(!response.ok){const error=new Error(data.error||'操作失败，请重试');error.status=response.status;error.code=data.code;throw error;}
      return data;
    } catch(error) {
      if(error.status)throw error;
      throw Object.assign(new Error('暂时无法连接服务，请检查平台是否启动后重试'),{status:0});
    } finally { clearTimeout(timer); }
  }
  function privateState() {
    const {profile,applications,favorites,algorithm,filters,adminTab,adminJobsOff,skillOff,lastPage}=state;
    return {profile,applications,favorites,algorithm,filters,adminTab,adminJobsOff,skillOff,lastPage};
  }
  function adoptAccount(payload) {
    accountGeneration++;
    state={...freshState(),...payload.state,loggedIn:true,role:payload.user.role,user:payload.user};
    serverVersion=payload.version;savedSnapshot=JSON.stringify(privateState());saveChain=Promise.resolve(true);pendingWrites=0;saveFailed=false;saveConflict=false;savePaused=false;
    profileSaving=false;profileDraft=null;$('#toast-root')?.replaceChildren();
    syncChrome();syncSaveStatus();
  }
  function clearAccount() {
    accountGeneration++;state=freshState();profileSaving=false;profileDraft=null;serverVersion=0;savedSnapshot='';pendingWrites=0;saveFailed=false;saveConflict=false;savePaused=false;saveChain=Promise.resolve(true);
    logoutPending=false;authMode='login';closeDrawer(true,false);closeModal(false);$('#drawer-content')?.replaceChildren();$('#toast-root')?.replaceChildren();drawerReturnFocus=null;modalReturnFocus=null;syncChrome();
  }
  function expireAccount(message) {
    clearAccount();history.replaceState(null,'','#/login');renderRoute(true);
    toast(message||'登录已过期，请重新登录。未同步的更改尚未保存。',{type:'warn',timeout:7000});
  }
  function syncSaveStatus() {
    const el=$('#save-status');if(!el)return;
    el.textContent=saveConflict?'数据有冲突，刷新页面':saveFailed?'保存失败，点击重试':pendingWrites?'正在保存…':LOCAL_MODE?'已存到本机':'已同步';
    el.classList.toggle('sync-error',saveFailed||saveConflict);el.classList.toggle('sync-pending',pendingWrites>0);
    el.title=saveConflict?'其他窗口已修改此账号数据，请刷新后继续':saveFailed?'当前更改还未保存，点击重试':LOCAL_MODE?'离线演示模式：数据保存在本机浏览器':'个人数据按当前账号保存';
  }
  // 串行提交快照，使用服务端版本号保护多个窗口中的编辑。
  function saveState(opts={}) {
    if(savePaused&&state.loggedIn){
      if(!opts.retry)return Promise.resolve(false);
      const generation=accountGeneration;
      return saveChain.then(()=>{if(generation!==accountGeneration)return false;savePaused=false;saveFailed=false;return saveState();});
    }
    if(!state.loggedIn)return Promise.resolve(true);
    if(saveConflict)return Promise.resolve(false);
    const snapshot=JSON.stringify(privateState()),generation=accountGeneration;
    if(!pendingWrites&&snapshot===savedSnapshot){saveFailed=false;syncSaveStatus();return Promise.resolve(true);}
    pendingWrites++;syncSaveStatus();
    const task=saveChain.then(async()=>{
      if(generation!==accountGeneration)return false;
      if(snapshot===savedSnapshot)return true;
      if(saveConflict||savePaused)return false;
      try {
        const result=await api('/api/state','PUT',{state:JSON.parse(snapshot),version:serverVersion});
        if(generation!==accountGeneration)return false;
        serverVersion=result.version;savedSnapshot=snapshot;saveFailed=false;return true;
      } catch(error) {
        if(generation!==accountGeneration)return false;
        if(error.code==='account_changed'){expireAccount(error.message);return false;}
        saveFailed=true;savePaused=true;if(error.status===409)saveConflict=true;
        toast(error.message,{title:'更改尚未保存',type:'error',timeout:7000});
        if(error.status===401)expireAccount();
        return false;
      }
    }).finally(()=>{if(generation===accountGeneration){pendingWrites--;syncSaveStatus();}});
    saveChain=task;return task;
  }
  async function restoreSession() {
    try {adoptAccount(await api('/api/auth/me'));}
    catch(error){if(error.status!==401)throw error;clearAccount();}
  }

  /* ---------------- formatting ---------------- */
  const nf = new Intl.NumberFormat('zh-CN');
  const fmt = (n) => nf.format(Math.round(Number(n) || 0));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round1 = (n) => Math.round(Number(n) * 10) / 10;

  function kFmt(v) {
    const n = Number(v) || 0;
    const k = n / 1000;
    const s = k >= 10 ? (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) : k.toFixed(1);
    return s.replace(/\.0$/, '') + 'K';
  }
  function salaryText(job) {
    return `${kFmt(job.salaryMin)}-${kFmt(job.salaryMax)}`;
  }
  function salaryFull(job) {
    return `${fmt(job.salaryMin)} - ${fmt(job.salaryMax)} 元/月`;
  }
  function pct(n) { return `${Math.round(Number(n) || 0)}%`; }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function stripTags(html) { return String(html || '').replace(/<[^>]*>/g, ''); }

  function icon(name, cls = '') {
    return `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function initials(name) {
    const s = String(name || '?').trim();
    if (!s) return '?';
    if (/^[A-Za-z]/.test(s)) {
      return s.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    }
    return s.slice(0, 1);
  }

  function dateCN(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }
  function dateTimeCN(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(10, 30, 0, 0);
    return d.toISOString();
  }
  function relTime(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Math.max(0, Date.now() - t);
    const day = Math.floor(diff / 86400000);
    if (day <= 0) return '今天';
    if (day === 1) return '昨天';
    if (day < 7) return `${day} 天前`;
    return dateCN(iso);
  }

  function debounce(fn, wait = 200) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function countBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
      const k = keyFn(item);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }
  function median(nums) {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return 0;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  function percentile(nums, p) {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return 0;
    const idx = clamp((a.length - 1) * p, 0, a.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }

  function scoreColor(score) {
    if (score >= 80) return '#0f766e';
    if (score >= 65) return '#2563eb';
    if (score >= 50) return '#a16207';
    return '#be123c';
  }
  function scoreLabel(score) {
    if (score >= 80) return '高度匹配';
    if (score >= 65) return '值得投递';
    if (score >= 50) return '可以尝试';
    return '匹配偏弱';
  }

  function ring(score, color = scoreColor(score), extra = '', label = '匹配分') {
    return `<div class="score-ring ${extra}" style="--score:${clamp(score, 0, 100).toFixed(1)};--ring:${color}"><span class="inner"><b>${Math.round(score)}</b><small>${esc(label)}</small></span></div>`;
  }

  function sourceBadge(job) {
    return job.source === 'B'
      ? `<span class="badge badge-b">${icon('database')}数据集 B</span>`
      : `<span class="badge badge-a">${icon('database')}数据集 A</span>`;
  }
  function campusBadge(job) {
    return job.campus ? `<span class="badge badge-campus">${icon('award')}应届优先</span>` : '';
  }
  function statusBadge(statusId) {
    const s = STATUS_MAP.get(statusId) || APPLICATION_STATUSES[0];
    return `<span class="badge" style="color:${s.color};background:${hexToRgba(s.color, .09)};border-color:${hexToRgba(s.color, .18)}"><i></i>${s.label}</span>`;
  }
  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ---------------- state interactions ---------------- */
  function getUserRoleLabel() {
    return state.role === 'admin' ? '管理员' : '求职者';
  }

  function syncChrome() {
    const name = state.user.name || '用户';
    const av = initials(name);
    $$('.nav-item[data-page="admin"]').forEach(el=>el.hidden=state.role!=='admin');
    const group=$('#admin-nav-label');if(group)group.hidden=state.role!=='admin';
    const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
    setText('#sidebar-name', name);
    setText('#sidebar-role', getUserRoleLabel());
    setText('#sidebar-avatar', av);
    const top = $('#top-avatar'); if (top) top.textContent = av;
    const sample = $('#sidebar-sample'); if (sample) sample.textContent = `${DB.meta.sampleTotal} 条`;
    const badge = $('#nav-app-count');
    if (badge) {
      const n = state.applications.filter((a) => a.status !== 'closed').length;
      badge.textContent = String(n);
      badge.style.display = n ? '' : 'none';
    }
  }

  function getApplications() {
    return state.applications
      .map((a) => ({ ...a, job: JOB_MAP.get(a.jobId) }))
      .filter((a) => a.job);
  }
  function applicationForJob(jobId) {
    return state.applications.find((a) => a.jobId === jobId) || null;
  }
  function favoriteJob(jobId) {
    return state.favorites.includes(jobId);
  }

  function addApplication(jobId, opts = {}) {
    const job = JOB_MAP.get(jobId);
    if (!job) return { ok: false, reason: 'missing' };
    const existing = applicationForJob(jobId);
    if (existing) {
      if (opts.silent) return { ok: false, reason: 'exists', app: existing };
      toast('这个岗位已经在投递看板里了', { title: '无需重复添加', type: 'info' });
      return { ok: false, reason: 'exists', app: existing };
    }
    const now = new Date().toISOString();
    const app = {
      id: 'app_' + jobId + '_' + Date.now().toString(36),
      jobId,
      status: 'applied',
      createdAt: now,
      updatedAt: now,
      note: '',
      history: [{ status: 'applied', at: now }],
    };
    state.applications.unshift(app);
    saveState();
    syncChrome();
    if (!opts.silent) {
      toast(`${job.title} · ${job.company}`, { title: '已加入投递看板', type: 'success' });
    }
    return { ok: true, app };
  }

  function updateApplicationStatus(appId, nextStatus, note) {
    const app = state.applications.find((a) => a.id === appId);
    if (!app || !STATUS_MAP.has(nextStatus)) return false;
    if (app.status === nextStatus) return false;
    app.status = nextStatus;
    app.updatedAt = new Date().toISOString();
    if (typeof note === 'string') app.note = note;
    app.history = app.history || [];
    app.history.push({ status: nextStatus, at: app.updatedAt });
    app.history=app.history.slice(-100);
    saveState();
    syncChrome();
    return true;
  }

  function toggleFavorite(jobId) {
    const idx = state.favorites.indexOf(jobId);
    if (idx >= 0) state.favorites.splice(idx, 1);
    else state.favorites.push(jobId);
    saveState();
    return idx < 0;
  }

  /* ---------------- overlays ---------------- */
  let toastSeq = 0;
  function toast(message, opts = {}) {
    const root = $('#toast-root');
    if (!root) return;
    const type = opts.type || 'info';
    const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'info';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.dataset.toast = String(++toastSeq);
    el.innerHTML = `${icon(iconName)}<div><strong>${esc(opts.title || '提示')}</strong>${esc(message || '')}</div>`;
    root.appendChild(el);
    while (root.children.length > 4) root.removeChild(root.firstElementChild);
    el.addEventListener('click', () => dismissToast(el));
    const timer = setTimeout(() => dismissToast(el), opts.timeout || 3600);
    el._timer = timer;
  }
  function dismissToast(el) {
    if (!el || !el.parentNode) return;
    clearTimeout(el._timer);
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 240);
  }

  function syncScrollLock() {
    const drawerOpen = $('#drawer')?.classList.contains('open');
    const modalOpen = !!$('#modal-root .modal-backdrop');
    const paletteOpen = !!$('#modal-root .palette');
    const locked = !!(drawerOpen || modalOpen || paletteOpen);
    document.body.classList.toggle('lock', locked);
    if ($('#app')) $('#app').inert = locked;
    if ($('#drawer')) $('#drawer').inert = !drawerOpen || modalOpen;
  }

  let activeModal = null;
  let drawerReturnFocus = null;
  let modalReturnFocus = null;
  let drawerCloseTimer = null;
  function openModal(opts = {}) {
    const root = $('#modal-root');
    if (!root) return () => {};
    const origin = root.children.length ? modalReturnFocus : document.activeElement;
    modalReturnFocus = $('#drawer')?.classList.contains('open') ? drawerReturnFocus : origin;
    closeDrawer(true, false);
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal ${opts.wide ? 'wide' : ''} ${opts.variant === 'search' ? 'modal-search' : ''}" role="dialog" aria-modal="true" aria-label="${esc(stripTags(opts.title || '对话框'))}">
          ${opts.variant === 'search' ? '' : `<div class="modal-head">
            <div><h3>${opts.title || ''}</h3>${opts.sub ? `<p>${opts.sub}</p>` : ''}</div>
            <button class="modal-close" type="button" data-close aria-label="关闭">${icon('x')}</button>
          </div>`}
          <div class="modal-body">${opts.body || ''}</div>
          ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
        </div>
      </div>`;
    const backdrop = $('.modal-backdrop', root);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && opts.dismissible !== false) closeModal(); });
    $$('[data-close]', root).forEach((b) => b.addEventListener('click', closeModal));
    activeModal = root.firstElementChild;
    syncScrollLock();
    opts.onMount?.(root, closeModal);
    const focusable = root.querySelector('input, select, textarea, button');
    setTimeout(() => focusable?.focus(), 60);
    return closeModal;
  }
  function closeModal(restoreFocus = true) {
    const root = $('#modal-root');
    if (root) root.innerHTML = '';
    activeModal = null;
    syncScrollLock();
    if (restoreFocus !== false && modalReturnFocus?.isConnected && !$('#app')?.inert) modalReturnFocus.focus({ preventScroll: true });
  }

  function openDrawer(html, onMount) {
    const origin = $('#modal-root')?.children.length ? modalReturnFocus : document.activeElement;
    closeModal(false);
    const drawer = $('#drawer');
    const content = $('#drawer-content');
    const overlay = $('#overlay');
    if (!drawer || !content) return;
    if (!drawer.classList.contains('open')) drawerReturnFocus = origin;
    clearTimeout(drawerCloseTimer);
    content.innerHTML = html;
    const actions = $('.detail-actions', content);
    if (actions) content.appendChild(actions);
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.tabIndex = -1;
    overlay.hidden = false;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    syncScrollLock();
    onMount?.(content);
    $('#drawer .drawer-body')?.scrollTo({ top: 0 });
    ($('#drawer-close', content) || drawer).focus({ preventScroll: true });
  }
  function closeDrawer(immediate = false, restoreFocus = true) {
    const drawer = $('#drawer');
    const overlay = $('#overlay');
    if (!drawer) return;
    const wasOpen = drawer.classList.contains('open');
    clearTimeout(drawerCloseTimer);
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) {
      if (immediate) overlay.hidden = true;
      else drawerCloseTimer = setTimeout(() => { if (!drawer.classList.contains('open')) overlay.hidden = true; }, 280);
    }
    syncScrollLock();
    if (wasOpen && restoreFocus && !$('#app')?.inert) {
      (drawerReturnFocus?.isConnected ? drawerReturnFocus : $('#view'))?.focus({ preventScroll: true });
    }
  }

  // 所有弹层共用键盘焦点边界，防止 Tab 落到背景页面。
  function trapOverlayFocus(event) {
    const scope = $('#modal-root .modal') || ($('#drawer')?.classList.contains('open') ? $('#drawer') : null);
    if (!scope || event.key !== 'Tab') return;
    const targets = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]', scope).filter((el) => el.getClientRects().length && !el.closest('[inert]'));
    const first = targets[0], last = targets[targets.length - 1];
    if (!first) { event.preventDefault(); scope.focus(); return; }
    if (!scope.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  }

  function confirmModal(opts = {}) {
    openModal({
      title: opts.title || '请确认',
      sub: opts.sub || '',
      body: `<p style="font-size:12px;line-height:1.8;color:var(--ink-2)">${opts.message || ''}</p>`,
      footer: `<button class="btn" data-close>取消</button><button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="confirm-yes">${esc(opts.confirmText || '确认')}</button>`,
      onMount(root, close) {
        $('#confirm-yes', root).addEventListener('click', () => {
          close();
          opts.onConfirm?.();
        });
      },
    });
  }

  function copyText(text) {
    const done = () => toast('内容已复制到剪贴板', { title: '已复制', type: 'success' });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { toast('复制失败，请手动选择', { type: 'warn' }); }
    ta.remove();
  }

  function downloadFile(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function emptyState(iconName, title, desc, action = '') {
    return `<div class="empty"><div class="empty-ico">${icon(iconName)}</div><strong>${esc(title)}</strong><p>${desc}</p>${action}</div>`;
  }

  /* ---------------- tooltip ---------------- */
  (function initTooltip() {
    const tip = () => $('#tooltip');
    document.addEventListener('pointerover', (e) => {
      const target = e.target.closest?.('[data-tip]');
      if (!target) return;
      const el = tip();
      el.textContent = target.getAttribute('data-tip');
      el.classList.add('show');
      const r = target.getBoundingClientRect();
      const width = el.offsetWidth;
      const left = clamp(r.left + r.width / 2 - width / 2, 8, window.innerWidth - width - 8);
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(8, r.top - el.offsetHeight - 8)}px`;
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest?.('[data-tip]')) tip().classList.remove('show');
    });
    window.addEventListener('scroll', () => tip().classList.remove('show'), { passive: true });
  })();

  /* ---------------- search palette ---------------- */
  function openPalette(initial = '') {
    if (!state.loggedIn) return;
    const recent = JOBS.slice(0, 6);
    openModal({
      title: '搜索岗位',
      variant: 'search',
      body: `<div class="palette">
        <div class="palette-input">${icon('search')}<input id="palette-input" type="search" aria-label="搜索岗位、公司、技能或城市" placeholder="搜索岗位、公司、技能或城市…" autocomplete="off" value="${esc(initial)}"><kbd>ESC</kbd><button class="modal-close palette-close" type="button" data-close aria-label="关闭搜索">${icon('x')}</button></div>
        <div class="palette-results" id="palette-results"></div>
        <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开详情</span><span style="margin-left:auto">共 ${fmt(JOBS.length)} 条岗位样本</span></div>
      </div>`,
      onMount(root, close) {
        const input = $('#palette-input', root);
        const results = $('#palette-results', root);
        let activeIndex = 0;
        let list = recent;
        const render = () => {
          const q = input.value.trim().toLowerCase();
          list = !q ? recent : JOBS.filter((j) => {
            const hay = `${j.title} ${j.company} ${j.city} ${j.jobType} ${j.skills.join(' ')}`.toLowerCase();
            return hay.includes(q);
          }).slice(0, 10);
          activeIndex = 0;
          if (!list.length) {
            results.innerHTML = `<div class="palette-empty">没有找到匹配岗位，换个关键词试试</div>`;
            return;
          }
          results.innerHTML = list.map((j, i) => `
            <button class="palette-item ${i === 0 ? 'active' : ''}" data-job="${esc(j.id)}">
              <span class="p-ico">${icon('briefcase')}</span>
              <span><strong>${esc(j.title)}</strong><small>${esc(j.company)} · ${esc(j.city)} · ${salaryText(j)}</small></span>
              <span class="p-score">${Math.round(scoreJobRule(state.profile, j).total)}</span>
            </button>`).join('');
          $$('.palette-item', results).forEach((btn) => {
            btn.addEventListener('click', () => {
              close();
              setTimeout(() => openJobDrawer(btn.dataset.job, { from: 'palette' }), 100);
            });
          });
        };
        const choose = () => {
          const job = list[activeIndex];
          if (!job) return;
          close();
          setTimeout(() => openJobDrawer(job.id, { from: 'palette' }), 100);
        };
        input.addEventListener('input', debounce(render, 110));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!list.length) return;
            activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
            $$('.palette-item', results).forEach((el, i) => el.classList.toggle('active', i === activeIndex));
            $$('.palette-item', results)[activeIndex]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose();
          }
        });
        render();
        setTimeout(() => input.focus(), 80);
      },
    });
  }

  /* ---------------- account menu ---------------- */
  function openAccountModal() {
    if(!state.loggedIn)return;
    openModal({title:'账号设置',sub:'管理你的个人求职空间',body:`
      <div class="row gap-12" style="padding:4px 0 16px"><span class="avatar" style="width:46px;height:46px;font-size:16px">${esc(initials(state.user.name))}</span><div><strong>${esc(state.user.name)}</strong><div class="tiny dim">${getUserRoleLabel()}</div></div><span class="badge badge-success" style="margin-left:auto">已登录</span></div>
      <div class="kv"><span>登录邮箱</span><b style="overflow-wrap:anywhere">${esc(state.user.email)}</b></div>${LOCAL_MODE?'<div class="kv"><span>运行模式</span><b>离线演示 · 本机浏览器</b></div>':''}<div class="kv"><span>投递记录</span><b>${state.applications.length} 条</b></div><div class="divider"></div>
      <div class="field"><label for="account-name">昵称</label><input class="input" id="account-name" maxlength="24" value="${esc(state.user.name)}" autocomplete="nickname"></div>
      <p class="form-error" id="account-error" role="alert" hidden></p>
      <button class="btn btn-quiet" id="account-logout" type="button" style="margin-top:16px">${icon('logout')}退出登录</button>`,footer:'<button class="btn" data-close>取消</button><button class="btn btn-primary" id="account-save">保存昵称</button>',
      onMount(root,close){
        const generation=accountGeneration;
        $('#account-logout',root).addEventListener('click',()=>{close();logout();});
        $('#account-save',root).addEventListener('click',async()=>{
          const button=$('#account-save',root),name=$('#account-name',root).value.trim();if(!name){$('#account-error',root).hidden=false;$('#account-error',root).textContent='请输入昵称';return;}
          button.disabled=true;
          try {const result=await api('/api/account','PATCH',{name});if(generation!==accountGeneration)return;state.user=result.user;state.role=result.user.role;syncChrome();close();toast('昵称已更新',{type:'success'});}
          catch(error){if(generation!==accountGeneration)return;if(error.code==='account_changed'){expireAccount(error.message);return;}const el=$('#account-error',root);if(el){el.hidden=false;el.textContent=error.message;}if(error.status===401)expireAccount();}
          finally{button.disabled=false;}
        });
      }
    });
  }
  function logout() {
    if(logoutPending)return;
    const generation=accountGeneration;
    confirmModal({title:'退出登录',message:hasUnsavedProfile()?'画像还有未保存的编辑，退出将放弃这些编辑。已经同步的记录会保留在你的账号中。':'已同步的画像、收藏与投递记录会保留在你的账号中。',confirmText:'退出登录',
      onConfirm:async()=>{
        if(generation!==accountGeneration||logoutPending)return;
        logoutPending=true;
        try {
          const saved=await saveState({retry:true});if(generation!==accountGeneration)return;
          if(!saved&&state.loggedIn){toast('请先处理未同步的更改，再退出登录。',{type:'warn'});return;}
          if(!state.loggedIn)return;
          await api('/api/auth/logout','POST',{});if(generation!==accountGeneration)return;
          clearAccount();history.replaceState(null,'','#/login');renderRoute(true);toast('已退出登录',{type:'info'});
        }catch(error){
          if(generation!==accountGeneration)return;
          if(error.code==='account_changed')expireAccount(error.message);
          else if(error.status===401){clearAccount();renderRoute(true);}
          else toast(error.message,{type:'error'});
        }finally{if(generation===accountGeneration)logoutPending=false;}
      }
    });
  }

  /* ---------- shared render bits ---------- */
  function pageHead(title, desc, actions = '') {
    return `<div class="page-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;
  }

  function statCard(label, value, unit, foot, iconName, accent = false) {
    return `<div class="stat ${accent ? 'stat-accent' : ''}">
      <div class="stat-label">${iconName ? icon(iconName) : ''}${label}</div>
      <div class="stat-value">${value}${unit ? `<small>${unit}</small>` : ''}</div>
      <div class="stat-foot">${foot || ''}</div>
    </div>`;
  }

  function jobStatusChip(label, color) {
    return `<span class="tag" style="color:${color};background:${hexToRgba(color, .08)};border-color:${hexToRgba(color, .16)}">${label}</span>`;
  }

  // Expose the small set needed by later page modules (same IIFE scope).
  Object.assign(window, {
    CC: {
      $, $$, DB, JOBS, JOB_MAP, SKILLS, SKILL_MAP, SKILL_GROUPS, CITIES, JOB_TYPES,
      SOURCE_COUNTS, APPLICATION_STATUSES, STATUS_MAP, PAGE_META, DEFAULT_PROFILE,
      get state() { return state; },
      set state(v) { state = v; },
      saveState, syncChrome, getUserRoleLabel,
      getApplications, applicationForJob, favoriteJob,
      addApplication, updateApplicationStatus, toggleFavorite,
      toast, openModal, closeModal, openDrawer, closeDrawer, confirmModal,
      openPalette, openAccountModal, logout, copyText, downloadFile,
      emptyState, pageHead, statCard, jobStatusChip,
      fmt, kFmt, salaryText, salaryFull, esc, icon, initials, dateCN, dateTimeCN, relTime, daysAgo,
      debounce, countBy, median, percentile, clamp, round1, pct,
      scoreColor, scoreLabel, ring, sourceBadge, campusBadge, statusBadge, hexToRgba,
      get page() { return page; },
    },
  });

  // Declared after Object.assign on purpose: later files and the accessor see it.
  let page = 'login';

  /* Route + render entry points are defined in 80-router.js; hoisted function refs are fine. */
  window.addEventListener('keydown', (e) => {
    trapOverlayFocus(e);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.loggedIn) openPalette();
    }
    if (e.key === 'Escape') {
      if ($('#modal-root')?.children.length) closeModal();
      else if ($('#drawer')?.classList.contains('open')) closeDrawer();
    }
  });

  $('#overlay')?.addEventListener('click', () => closeDrawer());
  $('#search-trigger')?.addEventListener('click', () => openPalette());
  $('#user-card')?.addEventListener('click', openAccountModal);
  $('#top-avatar')?.addEventListener('click', openAccountModal);
  $('#topbar-bell')?.addEventListener('click', () => {
    const count=state.applications.filter(a=>a.status==='interview'||a.status==='written').length;
    toast(count?`你有 ${count} 个笔试或面试流程，可到投递看板查看。`:'暂无待跟进的笔试或面试流程。',{title:'流程提醒',type:'info'});
  });

  $('#save-status')?.addEventListener('click',()=>{if(saveConflict)location.reload();else saveState({retry:true});});

  // Bridge for router: functions are declared later in the same bundle scope.
  window.__CC_ROUTER__ = {
    get page() { return page; },
    set page(v) { page = v; },
  };
