from pathlib import Path

p = Path('server.js')
t = p.read_text(encoding='utf-8')
marker = 'const port = process.env.PORT || 3000;'
insert = 'require("./erp-publish-bridge").mount(app);\n\n'
if insert.strip() not in t:
    if marker not in t:
        raise SystemExit('server.js port marker not found')
    t = t.replace(marker, insert + marker, 1)
p.write_text(t, encoding='utf-8')
print('mounted erp-publish-bridge in server.js')
