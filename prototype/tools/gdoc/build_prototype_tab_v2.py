import base64, html, re, sys
from PIL import Image

D = sys.argv[1]  # folder with the _s.jpg images
OUT = sys.argv[2]

ARIAL = "font-family:Arial;font-size:11pt;color:#000000;font-weight:400;font-style:normal"
LATO = "font-family:Lato;font-size:9.5pt;color:#000000;font-weight:400;font-style:normal"
PZERO = "margin-left:0pt;text-indent:0pt"


def inl(s, base=ARIAL):
    """**bold**, *italic*, [text](url), `code`, [[PLACEHOLDER]] -> styled spans."""
    out, i = [], 0
    pat = re.compile(r"\*\*(.+?)\*\*|\[\[(.+?)\]\]|\[(.+?)\]\((.+?)\)|\*(.+?)\*|`(.+?)`")
    for m in pat.finditer(s):
        if m.start() > i:
            out.append(f'<span style="{base}">{html.escape(s[i:m.start()])}</span>')
        if m.group(1):
            out.append(f'<span style="{base.replace("font-weight:400", "font-weight:700")}">{html.escape(m.group(1))}</span>')
        elif m.group(2):
            out.append(f'<span style="{base.replace("font-weight:400", "font-weight:700")};background-color:#fff2cc">[{html.escape(m.group(2))}]</span>')
        elif m.group(3):
            out.append(f'<a href="{html.escape(m.group(4))}"><span style="{base.replace("color:#000000", "color:#1155cc")};text-decoration:underline">{html.escape(m.group(3))}</span></a>')
        elif m.group(5):
            out.append(f'<span style="{base.replace("font-style:normal", "font-style:italic")}">{html.escape(m.group(5))}</span>')
        else:
            out.append(f'<span style="{base.replace("font-family:Arial", "font-family:Courier New")}">{html.escape(m.group(6))}</span>')
        i = m.end()
    if i < len(s):
        out.append(f'<span style="{base}">{html.escape(s[i:])}</span>')
    return ''.join(out)


def H(level, text):
    size, fam, top, bot = {1: ('20pt', 'Arial', '20pt', '6pt'), 2: ('16pt', 'Arial', '18pt', '6pt'), 3: ('13pt', 'Lato', '14pt', '4pt')}[level]
    return f'<h{level} style="margin-top:{top};margin-bottom:{bot};{PZERO};padding-left:0pt"><span style="font-family:{fam};font-size:{size};font-weight:700;color:#000000">{html.escape(text)}</span></h{level}>'


def P(text):
    return f'<p style="margin-top:0pt;margin-bottom:8pt;line-height:1.15;{PZERO}">{inl(text)}</p>'


def UL(items, ordered=False):
    tag = 'ol' if ordered else 'ul'
    return f'<{tag} style="margin-top:0pt;margin-bottom:8pt">' + ''.join(f'<li style="{ARIAL}"><p style="margin-top:0pt;margin-bottom:2pt">{inl(x)}</p></li>' for x in items) + f'</{tag}>'


def TABLE(rows, widths):
    td = 'border:1pt solid #d9d9d9;padding:4pt 5pt;vertical-align:top'
    hd = LATO.replace('color:#000000;font-weight:400', 'color:#ffffff;font-weight:700')
    out = ['<table style="border:none;border-collapse:collapse;margin-left:0pt"><colgroup>' + ''.join(f'<col width="{w}">' for w in widths) + '</colgroup><tbody>']
    for i, r in enumerate(rows):
        out.append('<tr>' + ''.join(
            f'<td style="{td};background-color:{"#23445b" if i == 0 else "#ffffff"}"><p style="margin-top:0pt;margin-bottom:0pt;line-height:1.15">{inl(c, hd if i == 0 else LATO)}</p></td>' for c in r) + '</tr>')
    out.append('</tbody></table><p style="margin-top:0pt;margin-bottom:8pt"></p>')
    return ''.join(out)


def IMG(name, caption):
    path = f'{D}/{name}'
    w, h = Image.open(path).size
    b = base64.b64encode(open(path, 'rb').read()).decode()
    small = ARIAL.replace('font-size:11pt', 'font-size:9pt').replace('color:#000000', 'color:#666666')
    return (f'<p style="margin-top:4pt;margin-bottom:0pt;{PZERO}"><img src="data:image/jpeg;base64,{b}" width="624" height="{round(624 * h / w)}" alt="{html.escape(caption[:60])}"></p>'
            f'<p style="margin-top:2pt;margin-bottom:10pt;{PZERO}">{inl(caption, small)}</p>')


# Product Prototype v2 tab: python build_prototype_tab_v2.py <image folder> <out.html>
sys.path.insert(0, __import__("os").path.dirname(__file__))
from prototype_tab_v2_content import build
parts = build(H, P, UL, TABLE, IMG)
body = '<b style="font-weight:normal" id="docs-internal-guid-proto2">' + ''.join(parts) + '</b>'
open(OUT, 'w', encoding='utf-8').write(body)
print(len(body), body.count('<img'), body.count('<table'))
