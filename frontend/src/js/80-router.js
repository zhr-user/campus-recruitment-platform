/* ============================================================
   Hash router + chrome sync
   ============================================================ */
const ROUTE_RENDERERS = {
  recommend: () => renderRecommend(),
  profile: () => renderProfile(),
  applications: () => renderApplications(),
  dashboard: () => renderDashboard(),
  experiment: () => renderExperiment(),
  admin: () => renderAdmin(),
};

function routeFromHash() {
  const raw = String(location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0].trim();
  return raw || '';
}

function isKnownRoute(route) {
  return Object.prototype.hasOwnProperty.call(PAGE_META, route);
}

function setHash(route) {
  const target = '#/' + route;
  if (location.hash !== target) history.replaceState(null, '', target);
}

function syncNav(route) {
  $$('.nav-item[data-page]').forEach((a) => {
    const active = a.dataset.page === route;
    a.setAttribute('aria-label', PAGE_META[a.dataset.page]?.title || a.textContent.trim());
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function syncTopbar(meta) {
  const kicker = $('#page-kicker');
  const title = $('#page-title');
  const sub = $('#page-sub');
  if (kicker) kicker.textContent = meta.kicker;
  if (title) title.textContent = meta.title;
  if (sub) sub.textContent = meta.sub;
}

function renderRoute(force = false) {
  if(!authReady)return;
  stopChartMotion();
  let route = routeFromHash();

  /* ---------- signed-out guard ---------- */
  if (!state.loggedIn) {
    page = 'login';
    if (location.hash !== '#/login') history.replaceState(null, '', '#/login');
    closeDrawer();
    closeModal();
    document.body.classList.remove('auth-mode');
    renderLogin();
    document.title = '登录 · 校招罗盘 Campus Compass';
    return;
  }

  /* ---------- signed-in: never show the login page ---------- */
  if (!route || route === 'login' || !isKnownRoute(route)) {
    route = isKnownRoute(state.lastPage) ? state.lastPage : 'recommend';
    setHash(route);
  }

  // 保留当前表单，用户确认放弃后才执行跨页导航。
  if (page === 'profile' && route !== page && hasUnsavedProfile()) {
    const target = route;
    setHash(page);
    confirmModal({ title: '画像还有未保存的更改', message: '离开后将放弃当前编辑。你可以先取消并保存画像。', confirmText: '放弃更改并离开', onConfirm: () => { profileDraft = null; location.hash = '#/' + target; } });
    return;
  }
  const changed = page !== route;
  page = route;
  state.lastPage = route;
  saveState();

  if (changed) {
    closeDrawer();
    closeModal();
  }

  document.body.classList.remove('auth-mode');
  syncNav(route);
  syncTopbar(PAGE_META[route]);
  document.title = `${PAGE_META[route].title} · 校招罗盘 Campus Compass`;
  ROUTE_RENDERERS[route]();
  $$('.chart-svg', $('#view')).forEach((svg) => {
    if (svg.viewBox.baseVal.width) svg.style.setProperty('--chart-width', svg.viewBox.baseVal.width + 'px');
  });
  syncChrome();

  if (force || changed) {
    const view = $('#view');
    if (view) view.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

window.addEventListener('hashchange', () => {
  renderRoute(false);
});

/* Expose for account modal / login / diagnostics. */
window.__CC_ROUTER__.renderRoute = renderRoute;
window.__CC_ROUTER__.navigate = (route) => {
  if (!isKnownRoute(route)) return;
  if (state.loggedIn) {
    if (location.hash === '#/' + route) renderRoute(true);
    else location.hash = '#/' + route;
  }
};

window.addEventListener("beforeunload", (event) => {
  if (state.loggedIn && (hasUnsavedProfile() || pendingWrites>0 || saveFailed)) { event.preventDefault(); event.returnValue = ""; }
});
