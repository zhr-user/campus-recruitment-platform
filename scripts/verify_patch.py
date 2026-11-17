# -*- coding: utf-8 -*-
r'''改稿后检查：打印每处新增/替换内容的前后文，确认没有破坏 Markdown 结构。'''
import io
import os
import re

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(WS, 'docs', '项目计划书.md')
BAK = PATH + '.bak'

with io.open(PATH, encoding='utf-8', newline='') as f:
    new = f.read().splitlines()
with io.open(BAK, encoding='utf-8', newline='') as f:
    old = f.read().splitlines()

ANCHORS = [
    ('1.1 口径前置说明', '数据口径前置说明（实测）'),
    ('2.4 互补关系表', '| 协议 |'),
    ('2.4 缺陷表 A 段', '**来自数据集 A**'),
    ('2.4 新旧分界：跨源约束小节', '跨源合并与数据集定位的实测约束'),
    ('2.4 经验分布后的警告', '但必须正视'),
    ('3.2 THUOCL 用法', 'THUOCL 用法'),
    ('3.2 数据集 A 行', '选定为主力'),
    ('7.x 不用 label 的理由', '**理由（重要）**'),
    ('12.1 风险表第 6 行', '**JD 样板文污染**'),
    ('13.x 口径警告', '口径警告（必须写清'),
    ('13.3 答辩问答：数据量', '**数据量多少？**'),
    ('13.4 答辩话术：样板文', '剥离逻辑'),
    ('附录 数据来源', '数据集 A（主力）'),
]

TOTAL_PIPE_BAD = 0
for label, key in ANCHORS:
    idx = [i for i, l in enumerate(new) if key in l]
    print('=' * 78)
    print('%s   (命中 %d 行, 行号 %s)' % (label, len(idx), [i + 1 for i in idx]))
    for i in idx:
        lo = max(0, i - 2)
        hi = min(len(new), i + 3)
        for j in range(lo, hi):
            mark = '>>' if j == i else '  '
            print('  %s %4d | %s' % (mark, j + 1, new[j][:150]))

# --- Markdown 表格完整性：每张表连续行块的竖线数应一致 ---
print('=' * 78)
print('Markdown 表格结构检查（同一表格内 | 数量应一致）')
bad_tables = []
i = 0
while i < len(new):
    if new[i].lstrip().startswith('|'):
        j = i
        while j < len(new) and new[j].lstrip().startswith('|'):
            j += 1
        block = new[i:j]
        counts = [ln.count('|') for ln in block]
        if len(set(counts)) > 1:
            bad_tables.append((i + 1, j, counts))
        i = j
    else:
        i += 1

if not bad_tables:
    print('  OK：所有表格的竖线数都自洽')
else:
    for a, b, counts in bad_tables:
        print('  !! 行 %d-%d 竖线数不一致: %s' % (a, b, counts))
        for k, ln in enumerate(new[a - 1:b]):
            print('     %4d (%2d) %s' % (a + k, counts[k], ln[:130]))
TOTAL_PIPE_BAD = len(bad_tables)

# --- 行数 / 字符数对比 ---
print('=' * 78)
print('原稿 %d 行 / %d 字符  ->  新稿 %d 行 / %d 字符'
      % (len(old), sum(len(x) for x in old), len(new), sum(len(x) for x in new)))
print('表格结构问题: %d' % TOTAL_PIPE_BAD)
