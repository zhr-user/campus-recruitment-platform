/* 真实邮箱账号的注册与登录。 */
let authMode='login';
function renderLogin(mode=authMode,email='') {
  authMode=mode;const registering=mode==='register';document.body.classList.add('auth-mode');
  $('#view').innerHTML=`
  <section class="auth">
    <div class="auth-hero">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">${icon('compass')}</span><span><strong>校招罗盘</strong><small>CAMPUS COMPASS</small></span></div>
      <span class="auth-eyebrow"><i></i>从这里，找到你的下一站</span>
      <h1 class="auth-title"><span class="line">让每一次选择，</span><span class="line"><span class="grad-text">都有清晰的方向。</span></span></h1>
      <p class="auth-sub">把分散的岗位、你的技能与求职进展，放在同一个工作台。建立专属画像，发现适合的机会，记下走向 Offer 的每一步。</p>
      <div class="auth-stats"><div class="auth-stat"><b>${fmt(JOBS.length)}</b><span>岗位样本</span></div><div class="auth-stat"><b>${SKILLS.length}</b><span>技能标签</span></div><div class="auth-stat"><b>${CITIES.length}</b><span>覆盖城市</span></div></div>
      <div class="auth-feats"><span class="auth-feat">${icon('check')}匹配理由清楚可见</span><span class="auth-feat">${icon('check')}求职进度随时接续</span><span class="auth-feat">${icon('check')}每个账号独立保存</span></div>
      <div class="auth-visual" aria-hidden="true"><div class="auth-orbit"></div><div class="auth-orbit o2"></div><div class="auth-orbit o3"></div><div class="auth-core">${icon('compass')}</div></div>
      <div class="auth-copyright">校招信息聚合与智能推荐平台</div>
    </div>
    <div class="auth-panel">
      <form class="login-card glass" id="login-form">
        ${LOCAL_MODE?`<div class="offline-note">${icon('info')}<span><strong>离线演示模式</strong><br>直接双击 html 打开时没有本地服务，账号与求职数据只保存在这台电脑的浏览器里。需要真实账号服务、后台权限或多设备同步时，请双击「启动平台.cmd」。</span></div>`:''}
        <div class="auth-tabs" role="tablist" aria-label="账号操作"><button id="auth-login-tab" type="button" role="tab" aria-selected="${!registering}" aria-controls="auth-fields" class="${!registering?'active':''}">登录</button><button id="auth-register-tab" type="button" role="tab" aria-selected="${registering}" aria-controls="auth-fields" class="${registering?'active':''}">注册</button></div>
        <h2>${registering?'开启你的求职旅程':'欢迎回来'}</h2><p class="login-sub">${registering?'创建账号，建立属于你的求职空间。':'登录账号，继续向理想的机会迈进。'}</p>
        <div class="login-fields" id="auth-fields">
          ${registering?'<div class="field"><label for="login-name">昵称</label><input class="input" id="login-name" name="name" autocomplete="nickname" maxlength="24" placeholder="怎么称呼你" required></div>':''}
          <div class="field"><label for="login-account">邮箱</label><input class="input" id="login-account" name="email" type="email" autocomplete="username" maxlength="254" value="${esc(email)}" placeholder="请输入邮箱地址" spellcheck="false" required></div>
          <div class="field"><label for="login-password">密码</label><div style="position:relative"><input class="input" id="login-password" name="password" type="password" autocomplete="${registering?'new-password':'current-password'}" ${registering?'minlength="12"':''} maxlength="128" placeholder="${registering?'设置12至128位密码':'请输入密码'}" style="padding-right:44px" required><button class="pw-toggle" id="pw-toggle" type="button" aria-label="显示密码" aria-pressed="false">${icon('eye')}</button></div></div>
          ${registering?'<div class="field"><label for="login-confirm">确认密码</label><input class="input" id="login-confirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="再次输入密码" required></div>':''}
          <p id="login-error" class="form-error" role="alert" hidden></p>
          <div class="login-row"><label class="checkline"><input type="checkbox" id="login-remember" aria-describedby="remember-hint"><span>保持登录30天</span></label></div>
          <button class="btn btn-primary login-submit" id="login-submit" type="submit"><span>${registering?'创建账号':'登录工作台'}</span>${icon('arrow')}</button>
        </div>
        <p class="field-hint" id="remember-hint" style="margin-top:12px">不勾选时使用浏览器会话登录，最长12小时；公共设备建议关闭此选项。</p>
        <p class="login-foot">${LOCAL_MODE?'本机离线账号，数据保存在当前浏览器。':'个人求职数据按账号独立保存。'}<br>岗位来自历史数据集，请以企业当前公告为准。</p>
      </form>
    </div>
  </section>`;
  const form=$('#login-form'),submit=$('#login-submit');
  for(const [id,next] of [['#auth-login-tab','login'],['#auth-register-tab','register']]){
    $(id,form).addEventListener('click',()=>{if(mode!==next){const address=$('#login-account',form).value;renderLogin(next,address);$('#login-account').focus();}});
    $(id,form).addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const nextMode=registering?'login':'register';renderLogin(nextMode,$('#login-account',form).value);$(nextMode==='login'?'#auth-login-tab':'#auth-register-tab').focus();}});
  }
  $('#pw-toggle',form).addEventListener('click',()=>{
    const field=$('#login-password',form),show=field.type==='password';field.type=show?'text':'password';
    $('#pw-toggle',form).innerHTML=icon(show?'eye-off':'eye');$('#pw-toggle',form).setAttribute('aria-label',show?'隐藏密码':'显示密码');$('#pw-toggle',form).setAttribute('aria-pressed',String(show));
  });
  const showError=message=>{const el=$('#login-error',form);el.hidden=false;el.textContent=message;};
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(submit.disabled)return;
    const password=$('#login-password',form).value;
    if(registering&&password!==$('#login-confirm',form).value)return showError('两次输入的密码不一致');
    const body={email:$('#login-account',form).value.trim(),password,remember:$('#login-remember',form).checked,...(registering?{name:$('#login-name',form).value.trim()}:{})};
    $('#login-error',form).hidden=true;$$('input,button',form).forEach(el=>el.disabled=true);
    submit.innerHTML='<span>正在'+(registering?'创建账号':'登录')+'…</span><span class="spin"></span>';
    try {
      adoptAccount(await api('/api/auth/'+(registering?'register':'login'),'POST',body));
      history.replaceState(null,'','#/'+(registering?'profile':state.lastPage));renderRoute(true);
      toast(registering?'先补充技能和求职偏好，推荐会更准确。':'你的求职空间已恢复。',{title:(registering?'你好，':'欢迎回来，')+state.user.name,type:'success'});
    } catch(error){showError(error.message);}
    finally{if(form.isConnected){$$('input,button',form).forEach(el=>el.disabled=false);submit.innerHTML='<span>'+(registering?'创建账号':'登录工作台')+'</span>'+icon('arrow');}}
  });
}
