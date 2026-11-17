# -*- coding: utf-8 -*-
r'''第三轮修补：13.4 答辩话术被整行替换时误删了 ① 和 ③。

原因：第一轮 patch 里这条用的是"整行替换"，我给的替换文本只写了 ②，
于是原话术里 ① 标签一致性、③ 薪资自洽性 两个要点连带外层引号一起丢了。

本脚本从原稿备份 .bak 取回原始整行，只对 ① 和 ② 两处做定点子串替换，
外层引号与 ③ 原样保留。'''
import io
import os
import sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(WS, 'docs')
CUR = os.path.join(DOCS, '项目计划书.md')
BAK = os.path.join(DOCS, '项目计划书.md.bak')

BROKEN = '② 少数外企 JD 尾部混入了企业法务样板文（实测 53 条，占 0.5%，在这些 JD 里占全文约 46%），会污染技能抽取，所以我写了剥离逻辑。'

SUB = [
    ('① 标签一致性数字',
     '① 数据集自带的岗位分类标签，与 JD 正文的一致性最低只有 **43.8%**（算法岗）',
     '① 数据集自带的岗位分类标签，与 JD 正文的一致性最低只有 **43.3%**（算法岗，按自有判定规则实测）'),
    ('② 样板文数字与表述',
     '② JD 尾部混入了企业法务样板文，占全文约 60%，会污染技能抽取，所以我写了剥离逻辑。',
     '② 少数外企 JD 尾部混入了企业法务样板文，实测只有 53 条（占数据集 B 的 0.5%），但在这些 JD 里占全文约 46%，会污染技能抽取，所以我写了剥离逻辑。'),
]

CURLY = {0x201C: '"', 0x201D: '"', 0x2018: "'", 0x2019: "'"}


def main():
    with io.open(BAK, encoding='utf-8', newline='') as f:
        bak = f.read().splitlines()
    origs = [ln for ln in bak if '我对数据集做了' in ln]
    if len(origs) != 1:
        print('!! 在 .bak 中匹配到 %d 行原话术，中止' % len(origs))
        return 1
    orig = origs[0]
    if not orig.startswith('> "'):
        print('!! 原话术行不以  > "  开头，中止：%r' % orig[:40])
        return 1

    new = orig
    for desc, old, rep in SUB:
        if new.count(old) != 1:
            print('!! 子串 %s 在原行中匹配 %d 次，中止' % (desc, new.count(old)))
            return 1
        new = new.replace(old, rep, 1)
    new = new.translate(CURLY)

    with io.open(CUR, encoding='utf-8', newline='') as f:
        text = f.read()
    lines = text.splitlines(keepends=True)

    hits = [i for i, ln in enumerate(lines) if ln.rstrip('\r\n') == BROKEN]
    if len(hits) != 1:
        print('!! 残缺行匹配 %d 次，中止' % len(hits))
        return 1
    i = hits[0]
    eol = '\r\n' if lines[i].endswith('\r\n') else '\n'
    lines[i] = new + eol

    out = ''.join(lines)
    with io.open(CUR, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('已修复 13.4 话术（行 %d）' % (i + 1))
    print('  新内容：%s' % new)
    print('CRLF=%d 裸LF=%d 行数=%d 字符=%d' % (
        out.count('\r\n'), out.count('\n') - out.count('\r\n'),
        len(out.splitlines()), len(out)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
