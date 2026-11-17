/* 启动时向服务端恢复会话，成功后显示页面。 */
(async function boot(){
  const veil=$('#boot');
  try {
    const line=veil?.querySelector('p');if(line)line.textContent='正在连接你的求职空间…';
    await restoreSession();authReady=true;renderRoute(true);syncChrome();document.body.classList.add('ready');
    veil?.classList.add('is-done');setTimeout(()=>veil?.remove(),520);
  }catch(error){
    if(veil){veil.innerHTML=`<div class="empty-ico">${icon('alert')}</div><strong>暂时无法打开平台</strong><p style="max-width:380px;text-align:center;padding:0 20px">${esc(error.message)}</p><button class="btn btn-primary" id="boot-retry" type="button">重新连接</button>`;$('#boot-retry').addEventListener('click',()=>location.reload());}
  }
})();
