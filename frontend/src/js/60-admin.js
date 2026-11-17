/* 后台按服务端权限开放；未接入的采集能力显示真实空状态。 */
let adminJobsPage=0,adminJobsQ='',adminJobsSrc='';
const ADMIN_TABS=[{id:'jobs',label:'岗位库',icon:'briefcase'},{id:'sources',label:'数据源',icon:'database'},{id:'tasks',label:'采集任务',icon:'refresh'},{id:'dictionary',label:'技能词典',icon:'book'},{id:'quality',label:'质量监控',icon:'shield'}];
async function renderAdmin(){
  const root=$('#view');const generation=accountGeneration;
  const deny=message=>{root.innerHTML=emptyState('lock','后台需要管理员权限',esc(message),'<a class="btn btn-primary" href="#/recommend">返回工作台</a>');};
  if(state.role!=='admin'){deny(LOCAL_MODE?'离线演示模式下没有后台权限。双击「启动平台.cmd」启动服务，再用管理员账号登录即可查看后台。':'当前账号是求职者。管理员权限由服务维护者分配。');return;}
  root.innerHTML=emptyState('shield','正在校验后台权限','请稍候');
  let summary;
  try{summary=await api('/api/admin/summary');}
  catch(error){if(generation!==accountGeneration)return;if(error.status===401||error.code==='account_changed'){expireAccount(error.message);return;}if(page==='admin')deny(error.message);return;}
  if(page!=='admin'||generation!==accountGeneration)return;
  const tab=ADMIN_TABS.some(t=>t.id===state.adminTab)?state.adminTab:'jobs';
  root.innerHTML=`<div class="admin-shell panel"><div class="admin-top"><div><h2 style="font-size:15px">运营后台</h2><p class="tiny dim" style="margin-top:6px">权限已校验 · 账号 ${summary.users} 个 · 岗位来自已导入的历史数据</p></div><div class="tabs" id="admin-tabs">${ADMIN_TABS.map(t=>`<button class="${tab===t.id?'active':''}" data-tab="${t.id}" type="button">${icon(t.icon)}${t.label}</button>`).join('')}</div></div><div class="admin-body" id="admin-body"></div></div>`;
  $$('#admin-tabs button').forEach(button=>button.addEventListener('click',()=>{state.adminTab=button.dataset.tab;saveState();renderAdmin();}));
  const body=$('#admin-body');
  if(tab==='jobs'){
    body.innerHTML=`<div class="admin-kpis">${statCard('岗位样本',summary.jobs,'条','已导入历史数据','briefcase')}${statCard('来源 A',SOURCE_COUNTS.A,'条','历史数据集','database')}${statCard('来源 B',SOURCE_COUNTS.B,'条','历史数据集','database')}${statCard('技能词典',summary.skills,'项','用于匹配计算','book')}</div><div class="table-toolbar"><input class="input input-sm" id="admin-q" placeholder="搜索岗位、公司、城市" value="${esc(adminJobsQ)}"><select class="select select-sm" id="admin-src"><option value="">全部来源</option><option value="A" ${adminJobsSrc==='A'?'selected':''}>数据集 A</option><option value="B" ${adminJobsSrc==='B'?'selected':''}>数据集 B</option></select><button class="btn btn-sm" id="admin-export">${icon('download')}导出筛选结果</button></div><div id="admin-jobs-table"></div>`;
    $('#admin-q').addEventListener('input',debounce(event=>{adminJobsQ=event.target.value;adminJobsPage=0;paintAdminJobs();},150));$('#admin-src').addEventListener('change',event=>{adminJobsSrc=event.target.value;adminJobsPage=0;paintAdminJobs();});$('#admin-export').addEventListener('click',()=>downloadFile('岗位筛选结果.json',JSON.stringify(adminFilteredJobs(),null,2)));paintAdminJobs();
  }else if(tab==='sources'){
    body.innerHTML=`<div class="callout info">${icon('database')}<span>当前岗位库来自已导入的两个历史数据集，共 ${JOBS.length} 条。账号、会话与个人求职数据通过后端保存；在线采集服务尚未接入。</span></div><div class="stats-grid" style="margin-top:20px">${statCard('数据集 A',SOURCE_COUNTS.A,'条','城市、薪资、技能字段','database')}${statCard('数据集 B',SOURCE_COUNTS.B,'条','公开招聘描述与技能抽取','database')}</div><div class="panel" style="padding:20px;margin-top:20px"><h3>数据范围</h3><div style="margin-top:12px;display:grid;gap:10px;color:var(--ink-2);font-size:13px">${DB.meta.notes.map(note=>'<p>'+esc(note)+'</p>').join('')}</div></div>`;
  }else if(tab==='tasks'){
    body.innerHTML=emptyState('refresh','暂无采集任务','采集服务尚未接入，当前没有任务记录。岗位来自已导入的历史数据集。');
  }else if(tab==='dictionary'){
    body.innerHTML=`<div class="table-toolbar"><input class="input input-sm" id="dic-q" placeholder="搜索技能或分组"><button class="btn btn-sm" id="dic-export">${icon('download')}导出词典</button></div><p class="raw-note" style="margin-bottom:12px">词典随岗位数据导入，目前提供查询与导出。</p><div class="table-wrap"><table class="data-table"><thead><tr><th>技能</th><th>分组</th><th>样本出现次数</th></tr></thead><tbody id="dic-body"></tbody></table></div>`;
    const paint=()=>{const q=$('#dic-q').value.trim().toLowerCase();$('#dic-body').innerHTML=SKILLS.filter(s=>!q||(s.name+' '+s.group).toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.group)}</td><td>${s.count}</td></tr>`).join('')||'<tr><td colspan="3">未找到匹配技能</td></tr>';};$('#dic-q').addEventListener('input',paint);$('#dic-export').addEventListener('click',()=>downloadFile('技能词典.json',JSON.stringify(SKILLS,null,2)));paint();
  }else{
    const report=adminQualityStats();body.innerHTML=`<div class="admin-kpis">${statCard('岗位总数',report.total,'条','当前导入样本','briefcase')}${statCard('有效薪资',report.salary,'条','上下限有效且有交集','coins')}${statCard('包含技能',report.skills,'条','至少1项词典技能','zap')}${statCard('应届优先',report.campus,'条','原数据标签','award')}</div><div class="callout info">${icon('info')}<span>统计根据当前导入岗位直接计算。数据质量不代表岗位仍在招聘，请核对企业当前公告。</span></div><button class="btn" id="quality-export" style="margin-top:16px">${icon('download')}导出质量报告</button>`;$('#quality-export').addEventListener('click',()=>downloadFile('岗位质量报告.json',JSON.stringify(report,null,2)));
  }
}
function adminFilteredJobs(){const q=adminJobsQ.trim().toLowerCase();return JOBS.filter(j=>(!adminJobsSrc||j.source===adminJobsSrc)&&(!q||(j.title+' '+j.company+' '+j.city).toLowerCase().includes(q)));}
function paintAdminJobs(){
  const jobs=adminFilteredJobs(),size=12;adminJobsPage=clamp(adminJobsPage,0,Math.max(0,Math.ceil(jobs.length/size)-1));
  $('#admin-jobs-table').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>岗位 / 公司</th><th>城市</th><th>月薪</th><th>来源</th><th>操作</th></tr></thead><tbody>${jobs.slice(adminJobsPage*size,(adminJobsPage+1)*size).map(j=>`<tr><td><strong>${esc(j.title)}</strong><div class="tiny dim">${esc(j.company)}</div></td><td>${esc(j.city)}</td><td>${salaryText(j)}</td><td>${sourceBadge(j)}</td><td><button class="btn btn-sm" data-admin-job="${esc(j.id)}">查看</button></td></tr>`).join('')||'<tr><td colspan="5">没有找到匹配岗位</td></tr>'}</tbody></table></div><div class="row gap-8" style="margin-top:14px;justify-content:flex-end"><span class="tiny dim">共 ${jobs.length} 条 · 第 ${adminJobsPage+1} / ${Math.max(1,Math.ceil(jobs.length/size))} 页</span><button class="btn btn-sm" id="admin-prev" ${adminJobsPage===0?'disabled':''}>上一页</button><button class="btn btn-sm" id="admin-next" ${(adminJobsPage+1)*size>=jobs.length?'disabled':''}>下一页</button></div>`;
  $$('[data-admin-job]').forEach(button=>button.addEventListener('click',()=>openJobDrawer(button.dataset.adminJob,{from:'admin'})));$('#admin-prev').addEventListener('click',()=>{adminJobsPage--;paintAdminJobs();});$('#admin-next').addEventListener('click',()=>{adminJobsPage++;paintAdminJobs();});
}
function adminQualityStats(){return {total:JOBS.length,salary:JOBS.filter(j=>Number.isFinite(j.salaryMin)&&Number.isFinite(j.salaryMax)&&j.salaryMax>=j.salaryMin).length,skills:JOBS.filter(j=>j.skills.length>0).length,campus:JOBS.filter(j=>j.campus).length,calculatedAt:new Date().toISOString()};}
