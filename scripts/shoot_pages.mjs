import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'D:\\校招信息聚合与智能推荐平台项目';
const SHOTS = `${ROOT}\\docs\\shots`;
const PROFILE = `${ROOT}\\frontend\\.chrome-cdp-${Date.now()}`;
const PORT = 9224;
const URL = 'http://127.0.0.1:8791/index.html#/login';
mkdirSync(SHOTS, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-breakpad',
  '--disable-crash-reporter', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

const waitVersion = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not start');
};

let ws;
let seq = 0;
const pending = new Map();
const events = [];
const errors = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  await waitVersion();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const target = list.find((t) => t.type === 'page');
  if (!target) throw new Error('no page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push(msg.params.entry.text);
      }
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result?.value;
  };

  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(`${SHOTS}\\${name}.png`, Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  };

  await send('Page.navigate', { url: URL });
  await sleep(2200);
  await shot('02-login');
  await evaluate(`document.querySelector('#login-tour').click()`);
  await sleep(500);
  await shot('02b-tour');
  await evaluate('window.CC.closeModal()');
  await sleep(250);

  await evaluate(`document.querySelector('#login-submit').click()`);
  await sleep(2000);
  console.log('after login hash:', await evaluate('location.hash'), 'page:', await evaluate('window.CC.page'));
  await shot('03-recommend');
  await evaluate(`document.querySelector('.job-card').click()`);
  await sleep(650);
  await shot('03b-job-detail');
  await evaluate('window.CC.closeDrawer()');
  await sleep(250);

  const routes = [
    ['profile', '04-profile'],
    ['applications', '05-applications'],
    ['dashboard', '06-dashboard'],
    ['experiment', '07-experiment'],
  ];
  for (const [route, name] of routes) {
    await evaluate(`location.hash = '#/${route}'`);
    await sleep(1100);
    await evaluate('window.scrollTo(0,0)');
    await sleep(250);
    console.log(route, 'page:', await evaluate('window.CC.page'), 'title:', await evaluate('document.title'), 'text:', (await evaluate('document.body.innerText')).slice(0, 80).replace(/\\s+/g, ' '));
    await shot(name);
    if (['profile', 'dashboard', 'experiment'].includes(route)) {
      await evaluate('window.scrollTo(0, 780)');
      await sleep(300);
      await shot(name.replace(/^0(\d)/, '0$1b'));
      await evaluate('window.scrollTo(0, 1450)');
      await sleep(300);
      await shot(name.replace(/^0(\d)/, '0$1c'));
      await evaluate('window.scrollTo(0,0)');
    }
    if (route === 'experiment') {
      console.log('EXP METRICS', await evaluate(`[...document.querySelectorAll('.exp-metrics .stat-value')].map(e=>e.innerText.trim()).join(' | ')`));
      console.log('EXP TABLE', await evaluate(`JSON.stringify([...document.querySelectorAll('table.data tbody tr')].map(tr=>[...tr.cells].map(td=>td.innerText.trim().replace(/\\s+/g,' '))))`));
    }
  }

  await evaluate(`window.CC.state.role = 'admin'; window.CC.saveState(); location.hash = '#/admin'`);
  await sleep(1200);
  await evaluate('window.scrollTo(0,0)');
  await sleep(250);
  console.log('admin page:', await evaluate('window.CC.page'), 'text:', (await evaluate('document.body.innerText')).slice(0, 100).replace(/\\s+/g, ' '));
  await shot('08-admin');
  for (const [tab, name] of [['sources', '08b-admin-sources'], ['tasks', '08c-admin-tasks'], ['dictionary', '08d-admin-dict'], ['quality', '08e-admin-quality']]) {
    await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);
    await sleep(600);
    await shot(name);
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate(`location.hash = '#/recommend'`);
  await sleep(800);
  await shot('09-recommend-1100');
  console.log('1100 overflow:', await evaluate(`JSON.stringify({scrollW:document.documentElement.scrollWidth, inner:innerWidth, board:document.querySelector('.board')?.scrollWidth})`));
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(600);
  await shot('10-recommend-860');
  console.log('860 overflow:', await evaluate(`JSON.stringify({scrollW:document.documentElement.scrollWidth, inner:innerWidth, board:document.querySelector('.board')?.scrollWidth})`));
  await evaluate(`location.hash = '#/experiment'`);
  await sleep(800);
  await shot('11-experiment-860');

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
  await evaluate(`location.hash = '#/recommend'`);
  await sleep(700);
  await shot('12-recommend-1600');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  await shot('13-recommend-390');
  await evaluate(`location.hash = '#/dashboard'`);
  await sleep(700);
  await shot('14-dashboard-390');
  console.log('390 overflow:', await evaluate(`JSON.stringify({scrollW:document.documentElement.scrollWidth, inner:innerWidth})`));

  console.log('ERRORS', JSON.stringify(errors, null, 2));
  ws.close();
}

try {
  await main();
} catch (err) {
  console.error('FAILED', err);
} finally {
  try {
    const { spawnSync } = await import('node:child_process');
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {}
  process.exit(0);
}
