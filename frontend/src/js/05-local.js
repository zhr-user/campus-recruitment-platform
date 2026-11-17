/* ============================================================
   离线演示模式（file://）
   直接双击 frontend/index.html 时没有本地服务，这里用浏览器
   本地存储复刻后端的最小账号与数据接口，让页面可以独立打开。
   通过启动平台.cmd（http://）打开时这一段完全不生效。
   ============================================================ */
const LOCAL_MODE = location.protocol === 'file:';
const LOCAL_NS = 'campus-compass.offline.v1.';
const LOCAL_SESSION_REMEMBER = 30 * 24 * 60 * 60 * 1000;
const LOCAL_SESSION_SHORT = 12 * 60 * 60 * 1000;
const LOCAL_PBKDF2_ITERATIONS = 120000;
const localMemory = new Map();

/* 浏览器禁用本地存储时退回内存，至少保证当前标签页可用。 */
function localReadRaw(key) {
  try { const value = window.localStorage.getItem(LOCAL_NS + key); if (value !== null) return value; } catch {}
  return localMemory.has(key) ? localMemory.get(key) : null;
}
function localWriteRaw(key, value) {
  localMemory.set(key, value);
  try { window.localStorage.setItem(LOCAL_NS + key, value); return true; } catch { return false; }
}
function localDropRaw(key) {
  localMemory.delete(key);
  try { window.localStorage.removeItem(LOCAL_NS + key); } catch {}
}
function localReadJSON(key) {
  const raw = localReadRaw(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function localWriteJSON(key, value) { return localWriteRaw(key, JSON.stringify(value)); }
function localError(message, status, code) { return Object.assign(new Error(message), { status, code }); }

/* ---------------- 密码 ---------------- */
function localHex(bytes) { return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''); }
function localRandomHex(size) {
  const bytes = new Uint8Array(size);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  return localHex(bytes);
}
async function localHashPassword(password, salt, iterations) {
  if (window.crypto?.subtle && typeof TextEncoder === 'function') {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
      return { algo: 'pbkdf2-sha256', hash: localHex(new Uint8Array(bits)) };
    } catch {}
  }
  /* 极端兜底：没有 WebCrypto 时用加盐迭代散列，只保护本机演示数据。 */
  const secret = salt + ':' + password;
  let h = 0x811c9dc5;
  for (let round = 0; round < 2000; round++) {
    for (let i = 0; i < secret.length; i++) { h ^= secret.charCodeAt(i) + round; h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return { algo: 'fnv1a-2000', hash: h.toString(16).padStart(8, '0') };
}

/* ---------------- 账号 ---------------- */
function localAccounts() { const list = localReadJSON('accounts'); return Array.isArray(list) ? list : []; }
function localSaveAccounts(list) { localWriteJSON('accounts', list); }
function localFindAccount(email) {
  const target = String(email || '').trim().toLowerCase();
  return localAccounts().find((account) => account.email === target) || null;
}
function localDefaultState() {
  const seed = freshState();
  const { profile, applications, favorites, algorithm, filters, adminTab, adminJobsOff, skillOff, lastPage } = seed;
  return { profile, applications, favorites, algorithm, filters, adminTab, adminJobsOff, skillOff, lastPage };
}
function localStateRecord(accountId) {
  const stored = localReadJSON('state.' + accountId);
  if (stored && stored.state && Number.isInteger(stored.version)) return stored;
  const record = { version: 0, state: localDefaultState() };
  localWriteJSON('state.' + accountId, record);
  return record;
}
function localAccountPayload(account) {
  const record = localStateRecord(account.id);
  return { user: { id: account.id, email: account.email, name: account.name, role: account.role || 'candidate' }, state: record.state, version: record.version };
}

/* ---------------- 会话 ---------------- */
function localClearSession() {
  localDropRaw('session');
  try { window.sessionStorage.removeItem(LOCAL_NS + 'session'); } catch {}
}
function localWriteSession(accountId, remember) {
  const ttl = remember ? LOCAL_SESSION_REMEMBER : LOCAL_SESSION_SHORT;
  const session = { accountId, expiresAt: Date.now() + ttl, remember: !!remember };
  localClearSession();
  if (remember) { localWriteJSON('session', session); return; }
  try { window.sessionStorage.setItem(LOCAL_NS + 'session', JSON.stringify(session)); }
  catch { localWriteJSON('session', session); }
}
function localReadSession() {
  let session = null;
  try { const raw = window.sessionStorage.getItem(LOCAL_NS + 'session'); if (raw) session = JSON.parse(raw); } catch {}
  if (!session) {
    session = localReadJSON('session');
    if (session && session.expiresAt && session.expiresAt <= Date.now()) { localDropRaw('session'); session = null; }
  }
  return session;
}
function localCurrentAccount() {
  const session = localReadSession();
  if (!session) return null;
  if (session.expiresAt && session.expiresAt <= Date.now()) { localClearSession(); return null; }
  const account = localAccounts().find((item) => item.id === session.accountId);
  if (!account) { localClearSession(); return null; }
  return account;
}

/* ---------------- 接口替身 ---------------- */
function localEmailValid(email) {
  return /^[^\s@]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email);
}
function localRequireAccount() {
  const account = localCurrentAccount();
  if (!account) throw localError('登录已过期，请重新登录。', 401);
  return account;
}
async function localApi(url, method = 'GET', body) {
  const path = String(url).split('?')[0].replace(/\/+$/, '') || '/';

  if (path === '/api/auth/me' && method === 'GET') return localAccountPayload(localRequireAccount());

  if (path === '/api/auth/register' && method === 'POST') {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const name = String(body?.name || '').trim();
    if (!localEmailValid(email)) throw localError('请输入有效的邮箱地址', 400);
    if (password.length < 12 || password.length > 128) throw localError('密码需要 12 至 128 位字符', 400);
    if (!name || name.length > 24) throw localError('昵称需要 1 至 24 个字符', 400);
    if (localFindAccount(email)) throw localError('这个邮箱已注册，请直接登录', 409);
    const salt = localRandomHex(16);
    const { algo, hash } = await localHashPassword(password, salt, LOCAL_PBKDF2_ITERATIONS);
    const account = { id: 'local_' + localRandomHex(8), email, name, role: 'candidate', salt, algo, iterations: LOCAL_PBKDF2_ITERATIONS, hash, createdAt: new Date().toISOString() };
    const list = localAccounts(); list.push(account); localSaveAccounts(list);
    localWriteSession(account.id, !!body?.remember);
    return localAccountPayload(account);
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const account = localFindAccount(email);
    const invalid = localError('账号或密码不正确', 401);
    if (!account) throw invalid;
    const result = await localHashPassword(password, account.salt, account.iterations || LOCAL_PBKDF2_ITERATIONS);
    if (result.algo !== account.algo || result.hash !== account.hash) throw invalid;
    localWriteSession(account.id, !!body?.remember);
    return localAccountPayload(account);
  }

  if (path === '/api/auth/logout' && method === 'POST') { localClearSession(); return { ok: true }; }

  if (path === '/api/state' && method === 'GET') {
    const account = localRequireAccount();
    const record = localStateRecord(account.id);
    return { state: record.state, version: record.version };
  }

  if (path === '/api/state' && method === 'PUT') {
    const account = localRequireAccount();
    const record = localStateRecord(account.id);
    if (Number(body?.version) !== record.version) throw localError('其他页面已更新数据，请刷新后继续', 409);
    const next = { version: record.version + 1, state: body?.state ?? record.state };
    localWriteJSON('state.' + account.id, next);
    return { version: next.version };
  }

  if (path === '/api/account' && method === 'PATCH') {
    const account = localRequireAccount();
    const name = String(body?.name || '').trim();
    if (!name || name.length > 24) throw localError('昵称需要 1 至 24 个字符', 400);
    account.name = name;
    localSaveAccounts(localAccounts().map((item) => (item.id === account.id ? account : item)));
    return { user: { id: account.id, email: account.email, name: account.name, role: account.role } };
  }

  if (path === '/api/admin/summary' && method === 'GET') {
    const account = localRequireAccount();
    if (account.role !== 'admin') throw localError('当前账号没有后台权限', 403);
    return { jobs: JOBS.length, skills: SKILLS.length, users: localAccounts().length, collectorConnected: false };
  }

  throw localError('离线演示模式不支持这个操作', 404);
}
