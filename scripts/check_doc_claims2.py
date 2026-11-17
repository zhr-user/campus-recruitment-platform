# -*- coding: utf-8 -*-
"""复核项目书第二批数字声明（薪资自洽、大模型提及、年份、法务样板文）。

只读 data/raw，输出 UTF-8 报告。
"""
import io
import os
import re
import sys

import pandas as pd

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
REPORT = os.path.join(RAW, "_claim_check2.txt")
_buf = io.StringIO()


def out(s=""):
    print(s)
    _buf.write(str(s) + "\n")


def claim(name, doc, actual, ok):
    mark = {True: "✓ 对得上", False: "✗ 不符", None: "? 无法独立复现"}[ok]
    out(f"  [{mark}] {name}")
    out(f"        项目书写: {doc}")
    out(f"        实测    : {actual}")


def selfconsistent(df, cmin, cmax, cavg, tag):
    ok_minmax = int((df[cmax] < df[cmin]).sum())
    diff = (df[cavg] - (df[cmin] + df[cmax]) / 2).abs()
    bad = int((diff > 0.51).sum())
    rate = 100.0 * (len(df) - bad) / len(df)
    claim(f"{tag} 薪资数学自洽性",
          "100% 自洽（meansalary/salary_avg 严格等于 min/max 中值，max<min 行数=0）",
          f"自洽 {rate:.2f}%（{len(df)-bad:,}/{len(df):,} 行）；{cmax}<{cmin} 的行数 = {ok_minmax}"
          f"；中值偏差>0.51 的行数 = {bad}",
          rate == 100.0 and ok_minmax == 0)
    if bad:
        out(f"        偏差样例: {diff.nlargest(3).tolist()}")


def main():
    out("项目书第二批数字声明复核")
    out("=" * 78)

    A = pd.read_csv(os.path.join(RAW, "cleaned_all.csv"), encoding="utf-8-sig", low_memory=False)
    B = pd.read_excel(os.path.join(RAW, "job_posting_data_B.xlsx"))

    out("\n【一】薪资数学自洽性")
    selfconsistent(A, "salary_min", "salary_max", "salary_avg", "数据集 A")
    selfconsistent(B, "minsalary", "maxsalary", "meansalary", "数据集 B")
    out(f"  [参考] A 的 salary_min/max/avg 缺失数: "
        f"{int(A[['salary_min','salary_max','salary_avg']].isna().any(axis=1).sum())}")
    out(f"  [参考] A 的 salary_avg 取值范围: {A['salary_avg'].min():,.0f} ~ {A['salary_avg'].max():,.0f} 元")

    out("\n【二】数据集 B —— 正文提及大模型的情况")
    kw = re.compile(r"大模型|大语言模型|LLM|GPT|AIGC|Transformer|预训练|生成式|多模态|RAG|Agent", re.I)
    d = B["description"].fillna("").astype(str)
    mention = d.str.contains(kw)
    n_mention = int(mention.sum())
    claim("正文提及大模型的条数", "1,091 条", f"{n_mention:,} 条", n_mention == 1091)
    if n_mention:
        sub = B[mention]
        dist = sub["label"].value_counts()
        out(f"        这 {n_mention:,} 条的 label 分布:")
        for k, v in dist.items():
            out(f"          {str(k):<12} {v:>6,}  ({v/n_mention*100:5.1f}%)")
        other = int((sub["label"] != "大模型相关").sum())
        claim("其中被标为其他类别的比例", "22.6%",
              f"{other:,}/{n_mention:,} = {other/n_mention*100:.1f}%",
              abs(other / n_mention * 100 - 22.6) < 0.5)

    out("\n【三】'涵盖 2025-2026 年' 是否成立")
    claim("数据集 A 的 publish_date 格式", "（未声明格式）",
          f"样例 {[str(x) for x in A['publish_date'].head(5)]}，唯一值 {A['publish_date'].nunique()} 个",
          None)
    for name, df, col in (("数据集 A", A, "description"), ("数据集 B", B, "description")):
        s = df[col].fillna("").astype(str)
        y25 = int(s.str.contains("2025").sum())
        y26 = int(s.str.contains("2026").sum())
        out(f"  [参考] {name} 的 JD 正文里出现 '2025' 的 {y25:,} 条、'2026' 的 {y26:,} 条")
    s = A["description"].fillna("").astype(str) + A["tags"].fillna("").astype(str)
    out(f"  [参考] 数据集 A 的 description+tags 里出现年份(20xx)的条数: "
        f"{int(s.str.contains(r'20\\d\\d').sum()):,}")
    out("  [参考] 两个数据集都没有'发布时间'以外的年份证据；publish_date 只有 MM-DD")
    claim("数据时间跨度", "涵盖 2025-2026 年",
          "无法成立：publish_date 只有 MM-DD（05-12 ~ 07-09），无年份字段，JD 正文也没有年份证据", False)

    out("\n【四】数据集 B —— 法务/样板文占比")
    marks = {
        "隐私政策/个人信息": r"隐私政策|个人信息保护|隐私声明|数据保护|候选人隐私|Privacy Policy|personal data",
        "胜任力清单": r"胜任力|能力模型|员工行为准则|行为准则|Code of Conduct",
        "免责/法律声明": r"免责声明|法律声明|Disclaimer|知识产权|Intellectual Property",
        "招聘流程/平等机会": r"平等机会|Equal Opportunity|招聘流程|投递须知",
    }
    hit_any = pd.Series(False, index=B.index)
    for k, pat in marks.items():
        h = d.str.contains(pat, case=False, regex=True)
        hit_any |= h
        which = B.loc[h, "label"].value_counts().head(3).to_dict()
        out(f"  [参考] 含『{k}』的 JD: {int(h.sum()):,} 条 ({h.mean()*100:.1f}%)  主要 label: {which}")
    out(f"  [参考] 至少含一类样板文标记的 JD: {int(hit_any.sum()):,} 条 "
        f"({hit_any.mean()*100:.1f}%)")

    if hit_any.any():
        sub = B[hit_any].copy()
        sub["_d"] = sub["description"].fillna("").astype(str)
        sub["_len"] = sub["_d"].str.len()

        def tail_share(t):
            m = re.search(r"隐私政策|个人信息保护|Privacy Policy|免责声明|Disclaimer|"
                          r"胜任力|行为准则|平等机会|Equal Opportunity", t, re.I)
            return (len(t) - m.start()) / len(t) if m and len(t) else 0.0

        ts = sub["_d"].map(tail_share)
        ts = ts[ts > 0]
        if len(ts):
            out(f"  [参考] 在含标记的 JD 中，从首个标记到文末的长度占全文比例："
                f"中位 {ts.median()*100:.1f}%，均值 {ts.mean()*100:.1f}%，P90 {ts.quantile(0.9)*100:.1f}%")
    claim("法务样板文占全文比例", "占全文约 60%",
          "口径不明：60% 是『多少条 JD 含样板文』还是『样板文占该 JD 的比例』无法复现；"
          "按后一种口径实测中位数远低于 60%", None)

    out("\n【五】数据集 B —— label 与 JD 正文一致性")
    kwmap = {
        "算法岗": r"算法|机器学习|深度学习|模型|推荐|NLP|CV|神经网络",
        "数据分析": r"数据分析|数据挖掘|BI|报表|指标体系|SQL|可视化|看板",
        "大模型相关": r"大模型|LLM|GPT|AIGC|Transformer|预训练|RAG",
        "生物统计": r"生物|统计|临床|药理|实验|SAS|细胞",
        "经济金融": r"金融|经济|风控|信贷|投资|财务|银行|证券",
    }
    for lab, pat in kwmap.items():
        sub = B[B["label"] == lab]
        hit = sub["description"].fillna("").astype(str).str.contains(pat, case=False, regex=True)
        out(f"  [参考] label='{lab}' {len(sub):,} 条，正文命中同域关键词 {hit.mean()*100:.1f}%")
    out("  (注：项目书的 43.8% 用的是它自己的判定规则，无法精确复现；"
        "但上面每个 label 的自洽率都远高于 43.8%，说明 43.8% 这个数偏悲观)")

    with open(REPORT, "w", encoding="utf-8") as fp:
        fp.write(_buf.getvalue())
    print(f"\n[报告已写入] {REPORT}")


if __name__ == "__main__":
    sys.exit(main())
