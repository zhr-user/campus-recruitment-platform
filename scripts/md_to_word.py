# -*- coding: utf-8 -*-
"""
Markdown → Word 转换器
专为《校招信息聚合与智能推荐平台 — 项目计划书》定制

处理要点：
  1. 中文字体（标题黑体、正文宋体、代码 Consolas）
  2. 代码块用"单元格底纹"实现背景色，保留 ASCII 图对齐
  3. 表格自动识别并应用边框样式
  4. 行内 **加粗** 与 `代码` 解析
  5. 超宽代码行自动缩小字号以适应页面
"""

import io
import os
import re
import sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ============================================================
# 配置区
# ============================================================
_DOCS = r"D:\校招信息聚合与智能推荐平台项目\docs"
# 默认目标保持不变；可用命令行覆盖：  python md_to_word.py <源.md> [目标.docx]
SRC = r"D:\校招信息聚合与智能推荐平台项目\docs\项目计划书.md"
DST = r"D:\校招信息聚合与智能推荐平台项目\docs\校招信息聚合与智能推荐平台-项目计划书.docx"

if len(sys.argv) > 1:
    SRC = sys.argv[1]
    if len(sys.argv) > 2:
        DST = sys.argv[2]
    else:
        _base = os.path.splitext(os.path.basename(SRC))[0]
        DST = os.path.join(os.path.dirname(os.path.abspath(SRC)), _base + ".docx")

FONT_CN_TITLE = "黑体"        # 标题中文字体
FONT_CN_BODY = "宋体"         # 正文中文字体
FONT_CN_QUOTE = "楷体"        # 引用块中文字体
FONT_EN = "Times New Roman"   # 正文西文字体
FONT_CODE = "Consolas"        # 代码字体

COLOR_H1 = RGBColor(0x1F, 0x3A, 0x5F)
COLOR_H2 = RGBColor(0x1F, 0x3A, 0x5F)
COLOR_H3 = RGBColor(0x2E, 0x54, 0x7A)
COLOR_H4 = RGBColor(0x3A, 0x3A, 0x3A)
COLOR_CODE_TEXT = RGBColor(0x1A, 0x1A, 0x1A)
COLOR_QUOTE_TEXT = RGBColor(0x44, 0x44, 0x44)
COLOR_LINK = RGBColor(0x0B, 0x5C, 0xB0)

CODE_SHADING = "F5F5F5"       # 代码块底纹
CODE_SHADING_DARK = "EDEDED"  # 深色代码块（ASCII 图）底纹
TABLE_HEADER_SHADING = "DCE6F1"  # 表头底纹

CODE_FONT_SIZE = Pt(8.5)
CODE_FONT_SIZE_TINY = Pt(6.5)  # 超宽行


# ============================================================
# 底层工具函数
# ============================================================
def set_run_font(run, cn_font, en_font, size=None, bold=None,
                 color=None, italic=None):
    """设置 run 的中英文字体（python-docx 设置中文字体必须先设 eastAsia）"""
    run.font.name = en_font
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), en_font)
    rFonts.set(qn('w:hAnsi'), en_font)
    rFonts.set(qn('w:eastAsia'), cn_font)
    if size is not None:
        run.font.size = size
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color


def shade_cell(cell, hex_color):
    """给单元格加底纹"""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)


def set_cell_margins(cell, top=60, start=100, bottom=60, end=100):
    """设置单元格内边距（单位 dxa，1pt = 20dxa）"""
    tcPr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement('w:tcMar')
    for tag, val in (('top', top), ('start', start), ('bottom', bottom), ('end', end)):
        node = OxmlElement(f'w:{tag}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        mar.append(node)
    tcPr.append(mar)


def remove_table_borders(table):
    """移除表格边框（用于代码块容器）"""
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{edge}')
        el.set(qn('w:val'), 'none')
        el.set(qn('w:sz'), '0')
        borders.append(el)
    tblPr.append(borders)


def keep_lines_together(paragraph):
    """防止段落跨页断开（代码块用）"""
    pPr = paragraph._p.get_or_add_pPr()
    for tag in ('w:keepNext', 'w:keepLines'):
        el = OxmlElement(tag)
        pPr.append(el)


# ============================================================
# 行内格式解析：**加粗**、`代码`、[链接](url)
# ============================================================
INLINE_RE = re.compile(
    r'(\*\*.+?\*\*)'          # 1 加粗
    r'|(`[^`]+?`)'            # 2 行内代码
    r'|(\[[^\]]+?\]\([^)]+?\))'  # 3 链接
)


def add_inline_text(paragraph, text, cn_font=FONT_CN_BODY, en_font=FONT_EN,
                    size=Pt(10.5), base_bold=False, color=None):
    """把含 Markdown 行内标记的文本写入段落"""
    pos = 0
    for m in INLINE_RE.finditer(text):
        # 先写普通片段
        if m.start() > pos:
            run = paragraph.add_run(text[pos:m.start()])
            set_run_font(run, cn_font, en_font, size, base_bold, color)

        token = m.group(0)
        if token.startswith('**'):
            run = paragraph.add_run(token[2:-2])
            set_run_font(run, cn_font, en_font, size, True, color)
        elif token.startswith('`'):
            run = paragraph.add_run(token[1:-1])
            set_run_font(run, cn_font, FONT_CODE, Pt(size.pt - 0.5), base_bold,
                         RGBColor(0xC7, 0x25, 0x4E))
        elif token.startswith('['):
            label = re.match(r'\[([^\]]+?)\]', token).group(1)
            run = paragraph.add_run(label)
            set_run_font(run, cn_font, en_font, size, base_bold, COLOR_LINK)
        pos = m.end()

    if pos < len(text):
        run = paragraph.add_run(text[pos:])
        set_run_font(run, cn_font, en_font, size, base_bold, color)


def has_wide_char(text):
    """判断是否含中文/全角字符"""
    return any('\u4e00' <= ch <= '\u9fff' or '\u3000' <= ch <= '\u303f'
               or '\uff00' <= ch <= '\uffef' for ch in text)


# ============================================================
# 各类块渲染
# ============================================================
def add_heading(doc, text, level):
    """添加标题（1-4 级）"""
    sizes = {1: Pt(22), 2: Pt(16), 3: Pt(13.5), 4: Pt(12)}
    colors = {1: COLOR_H1, 2: COLOR_H2, 3: COLOR_H3, 4: COLOR_H4}

    if level == 1:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(24)
    else:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14 if level == 2 else 10)
        p.paragraph_format.space_after = Pt(8 if level == 2 else 6)
        if level == 2:
            p.paragraph_format.page_break_before = False

    clean = text.replace('**', '').replace('`', '')
    run = p.add_run(clean)
    set_run_font(run, FONT_CN_TITLE, FONT_EN, sizes.get(level, Pt(12)),
                 True, colors.get(level))
    return p


def add_paragraph(doc, text):
    """普通段落"""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.4
    p.paragraph_format.first_line_indent = Pt(0)
    add_inline_text(p, text)
    return p


def add_list_item(doc, text, ordered, level_hint=0):
    """列表项"""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.8 + level_hint * 0.6)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.35

    # 手动加项目符号（避免依赖 Word 的 List Bullet 样式在中文字体下的问题）
    if ordered:
        m = re.match(r'^(\d+)\.\s+(.*)$', text)
        prefix = f"{m.group(1)}. " if m else "• "
        body = m.group(2) if m else text
    else:
        prefix = "• "
        body = re.sub(r'^[-*]\s+', '', text)

    run = p.add_run(prefix)
    set_run_font(run, FONT_CN_BODY, FONT_EN, Pt(10.5), False)
    add_inline_text(p, body)
    return p


def add_quote(doc, text):
    """引用块（> 开头的内容）"""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.6)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.35

    # 左侧竖线效果：用制表符 + 竖线模拟
    clean = re.sub(r'^>\s?', '', text).rstrip()
    if not clean:
        return None

    run = p.add_run("│ ")
    set_run_font(run, FONT_CN_QUOTE, FONT_EN, Pt(10.5), False,
                 RGBColor(0xB0, 0xB0, 0xB0))
    add_inline_text(p, clean, cn_font=FONT_CN_QUOTE, size=Pt(10.5),
                    color=COLOR_QUOTE_TEXT)
    return p


def add_code_block(doc, code_lines):
    """代码块：用单单元格表格实现背景色 + 保留 ASCII 对齐"""
    if not code_lines:
        return None

    # 判断是否含中文（含中文用宋体渲染中文，避免 Consolas 缺字）
    has_cn = any(has_wide_char(l) for l in code_lines)
    max_len = max((len(l) for l in code_lines), default=0)
    is_wide_art = max_len > 95          # ASCII 图 / ER 图
    font_size = CODE_FONT_SIZE_TINY if is_wide_art else CODE_FONT_SIZE
    shading = CODE_SHADING_DARK if is_wide_art else CODE_SHADING

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    remove_table_borders(table)

    cell = table.cell(0, 0)
    shade_cell(cell, shading)
    set_cell_margins(cell, top=100, start=140, bottom=100, end=100)

    # 清空默认段落
    cell.text = ""
    first = True
    for line in code_lines:
        if first:
            p = cell.paragraphs[0]
            first = False
        else:
            p = cell.add_paragraph()

        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
        p.paragraph_format.line_spacing = Pt(font_size.pt * 1.25)

        content = line if line.strip() else " "
        run = p.add_run(content)
        # 代码块统一用 Consolas；中文交给 eastAsia 字体
        set_run_font(run, FONT_CN_BODY if has_cn else FONT_CODE,
                     FONT_CODE, font_size, False, COLOR_CODE_TEXT)

    # 代码块后留白
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.space_before = Pt(0)
    for r in spacer.runs:
        r.font.size = Pt(4)
    spacer.add_run("").font.size = Pt(4)
    return table


def add_table(doc, rows):
    """Markdown 表格 → Word 表格"""
    # rows: list of list[str]
    if not rows:
        return None

    n_cols = max(len(r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=n_cols)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # 根据列数决定字号
    if n_cols <= 3:
        fs = Pt(10)
    elif n_cols <= 5:
        fs = Pt(9)
    elif n_cols <= 7:
        fs = Pt(8)
    else:
        fs = Pt(7.5)

    for i, row in enumerate(rows):
        for j in range(n_cols):
            cell = table.cell(i, j)
            set_cell_margins(cell, top=40, start=80, bottom=40, end=80)
            text = row[j] if j < len(row) else ""

            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.line_spacing = 1.15

            if i == 0:
                shade_cell(cell, TABLE_HEADER_SHADING)
                add_inline_text(p, text, cn_font=FONT_CN_TITLE,
                                en_font=FONT_EN, size=fs, base_bold=True)
            else:
                add_inline_text(p, text, size=fs)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(2)
    spacer.paragraph_format.space_before = Pt(0)
    spacer.add_run("").font.size = Pt(4)
    return table


# ============================================================
# 文档级设置
# ============================================================
def setup_document(doc):
    """页面与默认样式"""
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)      # A4 宽
    sec.page_height = Cm(29.7)     # A4 高
    sec.left_margin = Cm(2.6)
    sec.right_margin = Cm(2.6)
    sec.top_margin = Cm(2.4)
    sec.bottom_margin = Cm(2.4)

    # 默认样式
    style = doc.styles['Normal']
    style.font.name = FONT_EN
    style.font.size = Pt(10.5)
    style.element.rPr.rFonts.set(qn('w:eastAsia'), FONT_CN_BODY)


def add_page_footer(doc):
    """页脚加页码"""
    section = doc.sections[0]
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    run = p.add_run()
    set_run_font(run, FONT_CN_BODY, FONT_EN, Pt(9))
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'PAGE'
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)


# ============================================================
# 主解析循环
# ============================================================
def parse_table_row(line):
    """解析一行 Markdown 表格：| a | b | -> ['a', 'b']"""
    s = line.strip()
    if s.startswith('|'):
        s = s[1:]
    if s.endswith('|'):
        s = s[:-1]
    # 用 | 分割，但避开 \| 转义
    parts = re.split(r'(?<!\\)\|', s)
    return [p.strip().replace('\\|', '|') for p in parts]


def is_table_separator(line):
    return bool(re.match(r'^\|[\s:\-|]+\|\s*$', line.strip()))


def main():
    with io.open(SRC, encoding="utf-8") as f:
        lines = f.read().split("\n")

    doc = Document()
    setup_document(doc)
    add_page_footer(doc)

    i = 0
    n = len(lines)
    stats = {"heading": 0, "para": 0, "code": 0, "table": 0, "quote": 0, "list": 0}

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # ---------- 代码块 ----------
        if stripped.startswith("```"):
            i += 1
            code_lines = []
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # 跳过结束的 ```
            add_code_block(doc, code_lines)
            stats["code"] += 1
            continue

        # ---------- 表格 ----------
        if stripped.startswith("|") and i + 1 < n and is_table_separator(lines[i + 1]):
            rows = [parse_table_row(line)]
            i += 2  # 跳过分隔行
            while i < n and lines[i].strip().startswith("|"):
                rows.append(parse_table_row(lines[i]))
                i += 1
            add_table(doc, rows)
            stats["table"] += 1
            continue

        # ---------- 标题 ----------
        m = re.match(r'^(#{1,4})\s+(.*)$', line)
        if m:
            level = len(m.group(1))
            add_heading(doc, m.group(2).strip(), level)
            stats["heading"] += 1
            i += 1
            continue

        # ---------- 分隔线 ----------
        if re.match(r'^---+$', stripped):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run("─" * 46)
            set_run_font(run, FONT_CN_BODY, FONT_EN, Pt(8), False,
                         RGBColor(0xC0, 0xC0, 0xC0))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            i += 1
            continue

        # ---------- 引用 ----------
        if stripped.startswith(">"):
            # 连续的引用行合并
            while i < n and lines[i].strip().startswith(">"):
                add_quote(doc, lines[i].strip())
                stats["quote"] += 1
                i += 1
            continue

        # ---------- 列表 ----------
        if re.match(r'^[-*]\s+', stripped) or re.match(r'^\d+\.\s+', stripped):
            ordered = bool(re.match(r'^\d+\.\s+', stripped))
            indent = len(line) - len(line.lstrip())
            add_list_item(doc, stripped, ordered, min(indent // 2, 2))
            stats["list"] += 1
            i += 1
            continue

        # ---------- 空行 ----------
        if not stripped:
            i += 1
            continue

        # ---------- 普通段落 ----------
        add_paragraph(doc, stripped)
        stats["para"] += 1
        i += 1

    doc.save(DST)

    print("=" * 58)
    print("转换完成")
    print("=" * 58)
    for k, v in stats.items():
        print(f"  {k:<10} {v}")
    print(f"\n  输出文件: {DST}")
    return stats


if __name__ == "__main__":
    main()
