/* 代理标注规则敏感性检查：node scripts/check_labels.js */
const fs = require('fs');
const path = require('path');
globalThis.CC_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'demo-data.json'), 'utf8'));
const CC = require(path.join(__dirname, '..', 'frontend', 'src', 'core.js'));
CC.initData(globalThis.CC_DATA);
const jobs = CC.getData().jobs;
const profiles = CC.getData().experimentProfiles;

function variants() {
  return {
    'V1 技能≥2 + 城市 + 薪资': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      if (hit < Math.min(2, p.skills.length)) return false;
      if (p.city && j.city !== p.city) return false;
      const ov = Math.min(p.salaryMax, j.salaryMax) - Math.max(p.salaryMin, j.salaryMin);
      return ov > 0;
    },
    'V2 技能≥2 + 城市': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      return hit >= Math.min(2, p.skills.length) && (!p.city || j.city === p.city);
    },
    'V3 技能≥2 + (城市或薪资)': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      if (hit < Math.min(2, p.skills.length)) return false;
      const cityOk = !p.city || j.city === p.city;
      const ov = Math.min(p.salaryMax, j.salaryMax) - Math.max(p.salaryMin, j.salaryMin);
      return cityOk || ov > 0;
    },
    'V4 技能≥1 + 城市': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      return hit >= 1 && (!p.city || j.city === p.city);
    },
    'V5 技能≥2': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      return hit >= Math.min(2, p.skills.length);
    },
    'V6 技能≥1 + 技能覆盖率≥50%': (p, j) => {
      const hit = p.skills.filter(s => j.skillSet.has(s)).length;
      return hit >= 1 && hit / Math.min(p.skills.length, j.skills.length) >= 0.5;
    },
  };
}

const V = variants();
Object.keys(V).forEach(name => {
  const rule = V[name];
  let sumA = 0, sumB = 0, sumH = 0, counts = [];
  profiles.forEach(p => {
    const labels = Object.create(null);
    jobs.forEach(j => { if (rule(p, j)) labels[j.id] = 1; });
    const n = Object.keys(labels).length;
    counts.push(n);
    const top = algo => CC.recommend(p, { algo, limit: 10 }).filter(x => labels[x.job.id]).length;
    sumA += top('weighted'); sumB += top('tfidf'); sumH += top('hybrid');
  });
  console.log(name, '| 平均相关岗', (counts.reduce((a, b) => a + b, 0) / 10).toFixed(1),
    '| P@10 A/B/H', (sumA / 10).toFixed(2), (sumB / 10).toFixed(2), (sumH / 10).toFixed(2),
    '| 每画像', counts.join(','));
});
