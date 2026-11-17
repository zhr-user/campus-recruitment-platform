# -*- coding: utf-8 -*-
"""Extract a .docx into ordered plain text + print a heading outline."""
import sys, os, io, json
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SRC = r"C:\Users\gooden\campus-recruit-platform\docs\校招信息聚合与智能推荐平台-项目计划书.docx"
OUTDIR = r"D:\校招信息聚合与智能推荐平台项目\docs_extract"
os.makedirs(OUTDIR, exist_ok=True)
OUT = os.path.join(OUTDIR, "项目计划书_docx.txt")
OUTLINE = os.path.join(OUTDIR, "outline.txt")

doc = Document(SRC)

def iter_block_items(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

lines = []
outline = []
n_par = n_tbl = n_heading = n_chars = 0
for item in iter_block_items(doc):
    if isinstance(item, Paragraph):
        style = (item.style.name or "")
        text = item.text.rstrip()
        n_par += 1
        n_chars += len(text)
        if text:
            if style.startswith("Heading") or style.startswith("标题") or style == "Title":
                n_heading += 1
                outline.append(f"[{len(lines)}] <{style}> {text}")
                lines.append("")
                lines.append(f"### {text}   <<{style}>>")
            else:
                lines.append(text)
        else:
            lines.append("")
    else:
        n_tbl += 1
        lines.append("")
        lines.append(f"--- TABLE {n_tbl} ({len(item.rows)}x{len(item.columns)}) ---")
        for row in item.rows:
            cells = []
            seen = set()
            for c in row.cells:
                if id(c._tc) in seen:
                    continue
                seen.add(id(c._tc))
                cells.append(" ".join(c.text.split()))
            lines.append(" | ".join(cells))
        lines.append("--- END TABLE ---")
        lines.append("")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
with open(OUTLINE, "w", encoding="utf-8") as f:
    f.write("\n".join(outline))

print(f"paragraphs={n_par} tables={n_tbl} headings={n_heading} chars={n_chars}")
print(f"sections={len(doc.sections)}")
print(f"written: {OUT}")
print(f"outline: {OUTLINE}")
print("=" * 60)
for line in outline:
    print(line)
