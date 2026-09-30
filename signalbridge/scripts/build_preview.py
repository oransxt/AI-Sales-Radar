import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
adapter=r'''
const localSeed=__SEED__;
const storeKey='signalbridge-v22-knowledge-demo';let localState;
function localInit(){try{localState=JSON.parse(localStorage.getItem(storeKey));}catch{}if(localState)return;
localState={context:{now:'2026-09-30',config:localSeed.config,accounts:localSeed.accounts,media:localSeed.media,credentials:[]},deals:[],deliveries:[],demo:true,last_run:''};
const kinds=['RESEARCH','CASE_STUDY','INDUSTRY_OVERVIEW'];
for(let i=0;i<4;i++)localState.context.credentials.push({id:'DEMO-C'+i,file_name:'demo-file-'+i+'.pdf',kind:kinds[i%3],status:'READY',drive_url:'https://drive.google.com/file/d/DEMO_NOT_REAL_'+i+'/view',modified_at:'2026-09-30T01:00:00Z',summary_th:'ข้อมูลทดสอบเกี่ยวกับพฤติกรรมผู้บริโภคและความเชื่อมั่นต่อแบรนด์ ไม่ใช่เอกสารลูกค้าจริง',summary_en:'Demo perspectives on consumer behaviour and brand confidence; not a real client document',topic:'DEMO_TOPIC_'+i,title_th:['งานวิจัย: พฤติกรรมผู้บริโภคและความเชื่อมั่นต่อแบรนด์','กรณีศึกษา: สื่อใกล้จุดขายเพื่อสนับสนุนสาขาใหม่','ภาพรวมอุตสาหกรรม: จุดสัมผัสของผู้บริโภค','กรณีศึกษา: เปิดตัวสินค้าผ่าน OOH'][i],title_en:['Research: Consumer behaviour and brand confidence','Case study: OOH around new stores','Industry overview: Consumer touchpoints','Case study: Product launches through OOH'][i],tags:'LAUNCH|EXPANSION|FOOTFALL|AWARENESS|FINANCE|RETAIL',readers:'anyone'});
const headlines=['เปิดตัวผลิตภัณฑ์ใหม่ — DEMO ไม่ใช่ข่าวจริง','ขยายสาขาใหม่ — DEMO ไม่ใช่ข่าวจริง','แคมเปญใหม่ — DEMO ไม่ใช่ข่าวจริง'];
localState.context.accounts.slice(0,3).forEach((a,i)=>{a.customer_type=i===1?'EXISTING':i===2?'UNKNOWN':'PROSPECT';a.contact_email='demo@example.com';a.industry=i===1?'RETAIL':'FINANCE';const d=RevenueCore.build({id:'DEMO-'+i,account_id:a.id,title:a.brand+' '+headlines[i],source_url:'https://example.com/demo-news-'+i,publisher:'DEMO SOURCE',published_at:'2026-09-30'},localState.context);localState.deals.push(d);});localPersist();}
function localPersist(){try{localStorage.setItem(storeKey,JSON.stringify(localState));}catch{}}
function localCall(method,...args){localInit();if(method==='getReviewBundle')return JSON.parse(JSON.stringify(localState));let [id,version,patch]=args,d=localState.deals.find(d=>d.id===id);if(!d||d.version!==Number(version))throw Error('ข้อมูลเปลี่ยนแล้ว');if(method==='saveReview'){if(d.state==='DRAFTED')throw Error('สร้าง Draft แล้ว');Object.assign(d,patch);d.category=RevenueCore.classify(localState.context.accounts.find(a=>a.id===d.account_id));d.version++;d.state='REVIEW';}else if(method==='approveDraft'){if(d.state==='REJECTED')throw Error('ต้องแก้และตรวจใหม่');const v=RevenueCore.validate(d,localState.context);if(!v.ok)throw Error(v.errors.join('\n'));if(d.state!=='DRAFTED'){const out=RevenueCore.emailOutput(d,localState.context),subject=btoa(unescape(encodeURIComponent(out.subject))),body=btoa(unescape(encodeURIComponent(out.html))).match(/.{1,76}/g).join('\r\n');downloadText(d.id+'-'+d.language+'.eml','To: '+d.email_to+'\r\nSubject: =?UTF-8?B?'+subject+'?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+body,'message/rfc822');d.state='DRAFTED';}localPersist();return {draft_id:'DEMO_ONLY',bundle:JSON.parse(JSON.stringify(localState))};}else if(method==='rejectSignal'){d.state='REJECTED';d.version++;}else throw Error('ไม่รองรับ');localPersist();return JSON.parse(JSON.stringify(localState));}
'''
seed=json.loads((root/'data/seed.json').read_text());review=(root/'apps-script/Review.html').read_text();core=(root/'apps-script/Core.gs').read_text()
if '/* CORE_START */' in review: review=re.sub(r'/\* CORE_START \*/[\s\S]*?/\* CORE_END \*/',lambda m:'/* CORE_START */\n'+core+'\n/* CORE_END */',review)
else: review=review.replace('// OFFLINE_CORE','/* CORE_START */\n'+core+'\n/* CORE_END */')
fontcss='body{font-family:Arial,Tahoma,sans-serif}'
review=re.sub(r'<style id="font-style">[\s\S]*?</style>', '', review)
review=review.replace('<style>', '<style id="font-style">'+fontcss+'</style><style>',1).replace('Arial,Tahoma,sans-serif','Arial,Tahoma,sans-serif')
(root/'apps-script/Review.html').write_text(review)
# Browser and server use the same pure engine; it is not a client-side trust boundary.
preview=review.replace('// OFFLINE_CORE',(root/'apps-script/Core.gs').read_text()).replace('// OFFLINE_ADAPTER',adapter.replace('__SEED__',json.dumps(seed,ensure_ascii=False).replace('</','<\\/')))
(root/'Preview.html').write_text(preview)
print('Built Preview.html and synchronized Review.html')
