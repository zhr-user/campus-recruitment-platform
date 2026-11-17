# -*- coding: utf-8 -*-
"""核验 data/raw 下原始数据是否真实可用，并把 UTF-8 报告写到文件。

只读，不修改数据。用法：
    python verify_raw_data.py [文件名 ...]      # 不给参数则核验全部
"""
import io
import os
import sqlite3
import sys

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
REPORT = os.path.join(RAW, "_verify_report.txt")
_buf = io.StringIO()


def out(s=""):
    print(s)
    _buf.write(str(s) + "\n")


def hr(title):
    out()
    out("=" * 78)
    out(title)
    out("=" * 78)


def listish_stats(df, col):
    """判断某列是 'list 字符串' 还是真缺失。"""
    import pandas as pd

    s = df[col]
    na = int(s.isna().sum())
    empty_brackets = int((s == "[]").sum())
    real = s.notna() & (s != "[]")
    lens = s[real].astype(str).str.len()
    out(f"  {col:<26} 缺失 {na:>7,}  值'[]' {empty_brackets:>7,}  有内容 {len(lens):>7,}"
        + (f"  长度中位 {lens.median():.0f} 最长 {lens.max():,.0f}" if len(lens) else ""))
    return real


def desc_stats(df, col="description"):
    """JD 正文的真实性核查。"""
    import pandas as pd

    if col not in df.columns:
        out(f"  [无 {col} 列]")
        return
    s = df[col].fillna("").astype(str)
    n = len(s)
    out(f"  {col} 长度统计（共 {n:,} 行）:")
    out(f"    空串 {{}} 之外: 空串 {int((s=='').sum()):,}   值'[]' {int((s=='[]').sum()):,}")
    real = s[(s != "") & (s != "[]")]
    if len(real) == 0:
        out("    !! 没有任何真实 JD 正文 —— 该文件的 description 是空的")
        return
    ln = real.str.len()
    for q in (0, 10, 25, 50, 75, 90, 100):
        out(f"    P{q:<3} {ln.quantile(q/100):>10,.0f} 字")
    out(f"    均值 {ln.mean():>10,.0f} 字   中位 {ln.median():,.0f} 字")
    out(f"    <50 字 {int((ln < 50).sum()):,} ({(ln<50).mean()*100:.1f}%)"
        f"    >=200 字 {int((ln >= 200).sum()):,} ({(ln>=200).mean()*100:.1f}%)")
    out(f"    样例 [{real.index[0]}]: {real.iloc[0][:120]!r}")


def show_csv(path):
    import pandas as pd

    hr(f"CSV: {os.path.basename(path)}   {os.path.getsize(path):,} 字节")
    with open(path, "rb") as f:
        head = f.read(4)
    out(f"文件头字节: {head!r}   (UTF-8 BOM = b'\\xef\\xbb\\xbf')")
    df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)
    out(f"形状: {df.shape[0]:,} 行 x {df.shape[1]} 列")
    out(f"列名: {list(df.columns)}")
    out()
    out("--- 关键列 ---")
    for c in ("job_title", "company", "city", "salary", "publish_date",
              "education", "experience"):
        if c in df.columns:
            out(f"  {c:<14} 缺失 {int(df[c].isna().sum()):>6,}  唯一值 {df[c].nunique():>6,}"
                f"  样例: {[str(v)[:26] for v in df[c].dropna().head(4)]}")
    out()
    out("--- list 字符串列 ---")
    for c in ("tags", "company_type", "company_size", "industry", "description"):
        if c in df.columns:
            listish_stats(df, c)
    out()
    out("--- JD 正文 ---")
    desc_stats(df)
    out()
    out("--- skills 哑变量列 ---")
    skill_cols = [c for c in df.columns if c not in
                  ("job_title", "company", "city", "salary", "publish_date", "tags",
                   "company_type", "company_size", "industry", "description",
                   "salary_min", "salary_max", "salary_avg", "education", "experience",
                   "skill_count")]
    out(f"  技能列 {len(skill_cols)} 个: {skill_cols}")
    if skill_cols:
        hit = df[skill_cols].apply(pd.to_numeric, errors="coerce").fillna(0).gt(0)
        rate = (hit.mean() * 100).sort_values(ascending=False)
        out("  命中率前 10:")
        for k, v in rate.head(10).items():
            out(f"    {k:<14} {v:5.1f}%  ({int(hit[k].sum()):,} 条)")
        out(f"  至少命中 1 项技能的行: {int(hit.any(axis=1).sum()):,}"
            f"  ({hit.any(axis=1).mean()*100:.1f}%)")
    if "publish_date" in df.columns:
        out()
        out(f"  publish_date 取值范围: {df['publish_date'].min()!r} ~ {df['publish_date'].max()!r}"
            f"  唯一值 {df['publish_date'].nunique()}")
    if "city" in df.columns:
        out()
        out("  city 前 8:")
        for k, v in df["city"].value_counts().head(8).items():
            out(f"    {str(k):<16} {v:>7,}  ({v/len(df)*100:5.1f}%)")
    if "experience" in df.columns:
        out()
        out("  experience 分布:")
        for k, v in df["experience"].value_counts().head(10).items():
            out(f"    {str(k):<16} {v:>7,}  ({v/len(df)*100:5.1f}%)")


def show_xlsx(path):
    import pandas as pd

    hr(f"XLSX: {os.path.basename(path)}   {os.path.getsize(path):,} 字节")
    with open(path, "rb") as f:
        head = f.read(8)
    out(f"文件头 8 字节: {head!r}")
    if head[:2] == b"PK":
        out("  -> 真 ZIP/OOXML（xlsx）")
    elif head[:4] == b"\\xd0\\xcf\\x11\\xe0":
        out("  -> 老式 OLE2（实际是 .xls）")
    else:
        out("  -> 不是 xlsx！可能是改名后的 CSV/HTML")
    xl = pd.ExcelFile(path)
    out(f"引擎: {xl.engine}   工作表: {xl.sheet_names}")
    for sh in xl.sheet_names:
        df = xl.parse(sh)
        out(f"  [{sh}] {df.shape[0]:,} 行 x {df.shape[1]} 列")
        out(f"  列名: {list(df.columns)}")
        for c in df.columns:
            m = int(df[c].isna().sum())
            out(f"    {c:<26} 缺失 {m:>6,} ({100*m/max(len(df),1):5.1f}%)  唯一 {df[c].nunique():>6,}")
        desc_cols = [c for c in df.columns if str(c).lower() in
                     ("description", "job_description", "jd", "detail", "job_detail")]
        for c in desc_cols:
            out()
            out(f"  --- {c} 正文长度 ---")
            s = df[c].fillna("").astype(str)
            ln = s.str.len()
            out(f"    中位 {ln.median():,.0f} 字  最长 {ln.max():,.0f} 字  空串 {int((s=='').sum()):,}")
            out(f"    样例: {s.iloc[0][:120]!r}")
        out()
        out("  前 2 行（关键列）:")
        with pd.option_context("display.max_columns", None, "display.width", 250):
            out("    " + df.head(2).to_string().replace("\n", "\n    "))


def show_text(path):
    hr(f"TXT: {os.path.basename(path)}   {os.path.getsize(path):,} 字节")
    for enc in ("utf-8-sig", "utf-8", "gbk"):
        try:
            with open(path, encoding=enc) as f:
                lines = f.read().splitlines()
            out(f"编码: {enc}   行数: {len(lines):,}")
            out("  前 6 行:")
            for ln in lines[:6]:
                out(f"    {ln}")
            out("  末 2 行:")
            for ln in lines[-2:]:
                out(f"    {ln}")
            return
        except UnicodeDecodeError:
            continue
    out("三种编码都解不开")


def show_sqlite(path):
    hr(f"SQLITE: {os.path.basename(path)}   {os.path.getsize(path):,} 字节")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    cur = con.cursor()
    tabs = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    out(f"表: {tabs}")
    for t in tabs:
        n = cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        cols = [c[1] for c in cur.execute(f'PRAGMA table_info("{t}")')]
        out()
        out(f"  [{t}]  {n:,} 行 x {len(cols)} 列")
        out(f"    列: {cols}")
        if "description" in cols:
            rows = cur.execute(
                f'SELECT description FROM "{t}" WHERE description IS NOT NULL '
                f'AND description != "" AND description != "[]" LIMIT 1').fetchall()
            if rows:
                txt = rows[0][0]
                out(f"    description 样例({len(txt)} 字): {txt[:150]!r}")
            else:
                out("    !! description 全为空/'[]'")
    con.close()


if __name__ == "__main__":
    out(f"数据目录: {RAW}")
    if not os.path.isdir(RAW):
        sys.exit(f"目录不存在: {RAW}")
    files = sorted(f for f in os.listdir(RAW) if not f.startswith("_"))
    for f in files:
        out(f"  {f:<26} {os.path.getsize(os.path.join(RAW, f)):>12,} 字节")

    only = sys.argv[1:]
    for f in files:
        if only and f not in only:
            continue
        p = os.path.join(RAW, f)
        low = f.lower()
        try:
            if low.endswith(".csv"):
                show_csv(p)
            elif low.endswith((".xlsx", ".xls")):
                show_xlsx(p)
            elif low.endswith(".db"):
                show_sqlite(p)
            elif low.endswith(".txt"):
                show_text(p)
        except Exception as e:  # noqa: BLE001
            out(f"\n!! 处理 {f} 出错: {type(e).__name__}: {e}")

    with open(REPORT, "w", encoding="utf-8") as fp:
        fp.write(_buf.getvalue())
    print(f"\n[报告已写入] {REPORT}")
