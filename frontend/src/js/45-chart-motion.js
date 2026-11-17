/* 图表入场：只动画数据图形，坐标轴与最终数值保持原样。 */
let chartMotionObserver = null;
const chartMotionAnimations = new Set();
const chartMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

function stopChartMotion() {
  chartMotionObserver?.disconnect();
  chartMotionObserver = null;
  chartMotionAnimations.forEach((animation) => animation.cancel());
  chartMotionAnimations.clear();
}

function playChartEntrance(root) {
  stopChartMotion();
  if (!root || chartMotionPreference.matches || !Element.prototype.animate) return;
  const cards = new Map();
  root.querySelectorAll('.chart-card').forEach((card) => {
    const animations = [];
    card.querySelectorAll('[data-chart-motion], .cloud > span, .strategy-row .progress > i').forEach((element, index) => {
      const type = element.dataset.chartMotion || (element.matches('.progress > i') ? 'bar-x' : 'word');
      let frames;
      let duration = 1100;
      if (type === 'bar-y' || type === 'bar-x') {
        element.style.transformBox = 'fill-box';
        element.style.transformOrigin = type === 'bar-y' ? 'center bottom' : 'left center';
        const axis = type === 'bar-y' ? 'Y' : 'X';
        frames = [{ transform: `scale${axis}(0)` }, { transform: `scale${axis}(1)` }];
      } else if (type === 'line') {
        const length = element.getTotalLength();
        frames = [{ strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }];
        duration = 1250;
      } else if (type === 'donut') {
        const circumference = 2 * Math.PI * Number(element.getAttribute('r'));
        frames = [{ strokeDasharray: `0 ${circumference}` }, { strokeDasharray: element.getAttribute('stroke-dasharray') }];
      } else if (type === 'radar') {
        element.style.transformBox = 'view-box';
        element.style.transformOrigin = element.dataset.motionOrigin || 'center';
        frames = [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
      } else if (type === 'point' || type === 'word') {
        element.style.transformBox = 'fill-box';
        element.style.transformOrigin = 'center';
        const opacity = getComputedStyle(element).opacity;
        frames = [{ transform: 'translateY(7px) scale(.75)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity }];
      } else {
        frames = [{ clipPath: 'inset(0 100% 0 0)', opacity: .3 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1 }];
      }
      const animation = element.animate(frames, { duration, delay: Math.min(index * 26, 220), easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
      // 首帧先暂停，避免下方图表在用户看到之前播放完。
      animation.pause();
      animation.currentTime = 0;
      chartMotionAnimations.add(animation);
      animations.push(animation);
      animation.finished.then(() => {
        animation.cancel();
        chartMotionAnimations.delete(animation);
      }, () => {});
    });
    if (animations.length) cards.set(card.querySelector('.chart-body') || card, animations);
  });
  const start = (card) => {
    cards.get(card)?.forEach((animation) => animation.play());
    cards.delete(card);
    chartMotionObserver?.unobserve(card);
  };
  if (!('IntersectionObserver' in window)) {
    [...cards.keys()].forEach(start);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (chartMotionObserver !== observer) return;
    entries.forEach((entry) => { if (entry.isIntersecting && entry.intersectionRatio >= .12) start(entry.target); });
  }, { threshold: .12 });
  chartMotionObserver = observer;
  cards.forEach((_, card) => chartMotionObserver.observe(card));
}

// 页面打开期间切换设置，也立即显示完整图表。
chartMotionPreference.addEventListener('change', (event) => { if (event.matches) stopChartMotion(); });
