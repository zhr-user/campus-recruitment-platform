# -*- coding: utf-8 -*-
r'''第二轮补漏：patch_project_plan2.py 的 sub 分支用陈旧 text 重建 lines，
把两条 line 模式替换冲掉了（脚本误报 4 条成功）。本脚本只补这两条整行替换。

教训：混用 line/sub 两种模式时，必须以唯一一份 lines 为真源，
sub 也要落到 lines[i] 上，绝不能中途用 text 重建 lines。

实测依据见 data/raw/_verify_report.txt：
  数据集 A cleaned_all.csv 24,185 行：description 取值 '[]' 的 2,085 条 = 8.6%；
    长度 均值 456 / 中位 410 / P90 759 / 最长 9,754；另有 874 条(4.0%)短于 50 字
  数据集 B job_posting_data_B.xlsx 10,114 行：description 仅 5 条为空；
    中位 286 字，最长 5,687 字
'''
import io
import os
import sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(WS, 'docs', '项目计划书.md')

# (说明, 需要被替换的整行原文, 替换后的整行)
E = [
    ('2.4 互补关系表：JD 文本一行',
     '| JD 文本 | 有（100% 非空） | 有（平均 348 字，更丰富） |',
     '| JD 文本 | 有，但 **2,085 条（8.6%）的 `description` 是空 `[]`**；有正文的均值 456 字、中位 410 字、最长 9,754 字 | 有，10,114 条中仅 5 条为空；中位 286 字、最长 5,687 字 |'),

    ('2.4 数据集 A 特性表：description 缺失率与长度',
     '| `description` | 0.05% | JD 正文，平均 348 字 |',
     '| `description` | **8.6%**（2,085 条取值为 `[]`，即无正文） | JD 正文，均值 **456** 字 / 中位 **410** 字 / P90 759 字 / 最长 **9,754** 字；另有 874 条（4.0%）短于 50 字 |'),
]


def main():
    with io.open(PATH, encoding='utf-8', newline='') as f:
        text = f.read()
    lines = text.splitlines(keepends=True)

    # 先确认上一轮已落盘的两条 sub 确实在
    done = {
        '1.1 JD 长度数字': 'JD 正文均值 456 字、中位 410 字、最长 9,754 字',
        '7.x 余弦相似度长度区间': '实测数据集 A 的 JD 正文从 5 字到 9,754 字',
    }
    for k, v in done.items():
        print('前置确认 %-22s %s' % (k, '已在稿中' if v in text else '!! 缺失'))

    applied, failed = [], []
    for desc, old, new in E:
        hits = [i for i, ln in enumerate(lines) if ln.rstrip('\r\n') == old]
        if len(hits) != 1:
            failed.append((desc, len(hits)))
            continue
        i = hits[0]
        eol = '\r\n' if lines[i].endswith('\r\n') else '\n'
        lines[i] = new + eol
        applied.append(desc)

    if failed:
        print('!! 未匹配（需恰好 1 次），已中止，未写入：')
        for desc, cnt in failed:
            print('   %s -> 匹配 %d 次' % (desc, cnt))
        return 1

    out = ''.join(lines)
    with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('补漏 %d 条替换成功：' % len(applied))
    for d in applied:
        print('  - %s' % d)
    print('CRLF=%d 裸LF=%d 行数=%d 字符=%d' % (
        out.count('\r\n'), out.count('\n') - out.count('\r\n'),
        len(out.splitlines()), len(out)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
