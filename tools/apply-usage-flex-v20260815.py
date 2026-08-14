#!/usr/bin/env python3
from __future__ import annotations
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GAO='食用時間可依個人使用習慣與作息時間安排'
DRINK_TIME='飲用時間可依個人使用習慣與作息時間安排'
DRINK30='每日 1-2罐'
DRINK180='每日一包'
GENERAL='使用時間可依個人使用習慣與作息時間安排'
RETIRED_GAO=('每日早上及下午各一小匙','建議早上與下午各一小匙','一般建議早上與下午各一小匙','早晚各一小匙','一天一次一小匙','每日一次一小匙')
RETIRED_DRINK_TIME=('建議白天飲用',)
RETIRED_30=('每日一罐','每日1罐','每日 1 罐','每日1～2罐','每日 1～2罐')


def write(path:Path,text:str)->bool:
    old=path.read_text(encoding='utf-8') if path.exists() else ''
    if text!=old:
        path.write_text(text,encoding='utf-8')
        return True
    return False

def write_json(path:Path,data)->bool:
    return write(path,json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def dedupe(values):
    return list(dict.fromkeys(str(x).strip() for x in values if str(x).strip()))

def clean_usage(pid,usage):
    source=[str(x).strip() for x in usage if str(x).strip()]
    retired=(*RETIRED_GAO,*RETIRED_DRINK_TIME,*RETIRED_30,'避免接近睡前食用','避免接近睡前')
    rest=[x for x in source if not any(r in x for r in retired) and '睡眠受影響' not in x and '口乾' not in x]
    # Remove already-current timing lines before adding them in the correct role/order.
    rest=[x for x in rest if x not in {GAO,DRINK_TIME,GENERAL}]
    if pid=='guilu-gao': return dedupe([GAO,*rest])
    if pid=='guilu-drink-30': return dedupe([DRINK30,DRINK_TIME,*rest])
    if pid=='guilu-drink-180':
        rest=[x for x in rest if x!=DRINK180]
        return dedupe([DRINK180,DRINK_TIME,*rest])
    return dedupe([GENERAL,*rest])

# Current authority used by Render prestart.
auth_path=ROOT/'assets/data/official-products.json'
auth=json.loads(auth_path.read_text(encoding='utf-8'))
auth['version']='20260815-personal-routine-usage-v2'
by={p['id']:p for p in auth['products']}
by['guilu-gao']['usagePrimary']=GAO
by['guilu-drink-30']['usagePrimary']=DRINK30
by['guilu-drink-30']['usageTiming']=DRINK_TIME
by['guilu-drink-180']['usagePrimary']=DRINK180
by['guilu-drink-180']['usageTiming']=DRINK_TIME
rules=[]
for item in auth.get('guardRules',[]):
    value=str(item)
    if any(old in value for old in (*RETIRED_GAO,*RETIRED_DRINK_TIME,*RETIRED_30)):
        continue
    if '180cc飲用份量與時間依個人' in value:
        continue
    rules.append(value)
rules.extend([
    f'龜鹿膏不設定固定早上／下午時段；食用時間可依個人使用習慣與作息時間安排',
    f'龜鹿飲30cc目前使用方式為「{DRINK30}」；{DRINK_TIME}',
    f'龜鹿飲180cc保留目前份量「{DRINK180}」；{DRINK_TIME}',
    '所有產品的使用時間依個人使用習慣與作息時間安排，不以固定時段作為唯一規則',
])
auth['guardRules']=dedupe(rules)
write_json(auth_path,auth)

master_path=ROOT/'line-sales-master.json'
master=json.loads(master_path.read_text(encoding='utf-8'))
master['version']='2026-08-15-personal-routine-usage-v2'
for pid,p in (master.get('products') or {}).items():
    p['usage']=clean_usage(pid,p.get('usage') or [])
write_json(master_path,master)

# Upgrade retired wording before runtime reads data.json; do not alter the 180cc quantity rule.
psm=ROOT/'product-sales-master.js'
s=psm.read_text(encoding='utf-8')
for old in RETIRED_GAO:
    old_re=old.replace('一','一')
# Replace known existing sanitizer entries precisely.
s=s.replace('[/一天一次一小匙/g, "每日早上及下午各一小匙"]',f'[/一天一次一小匙/g, "{GAO}"]')
s=s.replace('[/早晚各一小匙/g, "每日早上及下午各一小匙"]',f'[/早晚各一小匙/g, "{GAO}"]')
s=s.replace('[/一天一次一小匙/g, "食用時間與份量可依個人使用習慣與作息安排"]',f'[/一天一次一小匙/g, "{GAO}"]')
s=s.replace('[/早晚各一小匙/g, "食用時間與份量可依個人使用習慣與作息安排"]',f'[/早晚各一小匙/g, "{GAO}"]')
anchor='const RETIRED_COPY_REPLACEMENTS = Object.freeze([\n'
entries=(
    f'  [/每日早上及下午各一小匙/g, "{GAO}"],\n'
    f'  [/建議白天飲用/g, "{DRINK_TIME}"],\n'
    f'  [/每日一罐/g, "{DRINK30}"],\n'
    f'  [/每日1罐/g, "{DRINK30}"],\n'
    f'  [/每日 1 罐/g, "{DRINK30}"],\n'
    f'  [/每日1～2罐/g, "{DRINK30}"],\n'
    f'  [/每日 1～2罐/g, "{DRINK30}"],\n'
)
if '[/每日早上及下午各一小匙/g' not in s:
    s=s.replace(anchor,anchor+entries)
else:
    for old in ('食用時間與份量可依個人使用習慣與作息安排','可依個人使用習慣與作息時間安排'):
        s=s.replace(f'[/每日早上及下午各一小匙/g, "{old}"]',f'[/每日早上及下午各一小匙/g, "{GAO}"]')
    s=s.replace('[/建議白天飲用/g, "可依個人使用習慣與作息時間飲用"]',f'[/建議白天飲用/g, "{DRINK_TIME}"]')
    s=s.replace('[/每日1～2罐/g, "每日 1-2罐"]',f'[/每日1～2罐/g, "{DRINK30}"]')
# Remove any accidental sanitizer that would replace the valid 180cc daily quantity.
lines=[]
for line in s.splitlines():
    if '/每日一包/g' in line:
        continue
    lines.append(line)
s='\n'.join(lines)+'\n'
write(psm,s)

# Customer-facing runtime/docs: only retire the confirmed old fixed-time phrases.
replacements=[
    *[(x,GAO) for x in RETIRED_GAO],
    ('建議白天飲用',DRINK_TIME),
    ('每日一罐',DRINK30),('每日1罐',DRINK30),('每日 1 罐',DRINK30),
    ('每日1～2罐',DRINK30),('每日 1～2罐',DRINK30),
    ('食用時間與份量可依個人使用習慣與作息安排',GAO),
    ('飲用時間可依個人使用習慣與作息安排',DRINK_TIME),
    ('使用時間可依個人使用習慣與作息安排',GENERAL),
]
for rel in ['server.js','brand-content-runtime.js','README.md','RICH_MENU_SETUP.md','SOCIAL_CONTENT_GUIDE.md']:
    path=ROOT/rel
    if not path.exists(): continue
    text=path.read_text(encoding='utf-8')
    for old,new in replacements:
        text=text.replace(old,new)
    write(path,text)

subprocess.run(['node','tools/sync_sales_master_current.js','--write'],cwd=ROOT,check=True)

data=json.loads((ROOT/'data.json').read_text(encoding='utf-8'))
p={x['id']:x for x in data['products']}
assert p['guilu-drink-30']['usage'][0]==DRINK30
assert DRINK_TIME in p['guilu-drink-30']['usage']
assert p['guilu-drink-180']['usage'][0]==DRINK180
assert DRINK_TIME in p['guilu-drink-180']['usage']
assert p['guilu-gao']['usage'][0]==GAO
blob=json.dumps(data,ensure_ascii=False)
assert '建議白天飲用' not in blob
assert '每日早上及下午各一小匙' not in blob
assert '每日1～2罐' not in blob and '每日 1～2罐' not in blob
print('PASS: LINE current usage authority uses personal timing while preserving product quantities.')
