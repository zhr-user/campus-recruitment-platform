# -*- coding: utf-8 -*-
r'''第二轮改稿：JD 正文长度类数字订正。

实测依据（来自 data/raw/_verify_report.txt）：
  数据集 A cleaned_all.csv 24,185 行
    description 列缺失 0，但取值 '[]'（解析后为空正文）的有 2,085 条 = 8.6%
    长度: 均值 456 字 / 中位 410 字 / P90 759 / 最长 9,754 字 / <50 字 874 条(4.0%)
  数据集 B job_posting_data_B.xlsx 10,114 行
    description 缺失 5 条(0.0%)，中位 286 字，最长 5,687 字
'''
import io
import os
import sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(WS, 'docs', '项目计划书.md')

E = [
    ('sub', '1.1 筛选成本高：JD 长度数字',
     '（本次调研的数据集中，JD 平均长度 348 字，最长 5687 字）',
     '（实测：数据集 A 的 JD 正文均值 456 字、中位 410 字、最长 9,754 字；数据集 B 中位 286 字、最长 5,687 字）'),

    ('line', '2.4 互补关系表：JD 文本一行',
     '| JD 文本 | 有（100% 非空） |',
     '| JD 文本 | 有，但 **2,085 条（8.6%）的 `description` 是空 `[]`**；有正文的均值 456 字、中位 410 字、最长 9,754 字 | 有，10,114 条中仅 5 条为空；中位 286 字、最长 5,687 字 |'),

    ('line', '2.4 数据集 A 特性表：description 缺失率与长度',
     '| `description` | 0.05% |',
     '| `description` | **8.6%**（2,085 条取值为 `[]`，即无正文） | JD 正文，均值 **456** 字 / 中位 **410** 字 / P90 759 字 / 最长 **9,754** 字；另有 874 条（4.0%）短于 50 字 |'),

    ('sub', '7.x 余弦相似度理由：文本长度区间',
     '（348 字到 5687 字）',
     '（实测数据集 A 的 JD 正文从 5 字到 9,754 字）'),
]


def main():
    with io.open(PATH, encoding='utf-8', newline='') as f:
        text = f.read()
    lines = text.splitlines(keepends=True)
    replaced = set()
    failed, applied = [], []

    for mode, desc, key, new in E:
        if mode == 'sub':
            cnt = text.count(key)
            if cnt != 1:
                failed.append((desc, cnt, key[:80]))
                continue
            text = text.replace(key, new, 1)
            lines = text.splitlines(keepends=True)   # sub 后行内容变了，重建
            replaced = set()
            applied.append(desc)
            continue

        hits = [i for i, ln in enumerate(lines) if key in ln and i not in replaced]
        if len(hits) != 1:
            failed.append((desc, len(hits), key[:80]))
            continue
        i = hits[0]
        eol = '\r\n' if lines[i].endswith('\r\n') else '\n'
        lines[i] = new.replace('\r\n', '\n').replace('\n', '\n') + eol
        replaced.add(i)
        applied.append(desc)

    if failed:
        print('!! 未匹配，已中止，未写入')
        for desc, cnt, head in failed:
            print('   %s  -> 实际匹配 %d 次   锚点: %s' % (desc, cnt, head))
        return 1

    text = ''.join(lines)
    with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(text)

    print('第二轮 %d 条替换成功：' % len(applied))
    for d in applied:
        print('  - %s' % d)
    print('CRLF=%d 裸LF=%d 行数=%d' % (
        text.count('\r\n'), text.count('\n') - text.count('\r\n'),
        len(text.splitlines())))
    return 0


if __name__ == '__main__':
    sys.exit(main())
