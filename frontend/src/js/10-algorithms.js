/* ============================================================
   校招罗盘 · recommendation algorithms
   A. weighted rule score (project plan §7.3)
   B. TF-IDF cosine similarity (project plan §7.4)
   Plus the evaluation harness for §7.5.
   ============================================================ */

const normSkill = (s) => String(s || '')
  .toLowerCase()
  .replace(/[\s_\-/·]/g, '')
  .replace(/[（）()]/g, '');

const SKILL_CANON = new Map();
for (const s of SKILLS) SKILL_CANON.set(normSkill(s.name), s.name);

function canonicalSkill(name) {
  return SKILL_CANON.get(normSkill(name)) || name;
}

function skillHitList(profile, job) {
  const want = new Map();
  for (const s of (profile.skills || [])) want.set(normSkill(s), canonicalSkill(s));
  const jobSet = new Map();
  for (const s of (job.skills || [])) jobSet.set(normSkill(s), canonicalSkill(s));
  const hits = [];
  const misses = [];
  for (const [key, label] of jobSet) {
    if (want.has(key)) hits.push(label);
    else misses.push(label);
  }
  return { hits, misses, wantCount: want.size, jobCount: jobSet.size };
}

function salaryOverlap(profile, job) {
  const expMin = Number(profile.salaryMin), expMax = Number(profile.salaryMax);
  const jobMin = Number(job.salaryMin), jobMax = Number(job.salaryMax);
  if (![expMin, expMax, jobMin, jobMax].every(Number.isFinite)) {
    return { score: 50, ratio: 0, state: 'unknown' };
  }
  if (expMax < expMin || jobMax < jobMin) return { score: 50, ratio: 0, state: 'unknown' };
  const width = expMax - expMin;
  if (width <= 0) {
    const inside = expMin >= jobMin && expMin <= jobMax;
    return { score: inside ? 100 : 0, ratio: inside ? 1 : 0, state: inside ? 'full' : (jobMax < expMin ? 'low' : 'high') };
  }
  const overlap = Math.min(expMax, jobMax) - Math.max(expMin, jobMin);
  if (overlap <= 0) {
    return { score: 0, ratio: 0, state: jobMax < expMin ? 'low' : 'high' };
  }
  const ratio = Math.min(1, overlap / width);
  const full = jobMin <= expMin && jobMax >= expMax;
  return { score: round1(ratio * 100), ratio, state: full ? 'full' : 'partial' };
}

function scoreJobRule(profile, job) {
  const { hits, misses, wantCount, jobCount } = skillHitList(profile, job);
  let skillScore, skillReason;
  if (!jobCount) {
    skillScore = 60;
    skillReason = '岗位 JD 未标注技能要求，按 60 分中性处理';
  } else if (!wantCount) {
    skillScore = 0;
    skillReason = '画像还没有填写技能，技能项计 0 分';
  } else {
    skillScore = round1((hits.length / jobCount) * 100);
    skillReason = hits.length
      ? `命中 ${hits.length}/${jobCount} 项岗位技能：${hits.join('、')}`
      : `未命中岗位要求的 ${jobCount} 项技能`;
    if (misses.length) skillReason += `；尚未具备：${misses.join('、')}`;
    else if (hits.length) skillReason += '；已覆盖全部岗位技能';
  }

  let cityScore, cityReason;
  if (!profile.city) {
    cityScore = 50;
    cityReason = '画像未填写期望城市，城市项按中性 50 分';
  } else if (profile.city === job.city) {
    cityScore = 100;
    cityReason = `期望 ${profile.city}，岗位位于 ${job.city}，城市完全一致`;
  } else {
    cityScore = 0;
    cityReason = `期望 ${profile.city}，岗位位于 ${job.city}，跨城市不计分`;
  }

  const sal = salaryOverlap(profile, job);
  let salaryReason;
  if (sal.state === 'unknown') salaryReason = '画像或岗位薪资缺失，薪资项按中性 50 分';
  else if (sal.state === 'full') salaryReason = `期望 ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}，岗位 ${salaryText(job)}，完全覆盖期望区间`;
  else if (sal.state === 'partial') salaryReason = `期望 ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}，岗位 ${salaryText(job)}，覆盖期望区间的 ${Math.round(sal.ratio * 100)}%`;
  else if (sal.state === 'low') salaryReason = `期望 ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}，岗位 ${salaryText(job)}，薪资偏低`;
  else salaryReason = `期望 ${kFmt(profile.salaryMin)}-${kFmt(profile.salaryMax)}，岗位 ${salaryText(job)}，薪资偏高`;

  const total = round1(skillScore * 0.5 + cityScore * 0.3 + salaryScoreWeight(sal.score) * 0.2);
  return {
    total,
    parts: [
      { key: 'skill', label: '技能匹配', weight: 0.5, score: skillScore, reason: skillReason },
      { key: 'city', label: '城市偏好', weight: 0.3, score: cityScore, reason: cityReason },
      { key: 'salary', label: '薪资区间', weight: 0.2, score: sal.score, reason: salaryReason },
    ],
    hits, misses, salaryState: sal.state,
  };
}
function salaryScoreWeight(v) { return Number.isFinite(v) ? v : 50; }

/* ---------------- TF-IDF ---------------- */
const STOPWORDS = new Set([
  '的', '了', '和', '与', '及', '或', '在', '是', '有', '为', '等', '中', '对', '从', '到', '并', '而', '其', '之', '以',
  '公司', '岗位', '职位', '职责', '要求', '优先', '熟悉', '熟练', '使用', '相关', '工作', '经验', '能力', '负责', '参与',
  '完成', '具备', '以上', '团队', '业务', '进行', '我们', '以及', '能够', '良好', '具有', '你会', '你将', '加入', '一起',
  '本科', '硕士', '学历', '专业', '毕业', '招聘', '全职', '实习', '薪资', '福利', '地点', '城市', '描述', '介绍',
  'and', 'the', 'with', 'for', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'this', 'that', 'from', 'not',
  '工作职责', '任职要求', '岗位职责', '职位描述', '岗位要求', '我们提供', '加分项', '以下', '其中', '根据', '通过',
]);

function tokenize(text) {
  const s = String(text || '').toLowerCase().replace(/\u00a0/g, ' ').replace(/\u3000/g, ' ');
  const tokens = [];
  const ascii = s.match(/[a-z0-9][a-z0-9+#.]{1,}/g) || [];
  for (const t of ascii) {
    if (t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t)) tokens.push(t);
  }
  const runs = s.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const run of runs) {
    if (run.length === 2) {
      if (!STOPWORDS.has(run)) tokens.push(run);
      continue;
    }
    for (let i = 0; i <= run.length - 2; i++) {
      const bg = run.slice(i, i + 2);
      if (!STOPWORDS.has(bg)) tokens.push(bg);
    }
  }
  return tokens;
}

function jobDocument(job) {
  const skillPart = (job.skills || []).join(' ');
  return `${job.title || ''} ${job.jobType || ''} ${job.company || ''} ${job.city || ''} ${skillPart} ${skillPart} ${(job.description || '').slice(0, 1400)}`;
}

let TFIDF = null;
function getTfidfModel() {
  if (TFIDF) return TFIDF;
  const N = JOBS.length;
  const df = new Map();
  const docs = JOBS.map((job) => {
    const counts = new Map();
    for (const t of tokenize(jobDocument(job))) counts.set(t, (counts.get(t) || 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { job, counts };
  });
  const terms = [...df.entries()]
    .filter(([, d]) => d >= 2)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 5000)
    .map(([t]) => t);
  const idf = new Map(terms.map((t) => [t, Math.log((N + 1) / ((df.get(t) || 1) + 1)) + 1]));
  const vectors = new Map();
  for (const { job, counts } of docs) {
    const vec = new Map();
    let norm = 0;
    for (const [t, c] of counts) {
      if (!idf.has(t)) continue;
      const w = (1 + Math.log(c)) * idf.get(t);
      vec.set(t, w);
      norm += w * w;
    }
    vectors.set(job.id, { vec, norm: Math.sqrt(norm) });
  }
  TFIDF = { N, idf, vectors, terms };
  return TFIDF;
}

function queryVector(profile) {
  const parts = [];
  for (const s of (profile.skills || [])) {
    parts.push(s, s, s);
  }
  if (profile.city) parts.push(profile.city, profile.city);
  if (profile.jobType) parts.push(profile.jobType, profile.jobType);
  const counts = new Map();
  for (const t of tokenize(parts.join(' '))) counts.set(t, (counts.get(t) || 0) + 1);
  const model = getTfidfModel();
  const vec = new Map();
  let norm = 0;
  for (const [t, c] of counts) {
    if (!model.idf.has(t)) continue;
    const w = (1 + Math.log(c)) * model.idf.get(t);
    vec.set(t, w);
    norm += w * w;
  }
  return { vec, norm: Math.sqrt(norm) };
}

function prettyTerm(t) {
  const canon = SKILL_CANON.get(normSkill(t));
  if (canon) return canon;
  if (t.length <= 4) return t.toUpperCase();
  return t;
}

function scoreJobTfidf(profile, job, qvec) {
  const model = getTfidfModel();
  const doc = model.vectors.get(job.id);
  const q = qvec || queryVector(profile);
  if (!doc || !doc.norm || !q.norm) return { total: 0, contributions: [], reason: '用户画像或岗位文本为空，无法计算文本相似度' };
  let dot = 0;
  const parts = [];
  for (const [t, w] of q.vec) {
    const dw = doc.vec.get(t);
    if (!dw) continue;
    const prod = w * dw;
    dot += prod;
    parts.push({ term: t, label: prettyTerm(t), weight: prod });
  }
  const total = round1((dot / (q.norm * doc.norm)) * 100);
  parts.sort((a, b) => b.weight - a.weight);
  const contributions = parts.slice(0, 5).filter((p) => p.weight > 0);
  const reason = contributions.length
    ? `文本最相关：${contributions.map((p) => p.label).join('、')}`
    : '岗位文本与画像词项没有交集';
  return { total, contributions, reason };
}

/* ---------------- evaluation harness ---------------- */
function isRelevant(profile, job) {
  if (!profile.city || job.city !== profile.city) return false;
  const { hits } = skillHitList(profile, job);
  return hits.length > 0;
}
function hasSkillHit(profile, job) {
  return skillHitList(profile, job).hits.length > 0;
}

function evaluateRanking(profile, ranked, algo) {
  const top = ranked.slice(0, 10);
  let strict = 0, skill = 0, city = 0;
  const curve = [];
  top.forEach((item, i) => {
    const job = item.job;
    const rel = isRelevant(profile, job);
    if (rel) strict++;
    if (hasSkillHit(profile, job)) skill++;
    if (profile.city && job.city === profile.city) city++;
    curve.push({ n: i + 1, hits: strict, precision: round1((strict / (i + 1)) * 100) });
  });
  return {
    algo,
    top,
    strict, skill, city,
    precision: strict * 10,
    skillRate: skill * 10,
    cityRate: city * 10,
    curve,
    avgScore: round1(top.reduce((s, x) => s + x.score, 0) / Math.max(1, top.length)),
  };
}

function rankJobs(profile, algo) {
  const jobs = JOBS;
  const qvec = algo === 'tfidf' ? queryVector(profile) : null;
  const ranked = jobs.map((job) => {
    const s = algo === 'tfidf' ? scoreJobTfidf(profile, job, qvec) : scoreJobRule(profile, job);
    return { job, score: s.total, detail: s };
  });
  ranked.sort((a, b) => b.score - a.score || b.job.salaryAvg - a.job.salaryAvg || (a.job.id < b.job.id ? -1 : 1));
  return ranked;
}

function rankHybrid(profile) {
  const qvec = queryVector(profile);
  const pool = profile.city ? JOBS.filter((j) => j.city === profile.city) : JOBS.slice();
  const ranked = pool.map((job) => {
    const s = scoreJobTfidf(profile, job, qvec);
    return { job, score: s.total, detail: s };
  });
  ranked.sort((a, b) => b.score - a.score || (a.job.id < b.job.id ? -1 : 1));
  return ranked;
}

let EXPERIMENT = null;
function runExperiment() {
  if (EXPERIMENT) return EXPERIMENT;
  const profiles = DB.experimentProfiles || [];
  const rows = profiles.map((p) => {
    const rule = evaluateRanking(p, rankJobs(p, 'rule'), 'rule');
    const tfidf = evaluateRanking(p, rankJobs(p, 'tfidf'), 'tfidf');
    const hybrid = evaluateRanking(p, rankHybrid(p), 'hybrid');
    return { profile: p, rule, tfidf, hybrid };
  });
  const avg = (key, metric) => round1(rows.reduce((s, r) => s + r[key][metric], 0) / Math.max(1, rows.length));
  const summary = {
    rows,
    avg: {
      rule: { precision: avg('rule', 'precision'), skillRate: avg('rule', 'skillRate'), cityRate: avg('rule', 'cityRate') },
      tfidf: { precision: avg('tfidf', 'precision'), skillRate: avg('tfidf', 'skillRate'), cityRate: avg('tfidf', 'cityRate') },
      hybrid: { precision: avg('hybrid', 'precision'), skillRate: avg('hybrid', 'skillRate'), cityRate: avg('hybrid', 'cityRate') },
    },
    profiles: profiles.length,
  };
  EXPERIMENT = summary;
  return summary;
}

/* Small chart helper: SVG grouped bars / lines share these scales. */
function niceMax(v, steps = 4) {
  if (v <= 0) return 10;
  const raw = v / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return Math.ceil(v / step) * step;
}
