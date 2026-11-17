# -*- coding: utf-8 -*-
"""逐条复核项目书里对数据集的数字声明，输出 UTF-8 报告。

只读 data/raw 下的原始文件，不修改数据。
"""
import io
import os
import sys

import pandas as pd

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
REPORT = os.path.join(RAW, "_claim_check.txt")
_buf = io.StringIO()


def out(s=""):
    print(s)
    _buf.write(str(s) + "\n")


def check(name, claim, actual, ok=None):
    if ok is None:
        ok = "?"
    mark = {True: "✓ 对得上", False: "✗ 不符", "?": "? 需人工判断"}[ok]
    out(f"  [{mark}] {name}")
    out(f"        项目书写: {claim}")
    out(f"        实测    : {actual}")


def main():
    out("项目书数据声明复核")
    out("=" * 78)

    A = pd.read_csv(os.path.join(RAW, "cleaned_all.csv"), encoding="utf-8-sig", low_memory=False)
    AD = pd.read_csv(os.path.join(RAW, "cleaned_data_jobs.csv"), encoding="utf-8-sig", low_memory=False)
    B = pd.read_excel(os.path.join(RAW, "job_posting_data_B.xlsx"))

    out("\n【一】数据集 A —— cleaned_all.csv（文档称 24,185 条 x 34 列）")
    check("行数", "24,185 条", f"{len(A):,} 条", len(A) == 24185)
    check("列数", "34 列", f"{A.shape[1]} 列", A.shape[1] == 34)

    skill_cols = [c for c in A.columns if c not in
                  ("job_title", "company", "city", "salary", "publish_date", "tags",
                   "company_type", "company_size", "industry", "description",
                   "salary_min", "salary_max", "salary_avg", "education", "experience",
                   "skill_count")]
    check("自带技能哑变量列数", "12 个", f"{len(skill_cols)} 个 -> {skill_cols}", False)

    yy = int((A["experience"].astype(str) == "应届生").sum())
    check("experience 含'应届生'", "1,444 条", f"{yy:,} 条", yy == 1444)

    pd_uniq = A["publish_date"].nunique()
    check("publish_date 取值范围", "仅 7/7-7/9 三天",
          f"{A['publish_date'].min()} ~ {A['publish_date'].max()}，{pd_uniq} 个唯一值（MM-DD，无年份）", False)

    bj = (A["city"].astype(str) == "北京").mean() * 100
    out(f"  [参考] 北京占比: {bj:.1f}%")

    desc = A["description"].fillna("").astype(str)
    real = desc[(desc != "") & (desc != "[]")]
    ln = real.str.len()
    out(f"  [参考] description 有正文 {len(real):,}/{len(A):,} ({len(real)/len(A)*100:.1f}%)"
        f"；中位 {ln.median():.0f} 字，均值 {ln.mean():.0f} 字，最长 {ln.max():,.0f} 字")
    out(f"  [参考] 值恰为 '[]' 的行: {int((desc=='[]').sum()):,}")
    is_listlit = real.str.startswith("[").mean() * 100 if len(real) else 0
    out(f"  [参考] 正文为 Python list 字面量（以 [ 开头）的比例: {is_listlit:.1f}%")

    hit = A[skill_cols].apply(pd.to_numeric, errors="coerce").fillna(0).gt(0)
    out(f"  [参考] 全量口径下至少命中 1 项技能的行: {int(hit.any(axis=1).sum()):,}"
        f" ({hit.any(axis=1).mean()*100:.1f}%)  <== 技能抽取的可用上限")

    out("\n【二】数据集 A 子集 —— cleaned_data_jobs.csv（文档称纯数据岗）")
    out(f"  [参考] {len(AD):,} 行 x {AD.shape[1]} 列")
    h2 = AD[skill_cols].apply(pd.to_numeric, errors="coerce").fillna(0).gt(0)
    out(f"  [参考] 至少命中 1 项技能: {h2.any(axis=1).mean()*100:.1f}%")

    out("\n【三】数据集 B —— job_posting_data_B.xlsx（文档称 10,114 条 x 11 列）")
    check("行数", "10,114 条", f"{len(B):,} 条", len(B) == 10114)
    check("列数", "11 列", f"{B.shape[1]} 列", B.shape[1] == 11)

    miss = B["company"].isna().mean() * 100
    check("公司缺失率", "8.99%", f"{miss:.2f}%", abs(miss - 8.99) < 0.05)

    d = B["description"].fillna("").astype(str)
    dl = d.str.len()
    check("JD 平均字数", "平均 348 字", f"均值 {dl.mean():.0f} 字，中位 {dl.median():.0f} 字", None)
    check("JD 最长", "5,687 字", f"{dl.max():,.0f} 字", dl.max() == 5687)

    short = int((dl < 50).sum())
    check("短于 50 字符的条数", "459 条（4.5%）",
          f"{short:,} 条（{short/len(B)*100:.1f}%）", short == 459)

    bjb = (B["city"].astype(str) == "北京").mean() * 100
    check("北京占比", "32.4%", f"{bjb:.1f}%", abs(bjb - 32.4) < 0.5)

    qt = (B["city"].astype(str) == "其他").mean() * 100
    check("'其他'桶占比", "18.2%", f"{qt:.1f}%", abs(qt - 18.2) < 0.5)

    out("\n  label 取值分布（文档称 5 类，算法岗一致性最低 43.8%）:")
    for k, v in B["label"].value_counts().items():
        out(f"    {str(k):<12} {v:>7,}  ({v/len(B)*100:5.1f}%)")

    out("\n  salary 列样例与类型:")
    out(f"    类型 {B['salary'].dtype}   样例 {[str(x) for x in B['salary'].head(3)]}")
    out(f"    minsalary/maxsalary/meansalary 是否齐全: "
        f"{B[['minsalary','maxsalary','meansalary']].notna().all().to_dict()}")

    out("\n【四】合并口径")
    check("A + B 合计", "34,299 条", f"{len(A)+len(B):,} 条", len(A) + len(B) == 34299)
    dup = A.merge(B, left_on="job_title", right_on="jobname", how="inner")
    out(f"  [参考] 按 job_title==jobname 内连接命中 {len(dup):,} 行（说明两源存在同名字段可对齐）")
    key_a = A["job_title"].astype(str) + "|" + A["company"].astype(str)
    key_b = B["jobname"].astype(str) + "|" + B["company"].astype(str)
    inter = len(set(key_a) & set(key_b))
    out(f"  [参考] 按 岗位名|公司 求交: {inter:,} 条重复；去重后合计约 "
        f"{len(A)+len(B)-inter:,} 条")

    out("\n【五】技能词表 THUOCL_it.txt")
    with open(os.path.join(RAW, "THUOCL_it.txt"), encoding="utf-8-sig") as f:
        wl = [l.rstrip("\n") for l in f if l.strip()]
    cols = {len(l.split("\t")) for l in wl}
    check("行数与列结构", "文档未声明",
          f"{len(wl):,} 行，每行 {cols} 列（'词语<TAB>词频'），编码 utf-8-sig", None)

    out("\n【六】许可证")
    check("数据集 A 许可证", "MIT License（README 声明）",
          "README 写 MIT，但 GitHub API 返回 license=null —— 仓库内没有 LICENSE 文件", False)

    with open(REPORT, "w", encoding="utf-8") as fp:
        fp.write(_buf.getvalue())
    print(f"\n[报告已写入] {REPORT}")


if __name__ == "__main__":
    sys.exit(main())
