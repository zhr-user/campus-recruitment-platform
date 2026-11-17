import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
export async function openBrowser(workDir,url){
const profile=await mkdtemp(join(workDir,'chrome-auth-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-crash-reporter','--disable-breakpad','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq = 0, buffer = '', sid;
const pending = new Map();
const errors = [];
const results = [];
chrome.stdio[4].on('data', data => {
  buffer += data.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const raw = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    if (!raw) continue;
    const message = JSON.parse(raw);
    const task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((resolveCall, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error('浏览器调用超时：' + method)); }, 8000);
  pending.set(id, { resolve: resolveCall, reject, timer });
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const send = (method, params = {}) => cdp(method, params, sid);
const sleep = ms => new Promise(done => setTimeout(done, ms));
const evaluate = async (fn, arg) => {
  const expression = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + JSON.stringify(arg ?? null) + ')';
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
};
const click = async selector => {
  await evaluate(selector => {
    const element = document.querySelector(selector);
    if (!element) throw new Error('找不到控件：' + selector);
    element.focus();
    element.click();
  }, selector);
  await sleep(100);
};
const input = async (selector, value) => {
  await evaluate(({ selector, value }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error('找不到输入框：' + selector);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, value });
  await sleep(220);
};
const nav = async route => {
  await click('.nav-item[data-page="' + route + '"]');
  await sleep(80);
};
await cdp('Browser.getVersion');const target=await cdp('Target.createTarget',{url:'about:blank'});sid=(await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});await sleep(900);return {cdp,send,evaluate,click,input,nav,sleep,errors,chrome,profile,get sid(){return sid;},set sid(v){sid=v;},close:async()=>{try{await cdp('Browser.close');}catch{}chrome.kill();}};
}
