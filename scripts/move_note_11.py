# -*- coding: utf-8 -*-
r'''把 1.1 节那条「数据口径前置说明」从「三个具体问题：」和列表之间，
移到列表结束之后，避免打断句子与列表的衔接。'''
import io
import os
import sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(WS, 'docs', '项目计划书.md')

NOTE_KEY = '数据口径前置说明（实测）'
LIST_LAST_KEY = '3. **匹配靠感觉**'

with io.open(PATH, encoding='utf-8', newline='') as f:
    lines = f.read().splitlines(keepends=True)

note_idx = [i for i, l in enumerate(lines) if NOTE_KEY in l]
last_idx = [i for i, l in enumerate(lines) if LIST_LAST_KEY in l]
assert len(note_idx) == 1, '找不到唯一的说明行: %r' % note_idx
assert len(last_idx) == 1, '找不到唯一的列表末行: %r' % last_idx

ni = note_idx[0]
li = last_idx[0]
assert ni < li, '说明行本来就在列表之后，无需移动 (note=%d last=%d)' % (ni, li)

note_line = lines[ni]
eol = '\r\n' if note_line.endswith('\r\n') else '\n'

# 1) 抽出说明行，并连同其后的空行一起删掉
del lines[ni]
if lines[ni].strip() == '':
    del lines[ni]

# 删除后重新定位列表末行
last_idx = [i for i, l in enumerate(lines) if LIST_LAST_KEY in l]
assert len(last_idx) == 1, '删除后列表末行不唯一: %r' % last_idx
li = last_idx[0]

# 2) 在列表末行之后插入「空行 + 说明行」
lines.insert(li + 1, '' + eol)
lines.insert(li + 2, note_line if note_line.endswith(eol) else note_line + eol)

text = ''.join(lines)
with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print('说明行已移动到列表之后')
print('  末行位置: %d' % (li + 1))
for i in range(li - 1, li + 4):
    print('  %4d | %s' % (i + 1, lines[i].rstrip()[:110]))
print('CRLF=%d 裸LF=%d' % (text.count('\r\n'), text.count('\n') - text.count('\r\n')))
