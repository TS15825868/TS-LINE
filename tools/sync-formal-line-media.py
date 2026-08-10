from __future__ import annotations
import json,re,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUBLIC='https://ts15825868.github.io/xianjiawei'
DM={
 '龜鹿膏':PUBLIC+'/images/formal-display/dm-guilu-gao.jpg',
 '龜鹿飲30cc':PUBLIC+'/images/formal-display/dm-guilu-drink-30.jpg',
 '龜鹿飲180cc':PUBLIC+'/images/formal-display/dm-guilu-drink-180.jpg',
 '龜鹿湯塊':PUBLIC+'/images/formal-display/dm-guilu-tangkuai.jpg',
 '龜鹿膠':PUBLIC+'/images/formal-display/dm-guilu-jiao.jpg',
 '鹿茸粉':PUBLIC+'/images/formal-display/dm-lurong-fen.jpg',
}
SPECS={
 '龜鹿膏':'100g／罐','龜鹿飲30cc':'30cc／罐（小玻璃罐、裸罐、無貼紙）','龜鹿飲180cc':'180cc／包（鋁袋）',
 '龜鹿湯塊':'75g／盒｜8塊裝','龜鹿膠':'600g／盒｜32塊裝','鹿茸粉':'75g／罐'}

def trial_url():
 for ext in ('png','jpg','webp','jpeg'):
  u=f'{PUBLIC}/images/formal-display/trial-guilu-drink.{ext}'
  try:
   req=urllib.request.Request(u,method='HEAD',headers={'User-Agent':'xianjiawei-sync'})
   with urllib.request.urlopen(req,timeout=8) as r:
    if 200<=r.status<400:return u
  except Exception:pass
 return PUBLIC+'/images/formal-display/manifest.json'
TRIAL=trial_url()

REPL={
 '30cc／瓶（玻璃瓶）':'30cc／罐（小玻璃罐、裸罐、無貼紙）',
 '30cc／瓶':'30cc／罐（小玻璃罐、裸罐、無貼紙）',
 '早上及下午各一匙':'一天一次一小匙（初次半匙）',
 '早晚各一匙':'一天一次一小匙（初次半匙）',
}

def norm_string(s:str)->str:
 for a,b in REPL.items():s=s.replace(a,b)
 return s

def obj_text(x)->str:
 try:return json.dumps(x,ensure_ascii=False)
 except:return str(x)

def walk(x):
 if isinstance(x,list):return [walk(v) for v in x]
 if not isinstance(x,dict):return norm_string(x) if isinstance(x,str) else x
 y={k:walk(v) for k,v in x.items()}
 text=obj_text(y)
 # 規格欄只在能辨識產品時校正，不以 DM 覆蓋產品原圖權威欄位。
 for product,spec in SPECS.items():
  if product in text:
   for k,v in list(y.items()):
    kl=k.lower()
    if isinstance(v,str) and any(t in kl for t in ('spec','size','規格','容量')):y[k]=spec
   if any(t in text for t in ('DM','dm','圖卡','產品介紹')):
    for k,v in list(y.items()):
     kl=k.lower(); sv=str(v).lower()
     if isinstance(v,str) and any(t in kl for t in ('dm_image','card_image','display_image','reply_image')):y[k]=DM[product]
     elif isinstance(v,str) and any(t in sv for t in ('/dm-','/dm/','dm-final')) and any(t in kl for t in ('image','picture','url')):y[k]=DM[product]
 # 試喝正式口徑與顧客顯示圖。
 if '試喝' in text:
  for k,v in list(y.items()):
   kl=k.lower()
   if isinstance(v,str) and any(t in kl for t in ('trial_image','sample_image','reply_image','card_image','display_image')):y[k]=TRIAL
  y.setdefault('formal_trial_rules',{
   'free_samples':3,'shipping':'運費自付','7-11':'60元','郵局宅配':'100元','limit':'每位顧客／電話／地址限申請一次',
   'lead_time':'約5～7個工作天','apply_via':'LINE OA','30cc':'60元／罐；買10送1，11罐600元','180cc':'200元／包；買10送1，11包2,000元'})
 return y

master=ROOT/'line-sales-master.json'
if master.exists():
 data=json.loads(master.read_text('utf-8'))
 data=walk(data)
 # 額外提供正式顧客顯示層，不覆蓋 products-v3 原圖欄位。
 if isinstance(data,dict):
  data['formal_customer_media']={'runtime':'20260810-formal-line-media','dm_images':DM,'trial_image':TRIAL,'product_specs':SPECS,
   'authority_note':'產品原圖權威維持 products-v3；DM／試喝只屬顧客顯示層'}
 master.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf-8')

# 所有正式文字檔只清除已知退役用詞；不改版本號、不刪功能。
for p in ROOT.rglob('*'):
 if not p.is_file() or p.suffix.lower() not in {'.js','.mjs','.json','.md','.html'}:continue
 if any(part in {'.git','node_modules'} for part in p.parts):continue
 if p==master:continue
 try:text=p.read_text('utf-8')
 except:continue
 new=norm_string(text)
 if new!=text:p.write_text(new,'utf-8')

(ROOT/'formal-line-media.json').write_text(json.dumps({
 'runtime':'20260810-formal-line-media','dm_images':DM,'trial_image':TRIAL,'specs':SPECS,
 'trial_rules':{'3罐試喝品':'免費','運費':'自付','7-11店到店':'60元','郵局宅配':'100元','限制':'每位顧客／電話／地址限申請一次','交期':'約5～7個工作天','30cc':'60元／罐；買10送1，11罐600元','180cc':'200元／包；買10送1，11包2,000元'},
 'guard':'validate capabilities/current data; never pin legacy version strings or legacy exact copy'},ensure_ascii=False,indent=2)+'\n','utf-8')
print('LINE formal media and sales copy synchronized')
