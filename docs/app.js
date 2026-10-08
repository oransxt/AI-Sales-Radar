const VERSION='2.4.0';
const DEFAULT_API_URL='https://script.google.com/macros/s/AKfycbxpf5J0-61jaF1DF8LNrs3-DtAFNOhWaKlKXb7cHX8-ZsOxTHn35Gs9atalWaxKNuqU/exec';
const SHEET_URL='https://docs.google.com/spreadsheets/d/1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo/edit';
const LS={url:'asr-api-url-v1951',key:'asr-api-key-v1951'};
const DEMO_MODE=new URLSearchParams(window.location.search).get('demo')?.toLowerCase()==='elica';
const STATUS_META={
  'Not Checked':{label:'Pending',desc:'ยังไม่ได้ตัดสินใจ',tone:'pending'},
  'Available':{label:'Available',desc:'แบรนด์ใหม่จริง · สามารถ Approach ได้',tone:'available'},
  'Existing Client':{label:'Existing',desc:'แบรนด์ของเราอยู่แล้ว · ไป Upsell / New Opportunity',tone:'existing'},
  'Has Owner':{label:'Has Owner',desc:'เป็น Account ของ Sales คนอื่น · ไม่ส่ง',tone:'owner'},
  'Skip':{label:'Skip',desc:'ไม่ต้องการ Pursue',tone:'skip'}
};
const DECISION_STATUSES=['Available','Existing Client','Has Owner','Skip'];
const app={
  view:'decision',
  filter:'Pending',
  selected:null,
  daily:{generatedAt:null,leads:[]},
  credentials:[],
  credentialLibrary:[],
  credentialPreview:null,
  activities:[],
  prepared:{},
  connected:false,
  lastError:'',
  demoMode:DEMO_MODE
};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl2br=s=>esc(s).replace(/\n/g,'<br>');
const apiUrl=()=>localStorage.getItem(LS.url)||DEFAULT_API_URL;
const apiKey=()=>localStorage.getItem(LS.key)||'';
const API_TIMEOUT_MS=25000, API_GET_RETRIES=1;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function setConnection(ok,msg=''){
  app.connected=!!ok; app.lastError=msg||'';
  const d=$('#syncDot'),l=$('#syncLabel');
  if(d)d.className='sync-dot '+(ok?'on':'off');
  if(l){
    if(app.demoMode)l.textContent='DEMO MODE · Live data protected';
    else l.textContent=ok?'Google Sheets connected':(msg?'Live sync fallback':'Google Sheets not connected');
  }
}
async function fetchWithTimeout(url,options={},timeoutMs=API_TIMEOUT_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  catch(err){
    if(err&&err.name==='AbortError'){const e=new Error('Apps Script request timed out. Please retry.');e.retryable=true;throw e}
    const e=new Error('Network error while contacting Apps Script. Please retry.');e.retryable=true;throw e
  }finally{clearTimeout(timer)}
}
function parseApiResponse(action,r,text){
  const clean=String(text||'').replace(/^\uFEFF/,'').trim();
  let j;
  try{j=JSON.parse(clean)}catch(_){
    const html=/<(?:!doctype|html|head|body|script)\b/i.test(clean.slice(0,500));
    let host='Google Apps Script';try{host=new URL(r.url).host}catch(_){}
    const e=new Error((html?'Google returned an HTML page instead of API JSON':'Invalid API response')+' · '+action+' · HTTP '+r.status+' · '+host);
    e.retryable=html||r.status===429||r.status>=500; throw e
  }
  if(!j.ok){const e=new Error(j.error||('API failed: '+action));e.retryable=/temporar|timeout|service|quota|too many|internal/i.test(e.message);throw e}
  return j
}
async function apiRequest(method,action,payload={},retries=0){
  if(!apiKey())throw new Error('API key not configured');
  let lastErr;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      let r;
      if(method==='GET'){
        const u=new URL(apiUrl());
        u.searchParams.set('action',action);u.searchParams.set('key',apiKey());u.searchParams.set('_ts',Date.now());
        Object.entries(payload).forEach(([k,v])=>v!==''&&u.searchParams.set(k,v));
        r=await fetchWithTimeout(u,{cache:'no-store',redirect:'follow'})
      }else{
        r=await fetchWithTimeout(apiUrl(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,key:apiKey(),...payload}),redirect:'follow'},25000)
      }
      return parseApiResponse(action,r,await r.text())
    }catch(err){
      lastErr=err;
      const retryable=err&&err.retryable!==false&&!/Unauthorized|API key not configured/i.test(String(err.message||''));
      if(attempt>=retries||!retryable)throw err;
      await wait(700*Math.pow(2,attempt))
    }
  }
  throw lastErr||new Error('API request failed')
}
async function apiGet(action,params={}){return apiRequest('GET',action,params,API_GET_RETRIES)}
async function apiPost(action,payload){return apiRequest('POST',action,payload,0)}


function demoElicaLead(){
  return{
    id:'DEMO-ELICA-2026',
    rank:1,
    brandName:'Elica',
    companyName:'Elica / Cucina Galleria',
    industry:'Premium Kitchen Appliances / Home Living / Lifestyle',
    brandType:'New to Thailand',
    buyingSignal:'Official Thailand market entry + Elica Lhov launch',
    signalDate:'2026-07-23',
    whyNow:'Elica officially entered the Thailand market under Cucina Galleria and introduced Elica Lhov, creating a timely opening for brand-building, product education and premium-home audience engagement.',
    score:88,
    priority:'HOT',
    status:'Not Checked',
    discoveryDate:'2026-10-01',
    sources:[
      'https://www.matichon.co.th/lifestyle/news_5824459',
      'https://www.elica.com/TH-th'
    ]
  }
}
function loadElicaDemo(){
  const demoCredentials=[
    {
      Credential_ID:'CRD0002',
      Credential_Name:'Trend_Active Lifestyle (1).pdf',
      Credential_Type:'Industry Overview',
      Industry:'General / Multi-Industry',
      Tags:'Industry Overview, Sports, Lifestyle, Apparel, Activity',
      Google_Drive_URL:'https://drive.google.com/file/d/1lqeUDn5YnaY8Cayw7RjVpaO9DHLOqdTG/view?usp=drivesdk',
      Active:'TRUE'
    }
  ];
  app.daily={generatedAt:'2026-10-01',leads:[demoElicaLead()]};
  app.activities=[];
  app.credentials=demoCredentials;
  app.credentialLibrary=demoCredentials;
  app.prepared={};
  app.filter='Pending';
  app.selected='DEMO-ELICA-2026';
  prepareAll();
  setConnection(true);
}

function dedupeRadarRows(rows){
  const byRank=new Map();
  for(const r of (rows||[])){
    const rank=String(r.Daily_Rank||'');
    if(rank)byRank.set(rank,r); // keep the latest row for each expected daily rank
  }
  if(byRank.size>=1){
    return [...byRank.values()].sort((a,b)=>Number(a.Daily_Rank||999)-Number(b.Daily_Rank||999));
  }
  const byBrand=new Map();
  for(const r of (rows||[]))byBrand.set(String(r.Brand_ID||r.Brand_Name||Math.random()),r);
  return [...byBrand.values()];
}

function lead(r){
  return{
    id:String(r.Brand_ID||''),
    rank:Number(r.Daily_Rank||999),
    brandName:r.Brand_Name||'',
    companyName:r.Company_Name||'',
    industry:r.Industry||'',
    brandType:r.Brand_Type||'',
    buyingSignal:r.Buying_Signal||'',
    signalDate:r.Signal_Date||'',
    whyNow:r.Why_Now||'',
    score:Number(r.Opportunity_Score||0),
    priority:r.Priority||'',
    status:r.Salesforce_Status||'Not Checked',
    discoveryDate:r.Discovery_Date||'',
    sources:[r.Source_URL_1,r.Source_URL_2].filter(Boolean)
  }
}
function normalize(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim()}
function statusOf(l){return l.status||'Not Checked'}
function isPending(l){return !statusOf(l)||statusOf(l)==='Not Checked'}
function isHigh(l){return ['HOT','HIGH'].includes(String(l.priority||'').toUpperCase())}
function priorityTone(p){p=String(p||'').toUpperCase();return p==='HOT'?'hot':p==='HIGH'?'high':p==='MEDIUM'?'medium':'watch'}

function credentialTags(c){return String(c.Tags||'').split(',').map(x=>normalize(x)).filter(Boolean)}
function credentialScore(l,c){
  let s=0;
  const li=normalize(l.industry),ci=normalize(c.Industry);
  if(!ci||ci==='all'||ci==='general / multi-industry')s+=18;
  else if(li===ci||li.includes(ci)||ci.includes(li))s+=45;
  const hay=normalize([l.buyingSignal,l.whyNow,l.industry].join(' '));
  credentialTags(c).forEach(t=>{if(t&&hay.includes(t))s+=8});
  const type=String(c.Credential_Type||'');
  if(type==='Industry Overview')s+=10;
  if(type==='Case Study')s+=9;
  if(type==='New Launches')s+=7;
  if(type==='Media Credentials')s+=6;
  return Math.min(100,s)
}
function autoPack(l){
  return (app.credentials||[])
    .filter(c=>String(c.Active).toLowerCase()!=='false')
    .map(c=>Object.assign({},c,{_score:credentialScore(l,c)}))
    .sort((a,b)=>b._score-a._score)
    .filter(c=>c._score>=20)
    .slice(0,3)
}
function businessContext(l){
  if(l.ai?.status==='validated'&&l.ai.businessContext)return l.ai.businessContext;
  const parts=[];
  if(l.industry)parts.push(l.industry);
  if(l.buyingSignal)parts.push(l.buyingSignal);
  if(l.signalDate)parts.push('Signal '+l.signalDate);
  return parts.join(' · ')||'Brand activity detected from public market signals'
}
function signalFamily(l){
  const s=normalize(l.buyingSignal+' '+l.whyNow);
  if(/market entry|เข้าไทย|บุกไทย|first.*thailand|thailand.*first/.test(s))return'market-entry';
  if(/launch|เปิดตัว|สินค้าใหม่|new product|new model/.test(s))return'launch';
  if(/expan|new branch|new store|เปิดสาขา|ขยาย/.test(s))return'expansion';
  if(/campaign|promotion|โปรโม|แคมเปญ|presenter|ambassador/.test(s))return'campaign';
  if(/fund|invest|ระดมทุน|ลงทุน/.test(s))return'funding';
  if(/event|sponsor|งาน|อีเวนต์/.test(s))return'event';
  return'activity'
}
function salesAngle(l,existing){
  if(l.ai?.status==='validated'&&l.ai.salesAngle)return (existing?'สำหรับลูกค้าเดิม: ':'สำหรับแบรนด์ใหม่: ')+l.ai.salesAngle;
  const f=signalFamily(l);
  const prefix=existing?'ใช้ความเคลื่อนไหวล่าสุดเป็นจังหวะต่อยอดการคุยกับลูกค้าเดิม':'ใช้ความเคลื่อนไหวล่าสุดเป็นเหตุผลในการเริ่มบทสนทนากับแบรนด์';
  const detail={
    'market-entry':'โดยโฟกัสที่ช่วงสร้างการรับรู้และวางรากฐานแบรนด์ในตลาดไทย',
    'launch':'โดยโฟกัสที่ช่วงเปิดตัวและการสร้าง momentum ให้แคมเปญ',
    'expansion':'โดยโฟกัสที่การขยายตัวและการสื่อสารให้สอดคล้องกับพื้นที่/กลุ่มเป้าหมายใหม่',
    'campaign':'โดยโฟกัสที่การต่อยอด campaign momentum และการเข้าถึงกลุ่มเป้าหมาย',
    'funding':'โดยใช้จังหวะการเติบโตของธุรกิจเป็นเหตุผลในการเปิดบทสนทนาเชิงการตลาด',
    'event':'โดยใช้จังหวะกิจกรรมหรือ sponsorship เป็น entry point ในการเข้าหา',
    'activity':'โดยเชื่อม Business Context ล่าสุดเข้ากับโอกาสการสื่อสารของแบรนด์'
  }[f];
  return prefix+' '+detail
}
function nextBestAction(existing,l){
  if(l?.ai?.status==='validated'&&l.ai.nextBestAction)return l.ai.nextBestAction;
  return existing
    ? 'นัดคุยสั้น ๆ เพื่ออัปเดตทิศทางของแบรนด์และหาโอกาส Upsell / New Opportunity จากความเคลื่อนไหวล่าสุด'
    : 'ขอนัดคุย 20–30 นาที เพื่อทำความเข้าใจ Objective, Target, Timing และดูว่ามีโจทย์ที่ Plan B สามารถช่วยได้หรือไม่'
}
function credentialLines(pack,lang){
  const links=pack.filter(c=>c.Google_Drive_URL);
  if(!links.length)return'';
  const head=lang==='EN'?'Relevant materials:':'ข้อมูลประกอบที่เกี่ยวข้อง:';
  return '\n\n'+head+'\n'+links.map(c=>'- '+(c.Credential_Name||'Credential')+': '+c.Google_Drive_URL).join('\n')
}
function buildEmail(l,status,lang){
  const existing=status==='Existing Client';
  const pack=autoPack(l);
  const why=l.whyNow||('พบความเคลื่อนไหวล่าสุดของ '+l.brandName+' ที่น่าสนใจต่อการเริ่มต้นบทสนทนาทางธุรกิจ');
  if(lang==='EN'){
    const subject=(existing?'Opportunity to build on ':'A quick conversation around ')+l.brandName+"'s latest momentum";
    const body=[
      'Dear '+l.brandName+' Team,','',
      existing
        ? 'I wanted to follow up after seeing the latest activity around '+l.brandName+'. It may be a useful moment to explore whether there is an additional communication opportunity we can build on together.'
        : "I’m reaching out from Plan B Media after seeing the latest activity around "+l.brandName+". It looks like a timely reason to start a conversation.",
      '',
      'What caught our attention: '+why,
      '',
      existing
        ? 'I have pulled together a few relevant materials that may help us frame the next discussion.'
        : 'I have pulled together a few relevant materials as a starting point for the conversation.',
      credentialLines(pack,'EN'),
      '',
      existing?'Would you be open to a short catch-up to discuss the next opportunity?':'Would you be open to a 20–30 minute introduction call so we can understand your objective, audience and timing?',
      '',
      'Best regards'
    ].join('\n');
    return{subject,body}
  }
  const subject=existing?'ขออัปเดตโอกาสต่อยอดสำหรับ '+l.brandName:'ขอพูดคุยจากความเคลื่อนไหวล่าสุดของ '+l.brandName;
  const body=[
    'เรียน ทีม '+l.brandName+' ครับ','',
    existing
      ? 'ผมเห็นความเคลื่อนไหวล่าสุดของ '+l.brandName+' และมองว่าน่าจะเป็นจังหวะที่ดีในการกลับมาคุยกันว่า มีโอกาสต่อยอดการสื่อสารหรือโอกาสใหม่เพิ่มเติมจากสิ่งที่ทำอยู่หรือไม่ครับ'
      : 'ผมจาก Plan B Media ครับ เห็นความเคลื่อนไหวล่าสุดของ '+l.brandName+' และมองว่าเป็นจังหวะที่น่าสนใจในการเริ่มต้นพูดคุยกันครับ',
    '',
    'จากข้อมูลที่พบ: '+why,
    '',
    existing
      ? 'เบื้องต้นผมได้รวบรวมข้อมูลและ Credential ที่เกี่ยวข้องไว้เป็น Reference สำหรับการคุยครั้งถัดไปครับ'
      : 'เบื้องต้นผมได้รวบรวมข้อมูลและ Credential ที่เกี่ยวข้องไว้เป็น Reference เพื่อให้การพูดคุยครั้งแรกกระชับขึ้นครับ',
    credentialLines(pack,'TH'),
    '',
    existing
      ? 'หากสะดวก ผมอยากขอนัดคุยสั้น ๆ เพื่ออัปเดต Direction และดูว่ามีโอกาส Upsell หรือ New Opportunity ที่เหมาะกับช่วงนี้หรือไม่ครับ'
      : 'หากสะดวก ผมอยากขอนัดพูดคุยประมาณ 20–30 นาที เพื่อทำความเข้าใจ Objective, Target และ Timing ของแบรนด์เพิ่มเติมครับ',
    '',
    'ขอบคุณครับ'
  ].join('\n');
  return{subject,body}
}
function prepare(l){
  if(!app.prepared[l.id]){
    const lang='TH',mail=buildEmail(l,'Available',lang);
    app.prepared[l.id]={
      language:lang,recipient:'',subject:mail.subject,body:mail.body,
      businessContext:businessContext(l),
      salesAngle:salesAngle(l,false),
      nextAction:nextBestAction(false,l),
      credentials:autoPack(l),
      decisionStatus:DECISION_STATUSES.includes(statusOf(l))?statusOf(l):'',
      emailDirty:false
    }
  }
  return app.prepared[l.id]
}
function prepareAll(){(app.daily.leads||[]).forEach(prepare)}

function counts(){
  const ls=app.daily.leads||[];
  return{
    found:ls.length,
    ready:ls.length,
    pending:ls.filter(isPending).length,
    high:ls.filter(isHigh).length,
    decided:ls.filter(l=>!isPending(l)).length
  }
}
function filtered(){
  const ls=(app.daily.leads||[]).slice();
  let out=ls;
  if(app.filter==='Pending')out=ls.filter(isPending);
  else if(app.filter==='Available')out=ls.filter(l=>statusOf(l)==='Available');
  else if(app.filter==='Existing')out=ls.filter(l=>statusOf(l)==='Existing Client');
  else if(app.filter==='Has Owner')out=ls.filter(l=>statusOf(l)==='Has Owner');
  else if(app.filter==='Skip')out=ls.filter(l=>statusOf(l)==='Skip');
  return out.sort((a,b)=>a.rank-b.rank)
}
function metricsHtml(){
  const c=counts();
  return '<div class="metrics decision-metrics">'+
    '<div class="metric"><div class="n">'+c.found+'</div><div class="l">Signals Found</div></div>'+
    '<div class="metric"><div class="n">'+c.ready+'</div><div class="l">Auto Prepared</div></div>'+
    '<div class="metric"><div class="n">'+c.pending+'</div><div class="l">Pending Decision</div></div>'+
    '<div class="metric"><div class="n">'+c.high+'</div><div class="l">HOT / HIGH</div></div>'+
    '<div class="metric"><div class="n">'+c.decided+'</div><div class="l">Decided</div></div>'+
  '</div>'
}
function processHtml(){
  const steps=[
    ['1','DISCOVER','Market Signal'],
    ['2','SCORE','Commercial Priority'],
    ['3','ANALYZE','Why Now + Sales Angle'],
    ['4','MATCH','Credential Pack'],
    ['5','DRAFT','Email Ready'],
    ['6','DECIDE','Human Final Decision']
  ];
  return '<div class="auto-process">'+steps.map((x,i)=>
    '<div class="auto-step '+(i===5?'human':'done')+'"><span>'+x[0]+'</span><div><b>'+x[1]+'</b><small>'+x[2]+'</small></div></div>'
  ).join('')+'</div>'
}
function filterHtml(){
  const filters=['Pending','Available','Existing','Has Owner','Skip','All'];
  return '<div class="decision-filters">'+filters.map(f=>'<button class="chip '+(app.filter===f?'active':'')+'" data-filter="'+esc(f)+'">'+esc(f)+'</button>').join('')+'</div>'
}
function cardHtml(l){
  const p=prepare(l),st=STATUS_META[statusOf(l)]||STATUS_META['Not Checked'];
  return '<button class="op-card '+(app.selected===l.id?'selected':'')+'" data-id="'+esc(l.id)+'">'+
    '<div class="op-card-top"><span class="priority '+priorityTone(l.priority)+'">'+esc(l.priority||'—')+'</span><span class="score">'+Math.round(l.score||0)+'</span></div>'+
    '<div class="op-brand">'+esc(l.brandName)+'</div>'+
    '<div class="op-signal">'+esc(l.buyingSignal||'Brand activity')+'</div>'+
    '<div class="op-meta">'+esc(l.industry||'—')+'</div>'+
    '<div class="op-ready"><span>✓</span> Email + '+p.credentials.length+' credentials ready</div>'+
    '<div class="status-pill '+st.tone+'">'+esc(st.label)+'</div>'+
  '</button>'
}
function sourceLinks(l){
  if(!l.sources.length)return'<span class="sub">No source URL stored</span>';
  return l.sources.map((u,i)=>'<a class="link" href="'+esc(u)+'" target="_blank" rel="noopener">Source '+(i+1)+' ↗</a>').join(' · ')
}
function credentialHtml(c){
  const score=Number(c._score||0);
  return '<div class="auto-cred"><div><strong>'+esc(c.Credential_Name||'Credential')+'</strong><small>'+esc(c.Credential_Type||'')+(c.Industry?' · '+esc(c.Industry):'')+(score?' · Match '+score:'')+'</small></div>'+
    (c.Google_Drive_URL?'<a href="'+esc(c.Google_Drive_URL)+'" target="_blank" rel="noopener">Open ↗</a>':'')+'</div>'
}
function decisionOption(value,label,desc,l){
  const p=prepare(l);
  const checked=p.decisionStatus===value?' checked':'';
  return '<label class="decision-choice"><input type="radio" name="accountStatus" value="'+esc(value)+'"'+checked+'><span><b>'+esc(label)+'</b><small>'+esc(desc)+'</small></span></label>'
}
function detailHtml(l){
  if(!l)return'<div class="panel empty decision-empty">No opportunities in this filter.</div>';
  const p=prepare(l),st=p.decisionStatus||statusOf(l),stop=st==='Has Owner'||st==='Skip';
  return '<div class="decision-detail">'+
    '<div class="detail-hero">'+
      '<div><span class="badge '+priorityTone(l.priority)+'">'+esc(l.priority||'OPPORTUNITY')+' · '+Math.round(l.score||0)+'</span>'+
      '<h2>'+esc(l.brandName)+'</h2><div class="sub">'+esc(l.companyName||l.industry||'')+'</div></div>'+
      '<div class="ready-badge">AUTO PREPARED</div>'+
    '</div>'+
    '<div class="decision-grid">'+
      '<section class="decision-section"><div class="section-label">BUYING SIGNAL</div><div class="section-value">'+esc(l.buyingSignal||'—')+'</div><div class="sub">'+esc(l.signalDate||'')+'</div></section>'+
      '<section class="decision-section"><div class="section-label">BUSINESS CONTEXT</div><div class="section-value">'+esc(p.businessContext)+'</div></section>'+
      '<section class="decision-section wide"><div class="section-label">'+(l.ai?.status==='validated'?'WHY NOW · AI HYPOTHESIS':'WHY NOW')+'</div><div class="why-box">'+esc(l.ai?.whyNow||l.whyNow||'Latest public market activity detected.')+'</div><div class="source-row">'+sourceLinks(l)+'</div></section>'+
      '<section class="decision-section"><div class="section-label">SALES ANGLE</div><div class="section-value">'+esc(p.salesAngle)+'</div></section>'+
      '<section class="decision-section"><div class="section-label">NEXT BEST ACTION</div><div class="section-value">'+esc(p.nextAction)+'</div></section>'+
      '<section class="decision-section wide"><div class="section-label">AUTO-MATCHED CREDENTIALS</div><div class="auto-creds">'+(p.credentials.length?p.credentials.map(credentialHtml).join(''):'<div class="sub">No credential matched. Email draft remains ready without attachments.</div>')+'</div></section>'+
    '</div>'+
    '<div class="final-gate">'+
      '<div class="final-gate-head"><div><span class="eyebrow">HUMAN FINAL DECISION</span><h3>Account Status</h3></div><span class="human-only">Only human step</span></div>'+
      '<div class="decision-options">'+
        decisionOption('Available','Available','แบรนด์ใหม่จริง · สามารถ Approach ได้',l)+
        decisionOption('Existing Client','Existing','แบรนด์ของเราอยู่แล้ว · ไป Upsell / New Opportunity',l)+
        decisionOption('Has Owner','Has Owner','เป็น Account ของ Sales คนอื่น · Stop outreach',l)+
        decisionOption('Skip','Skip','ไม่ต้องการ Pursue',l)+
      '</div>'+
      '<div id="sendArea" class="send-area '+(stop?'stopped':'')+'">'+
        (stop
          ? '<div class="stop-note">เลือกสถานะนี้แล้วระบบจะบันทึก Decision และไม่เปิด Email Draft</div>'
          : '<div class="composer-toolbar"><label>Language<select id="language"><option value="TH" '+(p.language==='TH'?'selected':'')+'>Thai</option><option value="EN" '+(p.language==='EN'?'selected':'')+'>English</option></select></label><div class="spacer"></div><span class="not-sent">NOT SENT</span></div>'+
            '<div class="mail-row"><label>To</label><input id="recipient" type="email" value="'+esc(p.recipient)+'" placeholder="Sales ใส่ email จริงตรงนี้"></div>'+
            '<div class="mail-row"><label>Subject</label><input id="subject" value="'+esc(p.subject)+'"></div>'+
            '<div class="mail-body"><textarea id="emailBody">'+esc(p.body)+'</textarea></div>'+
            '<div class="send-note">ระบบไม่หา Contact และไม่ส่งอัตโนมัติ · Sales ใส่ Recipient, Review และกด Final Decision เอง</div>'
        )+
      '</div>'+
      '<div class="decision-actions">'+
        '<button class="btn" id="saveDecision">Save Decision</button>'+
        (!stop?'<button class="btn primary" id="approveOpen">Approve → Open Gmail Draft</button>':'')+
      '</div>'+
    '</div>'+
  '</div>'
}
function decisionView(){
  const ls=filtered();
  if(!app.selected||!ls.find(x=>x.id===app.selected))app.selected=ls[0]?.id||null;
  const l=(app.daily.leads||[]).find(x=>x.id===app.selected);
  $('#title').textContent="TODAY'S READY OPPORTUNITIES";
  $('#subtitle').textContent='Discover → Score → Analyze → Match → Draft → Human Final Decision';
  const notice=app.demoMode
    ? '<div class="notice demo-notice"><strong>ELICA DEMO MODE</strong> · ใช้ข่าวจริงสำหรับ Demo เท่านั้น · ไม่เขียนทับ Google Sheet / Live Database · Reload เพื่อ Reset Demo</div>'
    : (!apiKey()
      ? '<div class="notice">เปิด Settings และใส่ RADAR_API_KEY เพื่อบันทึก Final Decision กลับ Google Sheets. Demo/fallback ยังดูได้แต่บันทึกไม่ได้.</div>'
      : (!app.connected&&app.lastError?'<div class="notice bad">'+esc(app.lastError)+'</div>':''));
  $('#content').innerHTML=notice+processHtml()+metricsHtml()+
    '<div class="decision-shell">'+
      '<div class="decision-list panel"><div class="decision-list-head"><div><h3>Ready for Decision</h3><p>ทุก Card ถูกเตรียมอัตโนมัติแล้ว</p></div><span>'+ls.length+'</span></div>'+filterHtml()+
        '<div class="op-list">'+(ls.length?ls.map(cardHtml).join(''):'<div class="empty">No opportunities.</div>')+'</div></div>'+
      '<div class="panel decision-main">'+detailHtml(l)+'</div>'+
    '</div>';
  bindDecision()
}
function bindDecision(){
  $$('[data-filter]').forEach(b=>b.onclick=()=>{app.filter=b.dataset.filter;app.selected=null;render()});
  $$('.op-card').forEach(b=>b.onclick=()=>{app.selected=b.dataset.id;render()});
  const l=(app.daily.leads||[]).find(x=>x.id===app.selected); if(!l)return;
  const p=prepare(l);
  $$('input[name="accountStatus"]').forEach(r=>r.onchange=()=>handleStatusPreview(l,r.value));
  const lang=$('#language');
  if(lang)lang.onchange=()=>{p.language=lang.value;if(!p.emailDirty){const m=buildEmail(l,selectedStatus()||'Available',p.language);p.subject=m.subject;p.body=m.body;render()}};
  const rec=$('#recipient'),sub=$('#subject'),body=$('#emailBody');
  if(rec)rec.oninput=()=>p.recipient=rec.value;
  if(sub)sub.oninput=()=>{p.subject=sub.value;p.emailDirty=true};
  if(body)body.oninput=()=>{p.body=body.value;p.emailDirty=true};
  const save=$('#saveDecision'); if(save)save.onclick=()=>finalizeDecision(l,false);
  const approve=$('#approveOpen'); if(approve)approve.onclick=()=>finalizeDecision(l,true)
}
function selectedStatus(){
  const r=$('input[name="accountStatus"]:checked');
  if(r)return r.value;
  const l=(app.daily.leads||[]).find(x=>x.id===app.selected);
  return l?prepare(l).decisionStatus:''
}
function handleStatusPreview(l,status){
  const p=prepare(l),stop=status==='Has Owner'||status==='Skip';
  p.decisionStatus=status;
  if(!p.emailDirty&&!stop){
    const m=buildEmail(l,status,p.language);p.subject=m.subject;p.body=m.body;
    p.salesAngle=salesAngle(l,status==='Existing Client');
    p.nextAction=nextBestAction(status==='Existing Client',l)
  }
  render()
}
async function finalizeDecision(l,openGmail){
  const status=selectedStatus();
  if(!status){alert('เลือก Account Status ก่อน');return}
  const p=prepare(l);
  if(openGmail&&(status==='Has Owner'||status==='Skip')){alert('สถานะนี้ไม่เปิด Email Draft');return}

  let gmailWindow=null;
  let gmailUrl='';
  if(openGmail){
    const to=String($('#recipient')?.value||'').trim();
    const subject=String($('#subject')?.value||'').trim();
    const body=String($('#emailBody')?.value||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){alert('ใส่ Recipient email ที่ถูกต้องก่อน');return}
    if(!subject||!body){alert('Subject และ Email Body ต้องไม่ว่าง');return}
    p.recipient=to;p.subject=subject;p.body=body;
    gmailUrl='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(p.recipient)+'&su='+encodeURIComponent(p.subject)+'&body='+encodeURIComponent(p.body);

    // Open a placeholder immediately while we are still inside the user's click.
    // Browsers often block window.open() when it happens only after awaited API calls.
    gmailWindow=window.open('about:blank','_blank');
    if(!gmailWindow){
      alert('Browser blocked the Gmail window. Please allow pop-ups for this site, then try again.');
      return;
    }
    try{
      gmailWindow.document.title='Preparing Gmail Draft…';
      gmailWindow.document.body.innerHTML='<div style="font-family:Arial,sans-serif;padding:24px">Preparing Gmail draft…</div>';
    }catch(_){}
  }

  if(app.demoMode){
    l.status=status;
    p.decisionStatus=status;
    if(openGmail&&gmailWindow)gmailWindow.location.replace(gmailUrl);
    setConnection(true);
    render();
    return;
  }

  if(!apiKey()){
    if(gmailWindow)gmailWindow.close();
    alert('กรุณาใส่ RADAR_API_KEY ใน Settings ก่อนบันทึก Final Decision');
    return
  }

  try{
    // Avoid duplicate writes when the selected status is already saved.
    // The Apps Script status endpoint already writes STATUS_CHANGED to Activity_Log,
    // so a second activity POST is unnecessary and can cause duplicate rows/timeouts.
    if(l.status!==status){
      const saveBtn=$('#saveDecision'),approveBtn=$('#approveOpen');
      if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving…'}
      if(approveBtn){approveBtn.disabled=true;approveBtn.textContent='Saving…'}
      await apiPost('status',{
        brandId:l.id,status,
        details:openGmail
          ? 'Final Decision · '+(STATUS_META[status]?.label||status)+' · Gmail draft approved'
          : 'Final Decision · '+(STATUS_META[status]?.label||status),
        origin:'Autonomous Final Decision v'+VERSION,
        createdBy:'AI Sales Radar'
      });
      l.status=status;
      p.decisionStatus=status;
    }
    setConnection(true);
    if(openGmail&&gmailWindow){
      gmailWindow.location.replace(gmailUrl);
    }
    render()
  }catch(err){
    if(gmailWindow)gmailWindow.close();
    setConnection(false,err.message);
    alert('Save failed: '+err.message);
    render()
  }
}


async function refreshCredentialData(){
  if(!apiKey())throw new Error('API key not configured');
  const d=await apiGet('credentials',{active:'all'});
  app.credentialLibrary=d.data||[];
  app.credentials=app.credentialLibrary.filter(c=>String(c.Active).toLowerCase()==='true');
  app.prepared={};
  prepareAll();
  setConnection(true);
}
async function loadCredentialLibrary(redraw=true){
  if(!apiKey()){
    app.credentialLibrary=[];
    if(redraw)render();
    return;
  }
  try{
    await refreshCredentialData();
  }catch(err){
    setConnection(false,err.message);
  }
  if(redraw)render();
}
function smartCredentialLibraryView(){
  $('#title').textContent='SMART CREDENTIAL LIBRARY';
  $('#subtitle').textContent='Separate knowledge flow · Add once → AI auto-matches in Final Decision';

  const p=app.credentialPreview;
  const rows=app.credentialLibrary||[];
  const activeCount=rows.filter(c=>String(c.Active).toLowerCase()==='true').length;
  const typeOptions=['Industry Overview','Case Study','New Launches','Media Credentials'];

  const notice=!apiKey()
    ? '<div class="notice">ใส่ RADAR_API_KEY ใน Settings ก่อน เพื่อ Analyze และ Save Credential เข้า Google Sheets / Drive integration.</div>'
    : (!app.connected&&app.lastError?'<div class="notice bad">'+esc(app.lastError)+'</div>':'');

  const preview=p ? (
    '<div class="smart-preview">'+
      '<div class="smart-preview-head"><div>'+
        '<span class="badge high">ANALYZED</span>'+
        '<h3>'+esc(p.fileName||p.credentialName||'Credential')+'</h3>'+
        '<div class="sub">'+esc(p.analysisSource||'')+' · Confidence '+esc(p.confidence||0)+'/100</div>'+
      '</div>'+
      '<div class="smart-status '+(p.active?'active':'inactive')+'">'+(p.active?'ACTIVE':'INACTIVE')+'</div></div>'+
      '<div class="smart-grid">'+
        '<label>Credential Name<input id="previewName" value="'+esc(p.credentialName||p.fileName||'')+'"></label>'+
        '<label>Credential Type<select id="previewType">'+typeOptions.map(t=>'<option '+(p.credentialType===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
        '<label>Industry<input id="previewIndustry" value="'+esc(p.industry||'')+'"></label>'+
        '<label class="wide">Tags<input id="previewTags" value="'+esc(p.tags||'')+'" placeholder="Product Launch, Premium, Bangkok, OOH..."></label>'+
      '</div>'+
      '<div class="smart-meta">'+
        '<div><span>Source Modified</span><strong>'+esc(p.sourceLastModified||'—')+'</strong></div>'+
        '<div><span>Analysis Source</span><strong>'+esc(p.analysisSource||'—')+'</strong></div>'+
        '<div><span>File Type</span><strong>'+esc(p.mimeType||'—')+'</strong></div>'+
        '<div><span>Auto Match</span><strong>After Save</strong></div>'+
      '</div>'+
      '<div class="settings-actions">'+
        '<button class="btn primary" id="confirmCredential">Confirm & Add to Library</button>'+
        '<button class="btn" id="reanalyzeCredential">Re-analyze</button>'+
        '<button class="btn" id="cancelCredentialPreview">Cancel</button>'+
      '</div>'+
    '</div>'
  ) : '';

  const tableRows=rows.length ? rows.map(c=>
    '<tr>'+
      '<td><div class="brand-name">'+esc(c.Credential_Name)+'</div><div class="sub">'+esc(c.Analysis_Source||'')+'</div></td>'+
      '<td>'+esc(c.Credential_Type)+'</td>'+
      '<td>'+esc(c.Industry||'All')+'</td>'+
      '<td class="credential-tags-cell">'+esc(c.Tags||'')+'</td>'+
      '<td><span class="smart-status '+(String(c.Active).toLowerCase()==='true'?'active':'inactive')+'">'+(String(c.Active).toLowerCase()==='true'?'ACTIVE':'INACTIVE')+'</span></td>'+
      '<td>'+esc(c.Source_Last_Modified||'—')+'</td>'+
      '<td>'+esc(c.Last_Updated||'—')+'</td>'+
      '<td>'+(c.Google_Drive_URL?'<a class="link" target="_blank" rel="noopener" href="'+esc(c.Google_Drive_URL)+'">Open Drive ↗</a>':'—')+'</td>'+
    '</tr>'
  ).join('') : '<tr><td colspan="8"><div class="empty">No credentials in library yet.</div></td></tr>';

  $('#content').innerHTML=notice+
    '<div class="knowledge-process">'+
      '<div class="knowledge-step done"><span>1</span><div><b>PASTE</b><small>Google Drive Link</small></div></div>'+
      '<div class="knowledge-step done"><span>2</span><div><b>ANALYZE</b><small>Metadata + native text</small></div></div>'+
      '<div class="knowledge-step human"><span>3</span><div><b>REVIEW</b><small>Human confirms classification</small></div></div>'+
      '<div class="knowledge-step done"><span>4</span><div><b>SAVE</b><small>Credential Library</small></div></div>'+
      '<div class="knowledge-step done"><span>5</span><div><b>AUTO-MATCH</b><small>Feeds Final Decision</small></div></div>'+
    '</div>'+
    '<div class="credential-admin-metrics">'+
      '<div class="metric"><div class="n">'+rows.length+'</div><div class="l">Library Records</div></div>'+
      '<div class="metric"><div class="n">'+activeCount+'</div><div class="l">Active for Auto-Match</div></div>'+
      '<div class="metric"><div class="n">'+new Set(rows.map(c=>c.Credential_Type).filter(Boolean)).size+'</div><div class="l">Credential Types</div></div>'+
      '<div class="metric"><div class="n">'+new Set(rows.map(c=>c.Industry).filter(Boolean)).size+'</div><div class="l">Industries</div></div>'+
    '</div>'+
    '<div class="full-panel">'+
      '<div class="credential-admin-head">'+
        '<div><span class="eyebrow">KNOWLEDGE ADMIN FLOW</span><h3>Add Credential to AI Knowledge</h3>'+
        '<div class="sub">This page is separate from the Sales flow. Sales does not need to visit here during Final Decision.</div></div>'+
        '<div class="knowledge-note">Saved credentials are used automatically by the matching engine.</div>'+
      '</div>'+
      '<div class="smart-intake">'+
        '<div><span class="next-stage-badge">SMART INTAKE</span><h3>Paste Google Drive Link</h3>'+
        '<div class="sub">Google Docs / Slides / Sheets: available native text is analyzed. PDF / PPTX / Office files fall back to Drive metadata + filename in the current backend.</div></div>'+
        '<div class="smart-url-row"><input id="smartDriveUrl" placeholder="https://drive.google.com/..."><button class="btn primary" id="analyzeCredential">Analyze Link</button></div>'+
      '</div>'+
      preview+
      '<div class="section">'+
        '<div class="filters"><strong>Credential Library</strong><div class="spacer"></div><span class="sub">'+activeCount+' active / '+rows.length+' total</span></div>'+
        '<div class="table-wrap v2-table"><table><thead><tr><th>Name</th><th>Type</th><th>Industry</th><th>Tags</th><th>Status</th><th>Source Modified</th><th>Record Updated</th><th>Drive</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
      '</div>'+
    '</div>';

  const analyze=async(url)=>{
    const driveUrl=String(url||'').trim();
    if(!driveUrl){alert('Paste a Google Drive file URL first.');return;}
    if(!apiKey()){alert('Add RADAR_API_KEY in Settings first.');return;}
    const btn=$('#analyzeCredential');
    if(btn){btn.disabled=true;btn.textContent='Analyzing…';}
    try{
      const d=await apiPost('credential-analyze',{driveUrl});
      app.credentialPreview=d.data||null;
      smartCredentialLibraryView();
    }catch(err){
      alert('Analyze failed: '+err.message);
      if(btn){btn.disabled=false;btn.textContent='Analyze Link';}
    }
  };

  const analyzeBtn=$('#analyzeCredential');
  if(analyzeBtn)analyzeBtn.onclick=()=>analyze($('#smartDriveUrl').value);

  const re=$('#reanalyzeCredential');
  if(re)re.onclick=()=>analyze(app.credentialPreview?.driveUrl||'');

  const cancel=$('#cancelCredentialPreview');
  if(cancel)cancel.onclick=()=>{app.credentialPreview=null;smartCredentialLibraryView();};

  const confirm=$('#confirmCredential');
  if(confirm)confirm.onclick=async()=>{
    const payload={
      type:$('#previewType').value,
      name:$('#previewName').value.trim(),
      industry:$('#previewIndustry').value.trim(),
      tags:$('#previewTags').value.trim(),
      driveUrl:p.driveUrl,
      sourceLastModified:p.sourceLastModified||'',
      analysisSource:p.analysisSource||'',
      mimeType:p.mimeType||'',
      fileId:p.fileId||''
    };
    if(!payload.name||!payload.driveUrl){alert('Credential name and Drive URL are required.');return;}
    confirm.disabled=true;confirm.textContent='Saving…';
    try{
      await apiPost('credential-upsert',payload);
      app.credentialPreview=null;
      await refreshCredentialData();
      alert('Credential added. Final Decision auto-match has been refreshed.');
      smartCredentialLibraryView();
    }catch(err){
      confirm.disabled=false;confirm.textContent='Confirm & Add to Library';
      alert('Save failed: '+err.message);
    }
  };
}

function historyView(){
  $('#title').textContent='ACTIVITY HISTORY';
  $('#subtitle').textContent='Decisions and activity written back to Google Sheets';
  const rows=app.activities||[];
  $('#content').innerHTML='<div class="full-panel">'+
    (!apiKey()?'<div class="notice">Add API key in Settings first.</div>':'')+
    (rows.length?'<table><thead><tr><th>Date</th><th>Brand</th><th>Activity</th><th>Old</th><th>New</th><th>Details</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r.Activity_DateTime)+'</td><td>'+esc(r.Brand_Name)+'</td><td>'+esc(r.Activity_Type)+'</td><td>'+esc(r.Old_Status)+'</td><td>'+esc(r.New_Status)+'</td><td>'+esc(r.Details)+'</td></tr>').join('')+
      '</tbody></table>':'<div class="empty">No activity loaded.</div>')+
  '</div>'
}
function settingsView(){
  const has=!!apiKey();
  $('#title').textContent='SETTINGS';
  $('#subtitle').textContent='Google Apps Script API Bridge · v'+VERSION;
  $('#content').innerHTML='<div class="full-panel">'+
    '<div class="notice '+(app.connected?'good':'')+'">'+(app.connected?'Connected to Google Sheets successfully.':'Paste your RADAR_API_KEY once. It is stored only in this browser, never in public GitHub.')+'</div>'+
    '<div class="settings-grid">'+
      '<label>Apps Script Web App URL</label><input id="url" value="'+esc(apiUrl())+'">'+
      '<label>RADAR_API_KEY</label><input id="key" type="password" value="'+(has?'••••••••••••':'')+'" placeholder="Paste key from setupBridge">'+
      '<label>Google Sheet</label><a class="link" href="'+SHEET_URL+'" target="_blank">Open master database ↗</a>'+
    '</div>'+
    '<div class="settings-actions"><button class="btn primary" id="save">Save & Connect</button><button class="btn" id="test">Test Connection</button><button class="btn" id="clear">Clear Key</button></div>'+
  '</div>';
  const saveInputs=()=>{const u=$('#url').value.trim(),k=$('#key').value.trim();if(u)localStorage.setItem(LS.url,u);if(k&&!/^•+$/.test(k))localStorage.setItem(LS.key,k)};
  $('#save').onclick=async()=>{saveInputs();await loadAll()};
  $('#test').onclick=async()=>{saveInputs();try{const d=await apiGet('health');setConnection(true);alert('Connected · Apps Script v'+d.version);render()}catch(err){setConnection(false,err.message);alert('Connection failed: '+err.message);render()}};
  $('#clear').onclick=()=>{localStorage.removeItem(LS.key);setConnection(false);settingsView()}
}
function render(){
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===app.view));
  const c=counts(),side=$('#sideReady');if(side)side.textContent=c.pending;
  setConnection(app.connected,app.lastError);
  if(app.view==='decision')decisionView();
  else if(app.view==='credentials')smartCredentialLibraryView();
  else if(app.view==='history')historyView();
  else settingsView()
}
async function loadActivities(redraw=false){
  if(!apiKey()){app.activities=[];if(redraw)render();return}
  try{const d=await apiGet('activities',{limit:300});app.activities=d.data||[];setConnection(true)}
  catch(err){setConnection(false,err.message)}
  if(redraw)render()
}
async function loadDecisionCredentials(){
  try{
    const d=await apiGet('credentials',{active:'true'});
    app.credentials=d.data||[];
    app.prepared={};
    prepareAll();
    if(app.view==='decision')render();
  }catch(err){
    console.warn('Credential sync delayed:',err.message);
  }
}
async function loadFallbackRadar(message){
  const msg='Live radar sync temporarily unavailable. '+message;
  if(app.daily.leads&&app.daily.leads.length){
    setConnection(false,msg+' Showing last loaded radar data.');
    return;
  }
  setConnection(false,msg+' Showing fallback radar.');
  try{
    const r=await fetch('data/daily.json?t='+Date.now(),{cache:'no-store'}),text=await r.text(),j=JSON.parse(String(text||'').replace(/^\uFEFF/,'').trim());
    app.daily={generatedAt:j.generatedAt||'',leads:(j.leads||[]).map((x,i)=>({
      id:String(x.id||('FB'+i)),rank:i+1,brandName:x.brandName||x.brand||'',companyName:x.companyName||'',industry:x.industry||'',brandType:x.brandType||'',
      buyingSignal:x.buyingSignal||'',signalDate:x.signalDate||'',whyNow:x.whyNow||'',score:Number(x.score||x.opportunityScore||0),priority:x.priority||'',status:'Not Checked',
      discoveryDate:j.date||'',ai:x.ai||null,thailandEvidence:x.thailandEvidence||'',sources:(x.sources||[x.sourceUrl1,x.sourceUrl2]).filter(Boolean).map(s=>typeof s==='string'?s:s.url).filter(Boolean)
    }))};
    app.credentials=[];app.prepared={};prepareAll();
  }catch(_){
    app.daily={generatedAt:'',leads:[]};app.credentials=[];app.prepared={};
  }
}
async function attachAiInsights(){
  try{
    const response=await fetch('data/daily.json?ai='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok)return;
    const daily=await response.json();
    if(daily.date!==app.daily.generatedAt)return;
    const aiByName=new Map((daily.leads||[]).filter(x=>x.ai?.status==='validated').map(x=>[normalize(x.brandName),x]));
    for(const l of app.daily.leads){
      const found=aiByName.get(normalize(l.brandName));
      if(found){l.ai=found.ai;l.thailandEvidence=found.thailandEvidence||'';}
    }
  }catch(error){console.warn('AI metadata unavailable; rule-only dashboard remains ready.');}
}

async function loadAll(){
  if(app.demoMode){
    loadElicaDemo();
    render();
    return;
  }
  if(!apiKey()){
    await loadFallbackRadar('API key not configured.');
    if(!app.selected)app.selected=filtered()[0]?.id||app.daily.leads[0]?.id||null;
    render();
    return;
  }

  try{
    const d=await apiGet('daily-radar');
    const radar=dedupeRadarRows(d.data||[]);
    app.daily={generatedAt:radar[0]?.Discovery_Date||'',leads:radar.map(lead)};
    await attachAiInsights();
    app.prepared={};
    prepareAll();
    setConnection(true);
    if(!app.selected)app.selected=filtered()[0]?.id||app.daily.leads[0]?.id||null;
    render();

    // Non-critical data loads after the live radar is already visible.
    // A slow Credential_Library call must never force the whole dashboard into fallback mode.
    loadDecisionCredentials();
  }catch(err){
    await loadFallbackRadar(err.message);
    if(!app.selected)app.selected=filtered()[0]?.id||app.daily.leads[0]?.id||null;
    render();
  }
}
$('#nav').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;app.view=b.dataset.view;if(app.view==='history')loadActivities(true);else if(app.view==='credentials')loadCredentialLibrary(true);else render()};
$('#reloadBtn').onclick=()=>app.demoMode?loadAll():(app.view==='history'?loadActivities(true):(app.view==='credentials'?loadCredentialLibrary(true):loadAll()));
$('#today').textContent=new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'});
loadAll();
