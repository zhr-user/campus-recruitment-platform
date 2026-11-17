#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Build the offline demo dataset for the single-file frontend shell.

Inputs (already verified in docs/数据实况说明.md):
  data/raw/cleaned_data_jobs.csv   A 集纯数据岗子集, 2,915 x 34
  data/raw/job_posting_data_B.xlsx B 集公开招聘 JD 样本, 10,114 x 11

Output:
  frontend/src/demo-data.json

Sample design: 300 A + 100 B = 400 jobs.
Selection is deterministic (seed 20251025), stratified by city/skills/source.
"""
from __future__ import annotations

import ast
import json
import math
import random
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "frontend" / "src" / "demo-data.json"
OUT_JS = ROOT / "frontend" / "src" / "demo-data.js"
SEED = 20251025

# ---------------------------------------------------------------------------
# Skill catalogue (canonical display name, group, aliases)
# Order is meaningful: jobs keep the first 8 skills in this order.
# ---------------------------------------------------------------------------
SKILLS = [
    # 编程语言
    ("Python", "编程语言", ["python"]),
    ("SQL", "编程语言", ["sql"]),
    ("Java", "编程语言", ["java"]),
    ("C++", "编程语言", ["c++", "cpp"]),
    ("JavaScript", "编程语言", ["javascript", "js"]),
    ("TypeScript", "编程语言", ["typescript", "ts"]),
    ("Go", "编程语言", ["golang", "go语言"]),
    ("R", "编程语言", ["r语言"]),
    ("Scala", "编程语言", ["scala"]),
    ("Shell", "编程语言", ["shell", "bash"]),
    ("PHP", "编程语言", ["php"]),
    ("C#", "编程语言", ["c#"]),
    # 数据库
    ("MySQL", "数据库", ["mysql"]),
    ("Redis", "数据库", ["redis"]),
    ("MongoDB", "数据库", ["mongodb", "mongo"]),
    ("Oracle", "数据库", ["oracle"]),
    ("PostgreSQL", "数据库", ["postgresql", "postgres"]),
    ("Hive", "数据库", ["hive"]),
    ("ClickHouse", "数据库", ["clickhouse"]),
    ("SQL Server", "数据库", ["sql server", "sqlserver"]),
    # 数据工具
    ("Excel", "数据工具", ["excel"]),
    ("Tableau", "数据工具", ["tableau"]),
    ("Power BI", "数据工具", ["power bi", "powerbi"]),
    ("SPSS", "数据工具", ["spss"]),
    ("SAS", "数据工具", ["sas"]),
    ("PPT", "数据工具", ["ppt", "powerpoint"]),
    ("Looker", "数据工具", ["looker"]),
    ("Superset", "数据工具", ["superset"]),
    ("FineBI", "数据工具", ["finebi"]),
    # 大数据
    ("Spark", "大数据", ["spark"]),
    ("Hadoop", "大数据", ["hadoop"]),
    ("Flink", "大数据", ["flink"]),
    ("Kafka", "大数据", ["kafka"]),
    ("HBase", "大数据", ["hbase"]),
    ("Airflow", "大数据", ["airflow"]),
    ("DataX", "大数据", ["datax"]),
    # 算法 / 机器学习
    ("机器学习", "算法与模型", ["机器学习", "machine learning"]),
    ("深度学习", "算法与模型", ["深度学习", "deep learning"]),
    ("PyTorch", "算法与模型", ["pytorch", "torch"]),
    ("TensorFlow", "算法与模型", ["tensorflow", "tf"]),
    ("大模型", "算法与模型", ["大模型", "llm", "large language model", "aigc", "生成式ai"]),
    ("NLP", "算法与模型", ["nlp", "自然语言处理"]),
    ("计算机视觉", "算法与模型", ["计算机视觉", "computer vision"]),
    ("推荐系统", "算法与模型", ["推荐系统", "推荐算法"]),
    ("数据挖掘", "算法与模型", ["数据挖掘", "data mining"]),
    ("统计学", "算法与模型", ["统计学", "统计分析", "统计"]),
    ("特征工程", "算法与模型", ["特征工程"]),
    ("A/B测试", "算法与模型", ["a/b测试", "ab测试", "a/b test"]),
    ("因果推断", "算法与模型", ["因果推断", "因果分析"]),
    ("强化学习", "算法与模型", ["强化学习", "reinforcement learning"]),
    # 后端 / 工程
    ("FastAPI", "后端与工程", ["fastapi"]),
    ("Django", "后端与工程", ["django"]),
    ("Flask", "后端与工程", ["flask"]),
    ("Spring Boot", "后端与工程", ["spring boot", "springboot", "spring cloud"]),
    ("微服务", "后端与工程", ["微服务", "microservice"]),
    ("RESTful", "后端与工程", ["restful", "rest api"]),
    ("Docker", "后端与工程", ["docker"]),
    ("Kubernetes", "后端与工程", ["kubernetes", "k8s"]),
    ("Linux", "后端与工程", ["linux"]),
    ("Git", "后端与工程", ["git"]),
    ("Nginx", "后端与工程", ["nginx"]),
    # 前端
    ("Vue", "前端", ["vue", "vue.js", "vue3"]),
    ("React", "前端", ["react", "react.js"]),
    ("HTML", "前端", ["html", "html5"]),
    ("CSS", "前端", ["css", "css3"]),
    ("Node.js", "前端", ["node.js", "nodejs"]),
    # 分析与业务
    ("数据分析", "分析与业务", ["数据分析", "data analysis"]),
    ("数据可视化", "分析与业务", ["数据可视化", "可视化", "data visualization"]),
    ("指标体系", "分析与业务", ["指标体系"]),
    ("用户画像", "分析与业务", ["用户画像"]),
    ("业务分析", "分析与业务", ["业务分析", "商业分析"]),
    ("数据仓库", "分析与业务", ["数据仓库", "数仓"]),
    ("ETL", "分析与业务", ["etl"]),
    ("埋点", "分析与业务", ["埋点"]),
    ("报表", "分析与业务", ["报表"]),
    ("财务分析", "分析与业务", ["财务分析"]),
    ("风控", "分析与业务", ["风控", "风险控制"]),
    ("增长分析", "分析与业务", ["增长分析"]),
]

SKILL_NAMES = [s[0] for s in SKILLS]
SKILL_GROUP = {s[0]: s[1] for s in SKILLS}
ALIASES = {s[0]: s[2] for s in SKILLS}

# A 集 18 个原始哑变量 -> canonical name
A_DUMMIES = [
    ("python", "Python"), ("sql", "SQL"), ("excel", "Excel"),
    ("tableau", "Tableau"), ("power_bi", "Power BI"), ("sas", "SAS"),
    ("spss", "SPSS"), ("r", "R"), ("java", "Java"), ("spark", "Spark"),
    ("hadoop", "Hadoop"), ("机器学习", "机器学习"), ("深度学习", "深度学习"),
    ("统计", "统计学"), ("数据挖掘", "数据挖掘"), ("可视化", "数据可视化"),
    ("ppt", "PPT"), ("mysql", "MySQL"),
]

ALIAS_PATTERNS = {}
for _name, _group, _aliases in SKILLS:
    patterns = []
    for alias in _aliases:
        if re.search(r"[a-zA-Z0-9]", alias):
            esc = re.escape(alias).replace(r"\ ", r"[\s\-_]*")
            patterns.append(re.compile(r"(?<![a-z0-9+#.])" + esc + r"(?![a-z0-9+#])", re.I))
        else:
            patterns.append(alias)
    ALIAS_PATTERNS[_name] = patterns

CITY_ORDER = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京",
              "西安", "苏州", "长沙", "合肥", "宁波", "重庆", "天津", "郑州"]

CITY_ALIASES = {"北京市": "北京", "上海市": "上海", "广州市": "广州", "深圳市": "深圳",
                "杭州市": "杭州", "成都市": "成都", "武汉市": "武汉", "南京市": "南京",
                "西安市": "西安", "苏州市": "苏州", "长沙市": "长沙", "合肥市": "合肥",
                "宁波市": "宁波", "重庆市": "重庆", "天津市": "天津", "郑州市": "郑州"}

PROFILES = [
    {
        "id": "da-hz",
        "name": "数据分析 · 杭州",
        "tag": "推荐演示",
        "desc": "贴合数据集 A 的数据分析岗，技能命中率最高，适合完整流程演示。",
        "skills": ["Python", "SQL", "Excel", "Tableau", "统计学"],
        "city": "杭州", "salaryMin": 10000, "salaryMax": 18000, "jobType": "数据分析",
    },
    {
        "id": "backend-hz",
        "name": "后端 · 杭州（计划书）",
        "tag": "计划书原例",
        "desc": "计划书 13.4 的示例画像：Python / MySQL / FastAPI，用于展示技能缺口的解释能力。",
        "skills": ["Python", "MySQL", "FastAPI", "Docker"],
        "city": "杭州", "salaryMin": 8000, "salaryMax": 15000, "jobType": "后端开发",
    },
    {
        "id": "algo-bj",
        "name": "算法工程师 · 北京",
        "tag": "高薪样本",
        "desc": "面向算法岗的画像，数据集 B 中机器学习/深度学习岗位覆盖充分。",
        "skills": ["机器学习", "深度学习", "PyTorch", "Python"],
        "city": "北京", "salaryMin": 20000, "salaryMax": 40000, "jobType": "算法工程",
    },
    {
        "id": "campus-gz",
        "name": "应届数据分析 · 广州",
        "tag": "应届样本",
        "desc": "勾选“只看应届”，展示应届岗位标签、城市与薪资区间的联合筛选。",
        "skills": ["Python", "SQL", "Excel", "统计学", "数据分析"],
        "city": "广州", "salaryMin": 8000, "salaryMax": 12000, "jobType": "数据分析",
        "campusOnly": True,
    },
    {
        "id": "de-sh",
        "name": "数据开发 · 上海",
        "tag": "大数据栈",
        "desc": "覆盖 SQL / Hive / Spark 等数仓技能，用于展示技能命中与薪资区间。",
        "skills": ["SQL", "Hive", "Spark", "Hadoop", "数据仓库"],
        "city": "上海", "salaryMin": 12000, "salaryMax": 22000, "jobType": "数据开发",
    },
]

EXPERIMENT_PROFILES = [
    {"id": "U1", "skills": ["Python", "MySQL", "FastAPI"], "city": "杭州", "salaryMin": 8000, "salaryMax": 15000, "jobType": "后端开发"},
    {"id": "U2", "skills": ["机器学习", "PyTorch", "深度学习"], "city": "北京", "salaryMin": 20000, "salaryMax": 40000, "jobType": "算法工程"},
    {"id": "U3", "skills": ["SQL", "数据分析", "统计学"], "city": "上海", "salaryMin": 10000, "salaryMax": 20000, "jobType": "数据分析"},
    {"id": "U4", "skills": ["Java", "Spring Boot", "Redis"], "city": "深圳", "salaryMin": 12000, "salaryMax": 25000, "jobType": "后端开发"},
    {"id": "U5", "skills": ["JavaScript", "Vue", "HTML", "CSS"], "city": "广州", "salaryMin": 8000, "salaryMax": 18000, "jobType": "前端开发"},
    {"id": "U6", "skills": ["大模型", "Python", "深度学习"], "city": "北京", "salaryMin": 25000, "salaryMax": 50000, "jobType": "算法工程"},
    {"id": "U7", "skills": ["SQL", "Excel", "统计学"], "city": "成都", "salaryMin": 6000, "salaryMax": 12000, "jobType": "数据分析"},
    {"id": "U8", "skills": ["Python", "Django", "MySQL"], "city": "武汉", "salaryMin": 7000, "salaryMax": 14000, "jobType": "后端开发"},
    {"id": "U9", "skills": ["C++", "Linux", "Git"], "city": "西安", "salaryMin": 10000, "salaryMax": 20000, "jobType": "后端开发"},
    {"id": "U10", "skills": ["Python", "机器学习", "SQL"], "city": "南京", "salaryMin": 12000, "salaryMax": 22000, "jobType": "算法工程"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clean_text(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    s = str(value)
    s = s.replace("\xa0", " ").replace("\u3000", " ").replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def parse_list_literal(value) -> list[str]:
    s = clean_text(value)
    if not s:
        return []
    if s.startswith("["):
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                out = [clean_text(x) for x in parsed if clean_text(x)]
                return out
        except (ValueError, SyntaxError):
            pass
    return [clean_text(x) for x in re.split(r"[,，;；/|]", s) if clean_text(x)]


def parse_description(value) -> str:
    s = clean_text(value)
    if not s:
        return ""
    if s.startswith("["):
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                parts = []
                for item in parsed:
                    t = clean_text(item)
                    if t:
                        parts.append(t)
                s = "\n".join(parts)
        except (ValueError, SyntaxError):
            pass
    s = re.sub(r"\n\s*\n+", "\n\n", s)
    return s[:2500]


def normalize_city(value) -> str:
    s = clean_text(value)
    return CITY_ALIASES.get(s, s)


def job_type_from_title(title: str) -> str:
    t = clean_text(title).lower().replace(" ", "")
    rules = [
        ("大模型/AI", ["大模型", "llm", "aigc", "人工智能", "ai工程", "ai开发", "ai算法", "ai工程师", "ai研发"]),
        ("算法工程", ["算法", "机器学习", "深度学习", "nlp", "自然语言", "计算机视觉", "推荐系统", "数据挖掘"]),
        ("数据开发", ["数据开发", "etl", "数仓", "数据仓库", "大数据开发", "数据平台", "数据库", "大数据"]),
        ("数据分析", ["数据分析", "商业分析", "业务分析", "数据科学", "bi分析", "数据运营", "经营分析"]),
        ("前端开发", ["前端", "web前端", "vue", "react", "javascript"]),
        ("后端开发", ["后端", "java开发", "golang", "go开发", "服务端", "python开发", "架构师", "开发工程师"]),
        ("测试", ["测试", "qa"]),
        ("运维", ["运维", "sre", "devops"]),
        ("产品", ["产品经理", "产品专员", "产品助理"]),
        ("业务/职能", ["销售", "运营", "市场", "客服", "人事", "hr", "行政", "财务", "商务"]),
    ]
    for label, keys in rules:
        if any(k in t for k in keys):
            return label
    # A 集是数据岗子集，标题里带“数据/分析”的垂直岗位统一归入数据分析。
    if "数据" in t or "分析" in t:
        return "数据分析"
    return "其他"


def salary_text_from_numbers(lo: float, hi: float) -> str:
    def fmt(v: float) -> str:
        if v >= 10000:
            s = f"{v / 1000:.1f}".rstrip("0").rstrip(".")
            return f"{s}K"
        return f"{int(round(v / 1000 * 10) / 10)}K"
    return f"{fmt(lo)}-{fmt(hi)}·月"


BENEFIT_WORDS = [
    "五险一金", "六险一金", "年终奖", "绩效奖金", "带薪年假", "双休", "弹性工作",
    "包吃", "包住", "餐补", "餐饮补贴", "交通补贴", "房补", "股票期权", "期权",
    "定期体检", "员工旅游", "节日福利", "零食下午茶", "免费班车", "补充医疗保险",
    "住房公积金", "培训", "晋升", "年终分红", "项目奖金", "通讯补贴", "高温补贴",
]


def extract_benefits(text: str, limit: int = 6) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    hits = [w for w in BENEFIT_WORDS if w in text]
    # “包吃住”这类合并写法
    if ("包吃" in text and "包住" in text) and "包吃住" not in hits:
        hits.insert(0, "包吃住")
    out = []
    for h in hits:
        if h not in out:
            out.append(h)
    return out[:limit]


def extract_skills(text: str, limit: int = 8) -> list[str]:
    text = clean_text(text).lower()
    if not text:
        return []
    hits = []
    for name in SKILL_NAMES:
        for pat in ALIAS_PATTERNS[name]:
            if isinstance(pat, str):
                if pat in text:
                    hits.append(name)
                    break
            else:
                if pat.search(text):
                    hits.append(name)
                    break
        if len(hits) >= limit:
            break
    return hits[:limit]


def a_skills(row: pd.Series, description: str) -> list[str]:
    skills = []
    for col, name in A_DUMMIES:
        try:
            if int(row.get(col, 0) or 0) == 1:
                skills.append(name)
        except (TypeError, ValueError):
            pass
    # Supplement from JD, but keep canonical order and cap at 8.
    extras = extract_skills(description, limit=12)
    for name in extras:
        if name not in skills:
            skills.append(name)
        if len(skills) >= 8:
            break
    return skills[:8]


def salary_ok(lo, hi) -> bool:
    try:
        lo = float(lo); hi = float(hi)
    except (TypeError, ValueError):
        return False
    return 3000 <= lo < hi <= 60000


def pick_rows(pool: pd.DataFrame, n: int, rng: random.Random) -> pd.DataFrame:
    if n <= 0 or pool.empty:
        return pool.head(0)
    if len(pool) <= n:
        return pool.copy()
    idx = list(pool.index)
    rng.shuffle(idx)
    return pool.loc[idx[:n]].copy()


def ensure_skill_coverage(selected: pd.DataFrame, pool: pd.DataFrame, skill_col: str,
                          targets: list[str], rng: random.Random, max_add: int = 40) -> pd.DataFrame:
    """Swap in rows so every target skill appears at least once."""
    selected = selected.copy()
    used = set(selected.index)
    added = 0
    for skill in targets:
        if selected[skill_col].map(lambda xs: skill in xs).any():
            continue
        candidates = pool[pool[skill_col].map(lambda xs: skill in xs)]
        candidates = candidates[~candidates.index.isin(used)]
        if candidates.empty:
            continue
        row = candidates.sample(1, random_state=rng.randint(1, 10**6))
        selected = pd.concat([selected, row])
        used.update(row.index)
        added += 1
        if added >= max_add:
            break
    return selected


# ---------------------------------------------------------------------------
# Load & prepare source A
# ---------------------------------------------------------------------------
def build_a() -> tuple[pd.DataFrame, dict]:
    path = RAW / "cleaned_data_jobs.csv"
    df = pd.read_csv(path)
    df["city"] = df["city"].map(normalize_city)
    df["description_clean"] = df["description"].map(parse_description)
    df["desc_len"] = df["description_clean"].str.len()
    df["experience"] = df["experience"].fillna("未标注").astype(str)
    df["campus"] = df["experience"].str.contains("应届", na=False)
    df["salary_min"] = pd.to_numeric(df["salary_min"], errors="coerce")
    df["salary_max"] = pd.to_numeric(df["salary_max"], errors="coerce")
    df["salary_avg"] = pd.to_numeric(df["salary_avg"], errors="coerce")
    df["job_type"] = df["job_title"].map(job_type_from_title)

    pool = df[
        df["city"].isin(CITY_ORDER)
        & (df["desc_len"] >= 80)
        & (df["skill_count"] >= 1)
        & df.apply(lambda r: salary_ok(r["salary_min"], r["salary_max"]), axis=1)
    ].copy()
    # Preference for richer JDs, but keep the pool broad enough for campus rows.
    campus_pool = pool[pool["campus"]].copy()
    other_pool = pool[~pool["campus"]].copy()

    rng = random.Random(SEED)
    city_quota = {
        "上海": 73, "广州": 58, "深圳": 44, "北京": 28, "杭州": 33,
        "成都": 19, "武汉": 15, "南京": 11, "苏州": 6, "重庆": 4,
        "西安": 3, "长沙": 2, "合肥": 2, "宁波": 2,
    }
    campus_quota = {
        "上海": 21, "广州": 17, "深圳": 13, "北京": 8, "杭州": 10,
        "成都": 6, "武汉": 5, "南京": 3, "苏州": 2, "重庆": 1,
        "西安": 1, "长沙": 1, "合肥": 1, "宁波": 1,
    }

    campus_take = []
    for city, q in campus_quota.items():
        sub = campus_pool[campus_pool["city"] == city]
        campus_take.append(pick_rows(sub, q, rng))
    campus_sel = pd.concat(campus_take) if campus_take else campus_pool.head(0)
    if len(campus_sel) < 90:
        rest = campus_pool[~campus_pool.index.isin(campus_sel.index)]
        campus_sel = pd.concat([campus_sel, pick_rows(rest, 90 - len(campus_sel), rng)])
    campus_sel = campus_sel.head(90)

    other_take = []
    for city, q in city_quota.items():
        already = int((campus_sel["city"] == city).sum())
        need = max(0, q - already)
        sub = other_pool[other_pool["city"] == city]
        other_take.append(pick_rows(sub, need, rng))
    other_sel = pd.concat(other_take) if other_take else other_pool.head(0)
    target_other = 300 - len(campus_sel)
    if len(other_sel) < target_other:
        rest = other_pool[~other_pool.index.isin(other_sel.index)]
        other_sel = pd.concat([other_sel, pick_rows(rest, target_other - len(other_sel), rng)])
    other_sel = other_sel.head(target_other)

    selected = pd.concat([campus_sel, other_sel]).drop_duplicates()
    # Ensure all 18 base skills appear.
    selected["skill_list"] = [a_skills(row, row["description_clean"]) for _, row in selected.iterrows()]
    selected = ensure_skill_coverage(selected, pool.assign(
        skill_list=[a_skills(row, row["description_clean"]) for _, row in pool.iterrows()]
    ), "skill_list", [name for _, name in A_DUMMIES], rng, max_add=20)
    selected["skill_list"] = [a_skills(row, row["description_clean"]) for _, row in selected.iterrows()]

    # If coverage swaps pushed us over 300, trim non-campus rows first.
    if len(selected) > 300:
        selected = selected.sort_values(by="campus", ascending=False).head(300)
    selected = selected.sample(frac=1, random_state=SEED).reset_index(drop=False).rename(columns={"index": "src_index"})

    records = []
    for i, row in selected.iterrows():
        company_type = parse_list_literal(row.get("company_type"))
        industry = parse_list_literal(row.get("industry"))
        company_size = parse_list_literal(row.get("company_size"))
        desc = row["description_clean"]
        benefits = extract_benefits(desc)
        exp = clean_text(row.get("experience")) or "未标注"
        if exp == "应届生":
            exp_label = "应届生"
        elif exp == "不限":
            exp_label = "经验不限"
        else:
            exp_label = exp
        records.append({
            "id": "",  # assigned later
            "source": "A",
            "sourceLabel": "数据集 A",
            "srcIndex": int(row["src_index"]),
            "title": clean_text(row.get("job_title")) or "未命名岗位",
            "company": clean_text(row.get("company")) or "未标注企业",
            "city": clean_text(row.get("city")) or "未标注",
            "salaryMin": int(round(float(row["salary_min"]))),
            "salaryMax": int(round(float(row["salary_max"]))),
            "salaryAvg": int(round(float(row["salary_avg"]))) if not pd.isna(row["salary_avg"]) else int(round((row["salary_min"] + row["salary_max"]) / 2)),
            "salaryText": salary_text_from_numbers(float(row["salary_min"]), float(row["salary_max"])),
            "salaryRaw": clean_text(row.get("salary")),
            "experience": exp_label,
            "education": clean_text(row.get("education")) or "未标注",
            "jobType": clean_text(row.get("job_type")) or "其他",
            "skills": row["skill_list"],
            "campus": bool(row["campus"]),
            "date": clean_text(row.get("publish_date")),
            "dateKey": 0,
            "description": row["description_clean"],
            "benefits": benefits[:8],
            "companyType": company_type[0] if company_type else "未标注",
            "companySize": company_size[0] if company_size else "未标注",
            "industry": industry[0] if industry else "未标注",
        })
        md = re.match(r"(\d{1,2})-(\d{1,2})", records[-1]["date"])
        if md:
            records[-1]["dateKey"] = int(md.group(1)) * 100 + int(md.group(2))

    # If the coverage pass produced fewer than 300 (unlikely), top up.
    if len(records) < 300:
        extra = pick_rows(pool[~pool.index.isin(selected["src_index"])], 300 - len(records), rng)
        for src_idx, row in extra.iterrows():
            desc = row["description_clean"]
            exp = clean_text(row.get("experience")) or "未标注"
            records.append({
                "id": "", "source": "A", "sourceLabel": "数据集 A",
                "srcIndex": int(src_idx), "title": clean_text(row.get("job_title")),
                "company": clean_text(row.get("company")), "city": clean_text(row.get("city")),
                "salaryMin": int(round(float(row["salary_min"]))),
                "salaryMax": int(round(float(row["salary_max"]))),
                "salaryAvg": int(round(float((row["salary_min"] + row["salary_max"]) / 2))),
                "salaryText": salary_text_from_numbers(float(row["salary_min"]), float(row["salary_max"])),
                "salaryRaw": clean_text(row.get("salary")),
                "experience": "应届生" if exp == "应届生" else ("经验不限" if exp == "不限" else exp),
                "education": clean_text(row.get("education")) or "未标注",
                "jobType": job_type_from_title(row.get("job_title")),
                "skills": a_skills(row, desc), "campus": "应届" in exp,
                "date": clean_text(row.get("publish_date")), "dateKey": 0,
                "description": desc, "benefits": extract_benefits(desc)[:8],
                "companyType": (parse_list_literal(row.get("company_type")) or ["未标注"])[0],
                "companySize": (parse_list_literal(row.get("company_size")) or ["未标注"])[0],
                "industry": (parse_list_literal(row.get("industry")) or ["未标注"])[0],
            })
            md = re.match(r"(\d{1,2})-(\d{1,2})", records[-1]["date"])
            if md:
                records[-1]["dateKey"] = int(md.group(1)) * 100 + int(md.group(2))

    stats = {
        "pool": int(len(pool)),
        "campusPool": int(len(campus_pool)),
        "selected": len(records),
        "campusSelected": int(sum(1 for r in records if r["campus"])),
    }
    return pd.DataFrame(records), stats


# ---------------------------------------------------------------------------
# Load & prepare source B
# ---------------------------------------------------------------------------
def build_b() -> tuple[pd.DataFrame, dict]:
    path = RAW / "job_posting_data_B.xlsx"
    df = pd.read_excel(path)
    df["city"] = df["city"].map(normalize_city)
    df["description_clean"] = df["description"].map(parse_description)
    df["desc_len"] = df["description_clean"].str.len()
    df["minsalary"] = pd.to_numeric(df["minsalary"], errors="coerce")
    df["maxsalary"] = pd.to_numeric(df["maxsalary"], errors="coerce")
    df["job_type"] = df["jobname"].map(job_type_from_title)
    df["label"] = df["label"].fillna("未标注").astype(str)

    pool = df[
        (~df["label"].isin(["经济金融", "生物统计"]))
        & df["city"].isin(CITY_ORDER)
        & (df["desc_len"] >= 120)
        & df.apply(lambda r: salary_ok(r["minsalary"], r["maxsalary"]), axis=1)
    ].copy()
    pool["skill_list"] = [extract_skills(row["description_clean"] + "\n" + str(row["jobname"])) for _, row in pool.iterrows()]
    pool = pool[pool["skill_list"].map(len) >= 1].copy()

    rng = random.Random(SEED + 7)
    selected_idx: list[int] = []
    seen = set()

    def take(sub: pd.DataFrame, n: int) -> None:
        if n <= 0 or sub.empty:
            return
        sub = sub[~sub.index.isin(seen)]
        if sub.empty:
            return
        # Prefer richer JDs and rows that add new skills.
        sub = sub.assign(_rich=sub["desc_len"].clip(upper=1200) + sub["skill_list"].map(len) * 30)
        sub = sub.sort_values("_rich", ascending=False)
        for idx in sub.index[:n]:
            if idx not in seen:
                selected_idx.append(int(idx))
                seen.add(int(idx))

    # Force a few technology-stack examples so every preset has candidates.
    forced_targets = [("Vue", 4), ("React", 4), ("FastAPI", 3), ("Django", 3),
                      ("Flask", 2), ("Spring Boot", 2), ("PyTorch", 4), ("大模型", 5),
                      ("C++", 2), ("Kubernetes", 2), ("Power BI", 2), ("Tableau", 3)]
    for skill, n in forced_targets:
        cand = pool[pool["skill_list"].map(lambda xs: skill in xs)]
        cand = cand[cand["city"].isin(["北京", "上海", "深圳", "广州", "杭州", "成都", "武汉", "南京", "西安", "苏州"])]
        take(cand, n)

    # City quotas, with label balance handled by round-robin.
    city_quota = {"北京": 23, "上海": 16, "广州": 14, "深圳": 14, "杭州": 13,
                  "成都": 5, "武汉": 4, "南京": 3, "西安": 2, "苏州": 1}
    label_order = ["数据分析", "算法岗", "大模型相关"]
    for city, quota in city_quota.items():
        current = sum(1 for idx in selected_idx if pool.loc[idx, "city"] == city)
        need = max(0, quota - current)
        for label in label_order:
            if need <= 0:
                break
            sub = pool[(pool["city"] == city) & (pool["label"] == label)]
            take(sub, max(0, math.ceil(need / 2)))
            need = quota - sum(1 for idx in selected_idx if pool.loc[idx, "city"] == city)
        if need > 0:
            take(pool[pool["city"] == city], need)

    # Fill remaining slots with label balance.
    target = 100
    for label in label_order:
        if len(selected_idx) >= target:
            break
        take(pool[pool["label"] == label], min(12, target - len(selected_idx)))
    if len(selected_idx) < target:
        take(pool, target - len(selected_idx))
    selected = pool.loc[selected_idx[:target]].copy()

    records = []
    for src_idx, row in selected.iterrows():
        lo = int(round(float(row["minsalary"])))
        hi = int(round(float(row["maxsalary"])))
        benefits = extract_benefits(clean_text(row.get("other")) + "\n" + clean_text(row.get("description_clean")), limit=8)
        records.append({
            "id": "", "source": "B", "sourceLabel": "数据集 B",
            "srcIndex": int(src_idx),
            "title": clean_text(row.get("jobname")) or "未命名岗位",
            "company": clean_text(row.get("company")) or "未标注企业",
            "city": clean_text(row.get("city")) or "未标注",
            "salaryMin": lo, "salaryMax": hi, "salaryAvg": int(round((lo + hi) / 2)),
            "salaryText": salary_text_from_numbers(lo, hi),
            "salaryRaw": clean_text(row.get("salary")),
            "experience": "未标注", "education": "未标注",
            "jobType": clean_text(row.get("job_type")) or "其他",
            "skills": row["skill_list"], "campus": False,
            "date": "", "dateKey": 0,
            "description": row["description_clean"],
            "benefits": benefits[:8],
            "companyType": "未标注", "companySize": "未标注", "industry": "未标注",
            "bLabel": clean_text(row.get("label")),
        })

    stats = {"pool": int(len(pool)), "selected": len(records)}
    return pd.DataFrame(records), stats


# ---------------------------------------------------------------------------
# Assemble
# ---------------------------------------------------------------------------
def main() -> None:
    print("[1/4] preparing dataset A ...")
    a_df, a_stats = build_a()
    print("      A:", a_stats)
    print("[2/4] preparing dataset B ...")
    b_df, b_stats = build_b()
    print("      B:", b_stats)
    print("[3/4] assembling 400 records ...")
    jobs = pd.concat([a_df, b_df], ignore_index=True)
    if len(jobs) > 400:
        # Keep the intended 300/100 split.
        jobs = pd.concat([
            jobs[jobs.source == "A"].head(300),
            jobs[jobs.source == "B"].head(100),
        ], ignore_index=True)
    jobs["id"] = [f"{src}-{i:04d}" for i, src in enumerate(jobs["source"], start=1)]
    jobs = jobs.sample(frac=1, random_state=SEED).reset_index(drop=True)
    # Re-assign IDs after shuffle so the list looks natural.
    jobs["id"] = [f"{src}-{i:04d}" for i, src in enumerate(jobs["source"], start=1)]
    # A 集没有 bLabel 字段，concat 后是 NaN；统一成空字符串，保证导出的是合法 JSON。
    jobs["bLabel"] = jobs["bLabel"].fillna("").astype(str) if "bLabel" in jobs.columns else ""

    # Skill frequency over the sample.
    skill_counts = {name: 0 for name in SKILL_NAMES}
    for skills in jobs["skills"]:
        for name in skills:
            if name in skill_counts:
                skill_counts[name] += 1
    skills_meta = [
        {"name": name, "group": SKILL_GROUP[name], "count": int(skill_counts.get(name, 0))}
        for name in SKILL_NAMES
    ]
    skills_meta = [s for s in skills_meta if s["count"] > 0]

    all_skills = [s for xs in jobs["skills"] for s in xs]
    avg_salary = jobs["salaryAvg"].astype(float)
    meta = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "brand": "校招罗盘",
        "brandEn": "CAMPUS COMPASS",
        "subtitle": "校招信息聚合与智能推荐平台",
        "sampleTotal": int(len(jobs)),
        "sourceA": int((jobs.source == "A").sum()),
        "sourceB": int((jobs.source == "B").sum()),
        "datasetTotals": {"A": 24185, "B": 10114, "merged": 34296},
        "cities": int(jobs["city"].nunique()),
        "companies": int(jobs["company"].nunique()),
        "skillTotal": int(len(skills_meta)),
        "campusCount": int(jobs["campus"].sum()),
        "medianSalary": int(round(avg_salary.median())),
        "p25Salary": int(round(avg_salary.quantile(0.25))),
        "p75Salary": int(round(avg_salary.quantile(0.75))),
        "avgSalary": int(round(avg_salary.mean())),
        "salaryMin": int(avg_salary.min()),
        "salaryMax": int(avg_salary.max()),
        "avgSkillsPerJob": round(float(jobs["skills"].map(len).mean()), 1),
        "notes": [
            "演示样本共 400 条：数据集 A 300 条、数据集 B 100 条，按城市/技能/来源分层抽取，非全量数据。",
            "数据集 A 为纯数据岗子集，含 18 个技能哑变量；B 为公开招聘 JD，技能由词典从标题与描述中抽取。",
            "数据集 A 含 237 条应届岗位，B 无经验字段；平台以“应届优先”标签区分，不宣称全量校招。",
            "B 集原始 label 含经济金融、生物统计等非 IT 岗位，已从演示样本中剔除。",
            "薪资均为月薪，已过滤 3000–60000 元区间；页面统一显示折算后的月薪，原始薪资文本保留在岗位详情页。",
            "B 集使用 minsalary / maxsalary 折算；A 集原始年薪/日薪已由数据字典折算为月薪。",
            "单岗位最多保留 8 项核心技能，用于匹配计算与展示。",
        ],
        "sampleStats": {"A": a_stats, "B": b_stats},
        "totalSkillAssignments": len(all_skills),
    }

    payload = {
        "meta": meta,
        "skills": skills_meta,
        "profiles": PROFILES,
        "experimentProfiles": EXPERIMENT_PROFILES,
        "jobs": jobs.to_dict(orient="records"),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    # 前端以 <script> 方式加载：file:// 下 fetch JSON 会被 CORS 拦截，
    # 因此同时输出一份 JS 全局变量，双击 index.html 即可离线运行。
    with OUT_JS.open("w", encoding="utf-8", newline="\n") as f:
        f.write("/* 自动生成，勿手改。源：scripts/build_demo_data.py */\n")
        f.write("window.CC_DATA = ")
        f.write(text)
        f.write(";\n")
    print(f"[4/4] wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
    print(f"      wrote {OUT_JS} ({OUT_JS.stat().st_size / 1024:.1f} KB)")
    print(f"      jobs={len(jobs)} A={(jobs.source=='A').sum()} B={(jobs.source=='B').sum()} "
          f"campus={jobs.campus.sum()} cities={jobs.city.nunique()} skills={len(skills_meta)}")
    print("      top skills:", ", ".join(f"{s['name']}={s['count']}" for s in sorted(skills_meta, key=lambda x: -x["count"])[:10]))
    print("      salary median:", meta["medianSalary"], "p25:", meta["p25Salary"], "p75:", meta["p75Salary"])
    print("      job types:", jobs.jobType.value_counts().to_dict())
    print("      city counts:", jobs.city.value_counts().head(12).to_dict())
    print("      B labels:", jobs[jobs.source == "B"].get("bLabel", pd.Series(dtype=str)).value_counts().to_dict())


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print("ERROR:", exc, file=sys.stderr)
        raise
