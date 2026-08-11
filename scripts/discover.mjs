import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const DAILY_OUT = new URL('../docs/data/daily.json', import.meta.url);
const HISTORY_OUT = new URL('../docs/data/history.json', import.meta.url);
const MAX_AGE_DAYS = 120;

const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);

const baseQueries = [
  'ไทย แบรนด์ เปิดตัวสินค้าใหม่',
  'ไทย แบรนด์ เปิดสาขาใหม่',
  'ไทย แบรนด์ แคมเปญใหม่',
  'ไทย แบรนด์ พรีเซนเตอร์ ใหม่',
  'ไทย แบรนด์ รีแบรนด์',
  'ไทย แบรนด์ ขยายสาขา',
  'แบรนด์ต่างประเทศ เข้าไทย เปิดตัว',
  'TikTok Shop ไทย แบรนด์ มาแรง',
  'Instagram แบรนด์ไทย เปิดตัว',
  'แบรนด์ไทย funding ลงทุน ขยายธุรกิจ',
  'ร้านอาหาร แบรนด์ใหม่ เปิดสาขา ไทย',
  'beauty brand Thailand launch',
  'automotive Thailand new launch',
  'property Thailand new project launch',
  'hospital Thailand expansion new branch',
  'ecommerce Thailand campaign launch'
];
const queries = baseQueries.map(q => `${q} when:90d`);

const stopStarts = new Set([
  'ไทย','ประเทศไทย','เปิด','เปิดตัว','เปิดสาขา','ข่าว','ตลาด','ธุรกิจ','บริษัท','แบรนด์','เผย','ล่าสุด','วันนี้','ครั้งแรก',
  'พา','ชวน','เจาะ','ส่อง','จับตา','มาแล้ว','ใหม่','พร้อม','ครั้งใหม่','ประกาศ','เตรียม','เดินหน้า','บุก','ลุย','รุก','เทรนด์'
]);
const genericLatin = new Set([
  'Thailand','Bangkok','EV','AI','CEO','CMO','PR','CSR','ESG','JV','IPO','QSR','OTT','B2B','B2C','FMCG',
  'Meta','Instagram','Facebook','Google','YouTube','LINE','SET','BOI'
]);
const invalidBrandPatterns = [
  /^ศูนย์วิจัย/i,/^สมาคม/i,/^กระทรวง/i,/^กรม/i,/^รัฐบาล/i,/^ตลาด\s/i,/^เทรนด์/i,/^นักวิเคราะห์/i,/^ผู้บริโภค/i,
  /เผย\s/i,/ทุนต่างชาติ/i,/ธุรกิจไทย/i,/ตลาดไทย/i,/อุตสาหกรรม/i
];

const signalRules = [
  {name:'Thailand market entry', re:/(เข้าไทย|บุกไทย|เปิดตัวในไทย|ครั้งแรกในไทย|ตลาดไทย)/i, score:20},
  {name:'Major product launch', re:/(เปิดตัว|launch|สินค้าใหม่|รุ่นใหม่|คอลเลกชันใหม่|เมนูใหม่)/i, score:19},
  {name:'Expansion / new branches', re:/(เปิดสาขา|สาขาใหม่|ขยายสาขา|ขยายธุรกิจ|expansion|เปิดร้าน|โชว์รูมใหม่|โรงงานใหม่)/i, score:18},
  {name:'New presenter / ambassador', re:/(พรีเซนเตอร์|brand ambassador|friend of|ambassador)/i, score:17},
  {name:'New campaign', re:/(แคมเปญ|campaign|mega sale|โปรโมชัน|promotion)/i, score:16},
  {name:'Rebrand', re:/(รีแบรนด์|rebrand|ภาพลักษณ์ใหม่|โลโก้ใหม่)/i, score:15},
  {name:'Funding / investment', re:/(ระดมทุน|funding|investment|ลงทุนเพิ่ม|รับเงินลงทุน)/i, score:14},
  {name:'Partnership', re:/(จับมือ|ร่วมมือ|partnership|collaboration|collab)/i, score:13},
  {name:'Event / sponsorship', re:/(อีเวนต์|event|sponsor|ผู้สนับสนุน|expo|festival)/i, score:12},
  {name:'Social / commerce momentum', re:/(ไวรัล|viral|มาแรง|ยอดขาย|TikTok Shop|ติดเทรนด์|sold out|อินฟลูเอนเซอร์|creator)/i, score:11}
];

const industryRules = [
  ['Automotive',/(รถยนต์|รถไฟฟ้า|\bEV\b|automotive|motor|SUV|pickup|รถจักรยานยนต์)/i],
  ['Property',/(คอนโด|อสังหา|บ้านเดี่ยว|ทาวน์โฮม|property|real estate|โครงการที่อยู่อาศัย)/i],
  ['Hospital / Healthcare',/(โรงพยาบาล|คลินิก|healthcare|hospital|medical|สุขภาพ)/i],
  ['Beauty / Personal Care',/(beauty|skincare|cosmetic|เครื่องสำอาง|สกินแคร์|ความงาม|น้ำหอม)/i],
  ['Food / QSR',/(อาหาร|ร้านอาหาร|คาเฟ่|coffee|restaurant|QSR|ไก่ทอด|เบอร์เกอร์|ชาบู|สุกี้|ขนม|เครื่องดื่ม)/i],
  ['Retail / Fashion',/(แฟชั่น|fashion|เสื้อผ้า|กระเป๋า|รองเท้า|retail|ร้านค้า|ห้าง)/i],
  ['E-Commerce / Platform',/(ecommerce|e-commerce|แพลตฟอร์ม|application|app|delivery|marketplace|TikTok Shop|Shopee|Lazada)/i],
  ['Banking / Finance',/(ธนาคาร|bank|fintech|finance|ประกัน|insurance|สินเชื่อ|wallet|payment)/i],
  ['Travel / Airline',/(airline|สายการบิน|ท่องเที่ยว|travel|hotel|โรงแรม|tourism)/i],
  ['Entertainment',/(streaming|OTT|หนัง|ภาพยนตร์|music|เพลง|concert|เกม|gaming|entertainment)/i],
  ['FMCG',/(FMCG|สินค้าอุปโภค|สินค้าใช้ในบ้าน|detergent|snack|consumer goods)/i],
  ['Technology',/(technology|tech|smartphone|มือถือ|gadget|software|device)/i]
];

function decodeXml(s='') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
}
function sourceInfo(block) {
  const m = block.match(/<source(?:\s+url="([^"]+)")?>([\s\S]*?)<\/source>/i);
  return {url:m?.[1]||'', label:m?decodeXml(m[2]):''};
}
function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{
    const b=m[1];
    return {title:tag(b,'title'), link:tag(b,'link'), description:tag(b,'description'), pubDate:tag(b,'pubDate'), source:sourceInfo(b)};
  });
}
function cleanHeadline(title='') { return title.replace(/\s+-\s+[^-]+$/,'').replace(/\s+/g,' ').trim(); }
function tooOld(dateText) {
  const d=new Date(dateText); if(Number.isNaN(d.getTime())) return false;
  return (now-d)/(1000*60*60*24) > MAX_AGE_DAYS;
}
function isInvalidBrand(name='') {
  const n=name.trim();
  if(!n || n.length<2 || n.length>45 || genericLatin.has(n)) return true;
  return invalidBrandPatterns.some(re=>re.test(n));
}
function candidateBrand(headline) {
  let h=cleanHeadline(headline).replace(/^['“"‘]+|['”"’]+$/g,'').trim();
  h=h.replace(/^แบรนด์\s+/i,'').replace(/^บริษัท\s+/i,'');

  // Prefer proper Latin brand names anywhere in the headline, but reject generic business terms.
  const latinMatches=[...h.matchAll(/\b[A-Z][A-Za-z0-9&.+_-]*(?:\s+[A-Z][A-Za-z0-9&.+_-]*){0,2}\b/g)].map(m=>m[0].trim());
  const latin=latinMatches.find(x=>!genericLatin.has(x) && !/^(The|New|Thai)$/i.test(x));

  // Thai/local names are usually placed before the commercial action verb.
  const signalIndex=h.search(/เปิดตัว|เปิดสาขา|ขยาย|จับมือ|ร่วมมือ|ประกาศ|เปิดร้าน|บุกไทย|รุกไทย|รีแบรนด์|คว้า|ดึง|ส่ง|ลุย|เตรียม|เดินหน้า|ทุ่ม|launch|expansion|campaign/i);
  if(signalIndex>0){
    let prefix=h.slice(0,signalIndex).replace(/[,:;|–—!].*$/,'').trim();
    prefix=prefix.replace(/^(เทรนด์ปีนี้|เทรนด์|ข่าว|แบรนด์|บริษัท)\s*/i,'').trim();
    let words=prefix.split(/\s+/).filter(Boolean);
    while(words.length && stopStarts.has(words[0])) words.shift();
    const thaiCandidate=words.slice(0,4).join(' ').replace(/[“”"'()\[\]]/g,'').trim();
    if(!isInvalidBrand(thaiCandidate) && !/^(ร้านจีน|ห้างกลางเมือง|ทุนต่างชาติ)$/i.test(thaiCandidate)) return thaiCandidate;
  }

  if(latin && !isInvalidBrand(latin)) return latin;

  const quoted=[...h.matchAll(/[“"']([^”"']{2,40})[”"']/g)].map(m=>m[1].trim());
  const q=quoted.find(x=>!isInvalidBrand(x));
  return q||'';
}
function industryFor(text) { for(const [name,re] of industryRules) if(re.test(text)) return name; return 'Consumer / Other'; }
function strongestSignal(text) { let best={name:'Brand activity',score:7}; for(const r of signalRules) if(r.re.test(text)&&r.score>best.score) best=r; return best; }
function thailandScore(text) { let s=8; if(/ไทย|Thailand|Bangkok|กรุงเทพ|ประเทศไทย/i.test(text))s+=6; if(/เปิดสาขา|เปิดร้าน|เข้าไทย|บุกไทย|ตลาดไทย|ในไทย/i.test(text))s+=4; if(/TikTok Shop|Shopee|Lazada|creator|อินฟลูเอนเซอร์/i.test(text))s+=2; return Math.min(20,s); }
function oohFit(industry) { return ['Automotive','Property','Hospital / Healthcare','Beauty / Personal Care','Food / QSR','Retail / Fashion','E-Commerce / Platform','Banking / Finance','Travel / Airline','Entertainment','FMCG'].includes(industry)?14:10; }
function revenuePotential(industry, signalScore) { let base=['Automotive','Property','Banking / Finance','Travel / Airline'].includes(industry)?14:['Beauty / Personal Care','Food / QSR','Retail / Fashion','E-Commerce / Platform','Entertainment','FMCG'].includes(industry)?12:9; if(signalScore>=18)base+=4; else if(signalScore>=15)base+=2; return Math.min(20,base); }
function revenueRange(revScore) { if(revScore>=18)return[5,10]; if(revScore>=15)return[3,6]; if(revScore>=12)return[1.5,4]; if(revScore>=9)return[0.8,2.5]; return[0.5,1.5]; }
function momentumScore(text) { let s=4; if(/ไวรัล|viral|มาแรง|sold out|ยอดขาย|ติดเทรนด์/i.test(text))s+=4; if(/ขยาย|เปิดสาขา|funding|ลงทุน/i.test(text))s+=2; return Math.min(10,s); }
function timingScore(signalScore) { return signalScore>=18?10:signalScore>=15?8:signalScore>=12?7:5; }
function evidenceScore(source,itemCount) { return Math.min(5,(source?.label?3:2)+(itemCount>1?2:0)); }
function idFor(name) { return crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0,12); }
function priority(score) { return score>=85?'HOT':score>=70?'HIGH':score>=55?'MEDIUM':'WATCH'; }
async function loadHistory(){ try{return JSON.parse(await fs.readFile(HISTORY_OUT,'utf8'));}catch{return{brands:{}};} }

const all=[];
for(const q of queries){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=th&gl=TH&ceid=TH:th`;
  try{
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 AI-Sales-Radar-Free/1.9.3.1'}});
    if(!r.ok) continue;
    for(const item of parseItems(await r.text()).slice(0,30)) if(!tooOld(item.pubDate)) all.push({...item,query:q});
  }catch(e){console.warn('Feed failed:',q,e.message);}
}

const grouped=new Map();
for(const item of all){
  const headline=cleanHeadline(item.title);
  const brand=candidateBrand(headline);
  if(isInvalidBrand(brand)) continue;
  const text=`${headline} ${item.description}`;
  if(!/ไทย|Thailand|Bangkok|กรุงเทพ|ประเทศไทย|สาขา|ตลาดไทย|TikTok Shop|Shopee|Lazada/i.test(text)) continue;
  const key=brand.toLowerCase();
  if(!grouped.has(key)) grouped.set(key,{brand,items:[]});
  if(!grouped.get(key).items.some(x=>x.link===item.link)) grouped.get(key).items.push({...item,headline,text});
}

const history=await loadHistory();
const leads=[];
for(const g of grouped.values()){
  const items=g.items.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  const primary=items[0];
  const combined=items.slice(0,4).map(x=>x.text).join(' ');
  const sig=strongestSignal(combined), industry=industryFor(combined), th=thailandScore(combined), rev=revenuePotential(industry,sig.score), fit=oohFit(industry), mom=momentumScore(combined), tim=timingScore(sig.score), ev=evidenceScore(primary.source,items.length);
  const scores={thailand_relevance:th,buying_signal_strength:sig.score,revenue_potential:rev,ooh_fit:fit,momentum:mom,timing:tim,evidence_quality:ev};
  let total=Object.values(scores).reduce((a,b)=>a+b,0);
  const prior=history.brands?.[g.brand.toLowerCase()];
  const signalHash=crypto.createHash('sha1').update(primary.headline).digest('hex').slice(0,10);
  const isUpdated=!!prior&&prior.lastSignalHash!==signalHash, isNew=!prior;
  if(prior&&!isUpdated) total-=10;
  const [rmin,rmax]=revenueRange(rev);
  leads.push({id:idFor(g.brand),brandName:g.brand,companyName:g.brand,industry,brandType:/TikTok|Instagram|Shopee|Lazada|ไวรัล|creator|อินฟลูเอนเซอร์/i.test(combined)?'Emerging / Social-first':'Established / Growing',thailandEvidence:primary.headline,buyingSignal:sig.name,signalDate:primary.pubDate?new Date(primary.pubDate).toISOString().slice(0,10):today,whyNow:primary.headline,momentum:mom>=8?'Exploding':mom>=6?'Rising':'Active',revenueMinM:rmin,revenueMaxM:rmax,score:Math.max(0,total),scores,priority:priority(total),isNew,isUpdated,sources:items.slice(0,3).map((x,i)=>({url:x.link,label:x.source.label||`Google News source ${i+1}`})),signalHash});
}

leads.sort((a,b)=>b.score-a.score||b.revenueMaxM-a.revenueMaxM);
const selected=[], counts={};
for(const l of leads){counts[l.industry]=counts[l.industry]||0;if(counts[l.industry]>=4)continue;selected.push(l);counts[l.industry]++;if(selected.length===20)break;}
if(selected.length<20) for(const l of leads){if(selected.some(x=>x.id===l.id))continue;selected.push(l);if(selected.length===20)break;}

for(const l of selected){const k=l.brandName.toLowerCase(),p=history.brands[k]||{};history.brands[k]={firstSeen:p.firstSeen||today,lastSeen:today,timesDetected:(p.timesDetected||0)+1,lastSignalHash:l.signalHash,lastSignal:l.buyingSignal};delete l.signalHash;}

await fs.mkdir(new URL('../docs/data/',import.meta.url),{recursive:true});
await fs.writeFile(DAILY_OUT,JSON.stringify({date:today,generatedAt:new Date().toISOString(),engine:'FREE-RSS-RULES-1.9.3.1',leads:selected},null,2));
await fs.writeFile(HISTORY_OUT,JSON.stringify(history,null,2));
console.log(`Free Thailand Radar wrote ${selected.length} leads for ${today} from ${all.length} recent articles / ${grouped.size} candidate brands.`);
