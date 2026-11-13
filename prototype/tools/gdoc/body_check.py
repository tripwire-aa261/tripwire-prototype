import re, sys
src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()
h = re.sub(r'^.*?<body[^>]*>', '', h, flags=re.S).replace('</body>', '')
open(out, 'w', encoding='utf-8').write(h)
t = re.sub(r'<[^>]+>', '', re.sub(r'<img[^>]*>', '', h))
print(len(h), h.count('<img'), h.count('<table'), t.count('$'))
# Google Docs turns "$... ($" into a formula: list any such spans
for m in re.finditer(r'\$[^$]{0,120}\(\$', t):
    print('RISK:', m.group(0)[:100])
