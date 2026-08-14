#!/usr/bin/env python3
from __future__ import annotations
import json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GAO='食用時間與份量可依個人使用習慣與作息安排'
DRINK_TIME='飲用時間可依個人使用習慣與作息安排'
DRINK30='每日 1-2罐'
DRINK180='飲用份量與時間可依個人使用習慣與作息安排'
GENERAL='使用時間可依個人使用習慣與作息安排'
OLD_GAO='可依個人使用習慣與作息時間安排'
OLD_DAY='可依個人使用習慣與作息時間飲用'

def write(path,text):
 old=path.read_text(encoding='utf-8') if path.exists() else ''
 if text!=old:path.write_text(text,encoding='utf-8');return True
 return False

def write_json(path,data):return write(path,json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def de_dupe(seq):return list(dict.fromkeys([str(x) for x in seq if str(x).strip()]))

def clean_usage(pid,usage):
 usage=[str(x) for x in usage if str(x).strip()]
 retired=(OLD_GAO,'一天一次一小匙','早晚各一小匙',OLD_DAY,'每日 1-2罐','每日 1-2罐','每日 1-2罐','每日一包','避免接近睡前')
 rest=[x for x in usage if not any(r in x for r in retired) and '睡眠受影響' not in x and '口乾' not in x]
 if pid=='guilu-gao':return de_dupe([GAO,*rest])
 if pid=='guilu-drink-30':return de_dupe([DRINK30,DRINK_TIME,*rest])
 if pid=='guilu-drink-180':return de_dupe([DRINK180,*rest])
 return de_dupe([GENERAL,*rest])

# Current authority is the source Render prestart reads before data.json.
auth_path=ROOT/'assets/data/official-products.json'
auth=json.loads(auth_path.read_text(encoding='utf-8'))
auth['version']='20260815-personal-routine-usage-v1'
by={p['id']:p for p in auth['products']}
by['guilu-gao']['usagePrimary']=GAO
by['guilu-drink-30']['usagePrimary']=f'{DRINK30}；{DRINK_TIME}'
by['guilu-drink-180']['usagePrimary']=DRINK180
rules=[str(x) for x in auth.get('guardRules',[]) if OLD_GAO not in str(x) and OLD_DAY not in str(x) and '一天一次' not in str(x) and '早晚各一小匙' not in str(x) and '每日 1-2罐' not in str(x) and '每日一包' not in str(x)]
rules.extend([
 f'龜鹿膏目前使用原則為「{GAO}」，不設定固定早上／下午時段',
 f'龜鹿飲30cc目前使用方式為「{DRINK30}」，且{DRINK_TIME}',
 '龜鹿飲不設定固定白天時段；180cc飲用份量與時間依個人使用習慣與作息安排',
 '所有產品使用時間依個人使用習慣與作息安排，不以固定時段作為唯一規則',
])
auth['guardRules']=de_dupe(rules)
write_json(auth_path,auth)

master_path=ROOT/'line-sales-master.json'
master=json.loads(master_path.read_text(encoding='utf-8'))
master['version']='2026-08-15-personal-routine-usage-v1'
for pid,p in (master.get('products') or {}).items():p['usage']=clean_usage(pid,p.get('usage') or [])
write_json(master_path,master)

# Sanitizer must upgrade all retired fixed-time copy to the new current principle.
psm=ROOT/'product-sales-master.js';s=psm.read_text(encoding='utf-8')
s=s.replace('[/一天一次一小匙/g, "可依個人使用習慣與作息時間安排"]',f'[/一天一次一小匙/g, "{GAO}"]')
s=s.replace('[/早晚各一小匙/g, "可依個人使用習慣與作息時間安排"]',f'[/早晚各一小匙/g, "{GAO}"]')
anchor='const RETIRED_COPY_REPLACEMENTS = Object.freeze([\n'
extra=(f'  [/{OLD_GAO}/g, "{GAO}"],\n'
       f'  [/{OLD_DAY}/g, "{DRINK_TIME}"],\n'
       f'  [/每日 1-2罐/g, "{DRINK30}"],\n'
       f'  [/每日一包/g, "{DRINK180}"],\n')
if f'[/{OLD_GAO}/g, "{GAO}"]' not in s:s=s.replace(anchor,anchor+extra)
write(psm,s)

# Current customer-facing runtime/docs, excluding tests so failures expose any stale test contract.
repls=[(OLD_GAO,GAO),('可依個人使用習慣與作息時間安排',GAO),('早上與下午各一小匙',GAO),(OLD_DAY,DRINK_TIME),('每日 1-2罐',DRINK30),('每日 1-2罐',DRINK30),('每日 1-2罐',DRINK30),('每日一包',DRINK180),('可依個人使用習慣與作息時間安排',GAO),('避免接近睡前',GAO)]
for rel in ['server.js','brand-content-runtime.js','README.md','RICH_MENU_SETUP.md','SOCIAL_CONTENT_GUIDE.md']:
 path=ROOT/rel
 if not path.exists():continue
 text=path.read_text(encoding='utf-8')
 for old,new in repls:text=text.replace(old,new)
 write(path,text)

# Rebuild data.json from current authority and current sales master.
subprocess.run(['node','tools/sync_sales_master_current.js','--write'],cwd=ROOT,check=True)

# Assert current runtime data before tests.
data=json.loads((ROOT/'data.json').read_text(encoding='utf-8'))
p={x['id']:x for x in data['products']}
assert p['guilu-drink-30']['usage'][0]==DRINK30
assert DRINK_TIME in p['guilu-drink-30']['usage']
assert p['guilu-drink-180']['usage'][0]==DRINK180
assert p['guilu-gao']['usage'][0]==GAO
blob=json.dumps(data,ensure_ascii=False)
assert OLD_GAO not in blob and OLD_DAY not in blob and '每日 1-2罐' not in blob and '每日一包' not in blob
print('PASS: LINE current usage authority updated before test suite.')
