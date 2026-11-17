/* 鼠标方向决定波纹朝向；空闲、失焦或页面离开时完整清理。 */
(function initAmbientBackground(){
  const canvas=$('#ripple-canvas'),background=$('.ambient-background');if(!canvas||!background)return;
  const context=canvas.getContext('2d');if(!context)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');
  const lifetime=1600,minDistance=36,minInterval=80,maxWaves=12;
  let width=0,height=0,ratio=1,frame=0,expiryTimer=0,waves=[],previous=null,lastEmission=0;
  const enabled=()=>!reduced.matches&&fine.matches&&!document.hidden;
  function clearCanvas(){
    // 使用实际像素尺寸清空，避免缩放后的边缘像素残留。
    context.save();context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,canvas.width,canvas.height);context.beginPath();context.restore();
  }
  function stop(){
    if(frame)cancelAnimationFrame(frame);if(expiryTimer)clearTimeout(expiryTimer);
    frame=0;expiryTimer=0;waves=[];previous=null;lastEmission=0;
    clearCanvas();canvas.hidden=true;
  }
  function resize(){
    width=innerWidth;height=innerHeight;ratio=Math.min(1,1000/Math.max(width,height));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);
    stop();
  }
  function draw(now){
    frame=0;waves=waves.filter(wave=>now-wave.born<lifetime);
    if(!enabled()||!waves.length){stop();return;}
    clearCanvas();
    for(const wave of waves){
      // 同一帧内事件时间可能略晚于动画帧时间，年龄始终约束在有效范围。
      const age=Math.max(0,Math.min(1,(now-wave.born)/lifetime));
      const ease=1-Math.pow(1-age,2),radius=22+ease*185;
      context.save();context.translate(wave.x+wave.dx*ease*28,wave.y+wave.dy*ease*28);context.rotate(wave.angle);context.scale(1+wave.speed*.22,.72);
      context.lineWidth=2.2+age*4;context.strokeStyle='rgba(112,122,134,'+(.15*Math.pow(1-age,1.6))+')';
      context.beginPath();context.arc(0,0,radius,0,Math.PI*2);context.stroke();
      context.lineWidth=14;context.strokeStyle='rgba(255,255,255,'+(.32*Math.pow(1-age,2))+')';context.beginPath();context.arc(0,0,radius-10,0,Math.PI*2);context.stroke();context.restore();
    }
    frame=requestAnimationFrame(draw);
  }
  function pointer(event){
    if(!enabled()||event.pointerType==='touch'){
      if(waves.length||previous||frame||expiryTimer)stop();return;
    }
    const now=performance.now(),x=event.clientX,y=event.clientY;
    if(!previous){previous={x,y};return;}
    const dx=x-previous.x,dy=y-previous.y,distance=Math.hypot(dx,dy);
    if(distance<minDistance||now-lastEmission<minInterval)return;
    const speed=Math.min(3,distance/28);
    waves.push({x,y,dx:dx/distance,dy:dy/distance,angle:Math.atan2(dy,dx),speed,born:now});
    if(waves.length>maxWaves)waves.shift();previous={x,y};lastEmission=now;
    canvas.hidden=false;if(!frame)frame=requestAnimationFrame(draw);
    // 独立于动画帧的到期清理，帧暂停时也不会无限保留最后一帧。
    if(expiryTimer)clearTimeout(expiryTimer);expiryTimer=setTimeout(stop,lifetime+80);
  }
  function preference(){if(!enabled())stop();background.classList.toggle('is-static',!enabled());}
  document.addEventListener('pointermove',pointer,{passive:true});
  document.addEventListener('pointerleave',()=>{previous=null;},{passive:true});
  document.addEventListener('pointercancel',stop,{passive:true});
  document.addEventListener('visibilitychange',preference);
  reduced.addEventListener('change',preference);fine.addEventListener('change',preference);
  window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>{resize();preference();});
  const queueResize=debounce(resize,150);
  window.addEventListener('resize',()=>{stop();queueResize();},{passive:true});
  resize();preference();
})();
