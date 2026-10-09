const API_URL='https://script.google.com/macros/s/AKfycbxpf5J0-61jaF1DF8LNrs3-DtAFNOhWaKlKXb7cHX8-ZsOxTHn35Gs9atalWaxKNuqU/exec';
const LS={url:'asr-api-url-v1951',key:'asr-api-key-v1951'};
const state={items:[],asOf:'',brands:null,auth:'loading',filter:'all',error:''};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
function safeUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return''}}
function matchBrand(item){
  if(!state.brands)return null;
  const aliases=[item.brandName,...(item.aliases||[])].map(norm);
  return state.brands.find(b=>aliases.includes(norm(b.Brand_Name)))||null;
}
function matchState(item){
  if(!state.brands)return 'unknown';
  return matchBrand(item)?'existing':'new';
}
function statusBadge(item){
  const b=matchBrand(item);
  if(!state.brands)return '<span class="ms-badge ms-unknown">MASTER NOT VERIFIED</span>';
  if(!b)return '<span class="ms-badge ms-new">NEW TO MASTER · VERIFY</span>';
  const status=String(b.Salesforce_Status||'Not Checked');
  const caution=status==='Has Owner'||status==='Skip';
  return '<span class="ms-badge '+(caution?'ms-stop':'ms-existing')+'">IN BRAND_MASTER · '+esc(status)+'</span>';
}
function sourceHtml(s){
  const url=safeUrl(s.url);
  if(!url)return'';
  return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">'+esc(s.publisher||'Original source')+' ↗</a>';
}
function cardHtml(item){
  const b=matchBrand(item),blocked=b&&['Has Owner','Skip'].includes(String(b.Salesforce_Status||''));
  return '<article class="ms-card">'+
    '<div class="ms-head"><div><div class="ms-signal">'+esc(item.signalType)+'</div><h3>'+esc(item.brandName)+'</h3>'+
    (item.parentBrand?'<p class="ms-parent">Parent / Distributor: '+esc(item.parentBrand)+'</p>':'')+
    '</div>'+statusBadge(item)+'</div>'+
    '<div class="ms-headline">'+esc(item.headline)+'</div>'+
    '<div class="ms-meta">NEWS '+esc(item.signalDate)+' · EVENT '+esc(item.eventDate||'TBC')+' · '+esc(item.industry)+'</div>'+
    '<div class="ms-block"><b>WHAT HAPPENED · FACTS</b><ul>'+(item.facts||[]).map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></div>'+
    '<div class="ms-hypothesis"><div><b>WHY NOW · SALES HYPOTHESIS</b><p>'+esc(item.whyNow)+'</p></div>'+
    '<div><b>SALES ANGLE</b><p>'+esc(item.salesAngle)+'</p></div></div>'+
    '<div class="ms-next"><b>NEXT BEST ACTION</b><p>'+esc(item.nextAction)+'</p></div>'+
    (blocked?'<div class="ms-warning">Account Status: '+esc(b.Salesforce_Status)+' — ห้ามติดต่อโดยตรง ให้ส่งต่อ Account Owner ก่อน</div>':'')+
    '<div class="ms-sources"><span>PUBLIC SOURCE EVIDENCE</span>'+(item.sources||[]).map(sourceHtml).join('')+'</div>'+
    '</article>';
}
function render(){
  const matched=state.items.filter(x=>matchState(x)==='existing').length;
  const newCount=state.items.filter(x=>matchState(x)==='new').length;
  const filtered=state.items.filter(x=>state.filter==='all'||matchState(x)===state.filter);
  const status=state.auth==='connected'
    ?'Connected to Brand_Master · matched by exact brand name / aliases'
    :state.auth==='no-key'?'Brand_Master matching requires your existing Dashboard API key (Settings).':
      state.auth==='error'?'Brand_Master lookup unavailable · showing public news only.':'Checking Brand_Master…';
  $('#msStatus').textContent=status;
  $('#msCount').textContent=String(state.items.length);
  $('#msExisting').textContent=state.brands?String(matched):'—';
  $('#msNew').textContent=state.brands?String(newCount):'—';
  $('#msDate').textContent=state.asOf||'';
  $('#msNotice').textContent='ตัวอย่างข่าวที่คัดเลือกและตรวจแหล่งข่าวแล้ว ไม่ใช่ผลจัดอันดับ Daily Top 20 และไม่เขียนข้อมูลลง Brand_Master / Activity_Log / Salesforce. Why Now และ Sales Angle เป็นสมมติฐาน ไม่ใช่การยืนยันงบโฆษณา';
  $('#msCards').innerHTML=filtered.length?filtered.map(cardHtml).join(''):'<div class="empty">ไม่พบรายการสำหรับตัวกรองนี้ หรือยังไม่ได้เชื่อม Brand_Master</div>';
  document.querySelectorAll('[data-ms-filter]').forEach(el=>el.classList.toggle('active',el.dataset.msFilter===state.filter));
  $('#msError').textContent=state.error;
}
async function load(){
  $('#msCards').innerHTML='<div class="empty">Loading market signals…</div>';
  state.error='';state.auth='loading';state.brands=null;
  try{
    const r=await fetch('data/market-signal-examples.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('Could not load public news examples (HTTP '+r.status+')');
    const data=await r.json();
    if(!Array.isArray(data.items))throw Error('Invalid news example data');
    state.items=data.items;state.asOf=data.asOf||'';
  }catch(err){state.items=[];state.error=err.message;state.auth='error';render();return}
  const key=localStorage.getItem(LS.key)||'';
  if(!key){state.auth='no-key';render();return}
  try{
    const u=new URL(localStorage.getItem(LS.url)||API_URL);
    u.searchParams.set('action','brands');u.searchParams.set('key',key);
    u.searchParams.set('limit','500');u.searchParams.set('_ts',String(Date.now()));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    let response;
    try{response=await fetch(u.toString(),{cache:'no-store',redirect:'follow',signal:controller.signal})}
    finally{clearTimeout(timer)}
    if(!response.ok)throw Error('Brands endpoint HTTP '+response.status);
    const json=await response.json();
    if(!json.ok||!Array.isArray(json.data))throw Error('Brand_Master endpoint unavailable');
    state.brands=json.data;state.auth='connected';
  }catch(err){state.auth='error';state.error='ไม่สามารถตรวจสอบ Brand_Master ได้: '+err.message}
  render();
}
document.querySelectorAll('[data-ms-filter]').forEach(el=>el.addEventListener('click',()=>{state.filter=el.dataset.msFilter;render()}));
$('#reloadBtn').addEventListener('click',load);
load();
