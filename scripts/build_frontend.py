"""将前端源文件打包为由本地后端提供的 index.html。

Sources:
  frontend/src/shell.html
  frontend/src/css/*.css
  frontend/src/js/*.js
  frontend/src/demo-data.json

Output:
  frontend/index.html
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"
OUT = ROOT / "frontend" / "index.html"

CSS_ORDER = [
    "00-base.css",
    "10-layout.css",
    "20-components.css",
    "30-pages.css",
    "40-responsive.css",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> None:
    shell = read(SRC / "shell.html")

    css_parts = []
    for name in CSS_ORDER:
        path = SRC / "css" / name
        if not path.exists():
            raise SystemExit(f"缺少样式文件： {path}")
        css_parts.append(f"/* ==== {name} ==== */\n{read(path)}")
    css = "\n".join(css_parts)

    js_files = sorted((SRC / "js").glob("*.js"))
    if not js_files:
        raise SystemExit("未找到前端脚本")
    js_parts = [f"/* ==== {p.name} ==== */\n{read(p)}" for p in js_files]
    js = "\n".join(js_parts)
    # One shared lexical scope for all page modules. 00-core.js deliberately has
    # no IIFE of its own; this wrapper keeps the globals private but shared.
    js = "(function () {\n'use strict';\n" + js + "\n})();\n"

    data = read(SRC / "demo-data.json")
    # Keep the inline JSON script from terminating early.
    data = data.replace("</", "<\\/")

    html = shell.replace("/*__INJECT_CSS__*/", css)
    html = html.replace("/*__INJECT_JS__*/", js)
    html = html.replace("__INJECT_DATA__", data)

    if "__INJECT_" in html:
        raise SystemExit("构建占位符未完全替换")

    OUT.write_text(html, encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"built {OUT} ({size_kb:.1f} KB)")
    print(f"  css {len(css) / 1024:.1f} KB | js {len(js) / 1024:.1f} KB | data {len(data) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
