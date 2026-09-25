// AI Sales Radar V2.0.2 extension — Opportunity Prep + Credential Library
app.credentials = app.credentials || [];
app.credentialMatches = app.credentialMatches || [];
app.availableBrands = app.availableBrands || [];
app.credentialPreview = app.credentialPreview || null;
app.emailDraft = app.emailDraft || null;
app.emailDraftBrandId = app.emailDraftBrandId || null;
app.v2Cache = app.v2Cache || {availableAt:0,credentialsAt:0,matches:{}};
const V2_CACHE_MS={available:60000,credentials:300000,matches:60000};
const v2Fresh=(ts,ttl)=>!!ts&&(Date.now()-ts)<ttl;

function v2CredentialTags(c){
  return String(c.Tags||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
}
function v2CredentialScore(l,c){
  let s=0;
  const li=String(l.industry||'').toLowerCase(), ci=String(c.Industry||'').toLowerCase();
  if(!ci||ci==='all') s+=18;
  else if(li===ci||li.includes(ci)||ci.includes(li)) s+=45;
  const hay=(String(l.buyingSignal||'')+' '+String(l.whyNow||'')+' '+String(l.industry||'')).toLowerCase();
  v2CredentialTags(c).forEach(t=>{ if(t&&hay.includes(t)) s+=8; });
  const type=String(c.Credential_Type||'');
  if(type==='Industry Overview') s+=10;
  if(type==='Case Study') s+=8;
  if(type==='New Launches') s+=6;
  if(type==='Media Credentials') s+=7;
  return Math.min(100,s);
}
function v2BrandFromMaster(r){
  return {
    id:String(r.Brand_ID||''),
    brandName:r.Brand_Name||'',
    companyName:r.Company_Name||'',
    industry:r.Industry||'',
    brandType:r.Brand_Type||'',
    buyingSignal:r.Last_Buying_Signal||'',
    signalDate:r.Last_Signal_Date||'',
    whyNow:r.Why_Now||'',
    score:Number(r.Opportunity_Score||0),
    priority:r.Priority||'',
    revenueMinM:Number(r.Revenue_Min_M_THB||0),
    revenueMaxM:Number(r.Revenue_Max_M_THB||0),
    salesforceStatus:r.Salesforce_Status||'Available',
    sources:[r.Primary_Source_URL].filter(Boolean)
  };
}
async function v2LoadAvailableBrands(redraw,force){
  if(redraw===undefined) redraw=true;if(force===undefined) force=false;
  if(!apiKey()){if(redraw)render();return}
  if(!force&&app.availableBrands.length&&v2Fresh(app.v2Cache.availableAt,V2_CACHE_MS.available)){if(redraw)render();return}
  try{
    const d=await apiGet('brands',{status:'Available',limit:500});
    app.availableBrands=(d.data||[]).map(v2BrandFromMaster);
    app.v2Cache.availableAt=Date.now();
    setConnection(true);
  }catch(err){setConnection(false,err.message)}
  if(redraw)render()
}

function v2RecommendedCredentials(l){
  return (app.credentials||[])
    .filter(c=>String(c.Active).toLowerCase()!=='false')
    .map(c=>Object.assign({},c,{_score:v2CredentialScore(l,c)}))
    .sort((a,b)=>b._score-a._score);
}
async function v2LoadCredentials(redraw,force){
  if(redraw===undefined) redraw=true;if(force===undefined) force=false;
  if(!apiKey()){if(redraw)render();return}
  if(!force&&app.credentials.length&&v2Fresh(app.v2Cache.credentialsAt,V2_CACHE_MS.credentials)){if(redraw)render();return}
  try{
    const d=await apiGet('credentials',{active:'true'});
    app.credentials=d.data||[];
    app.v2Cache.credentialsAt=Date.now();
    setConnection(true);
  }catch(err){setConnection(false,err.message)}
  if(redraw)render()
}
async function v2LoadMatches(brandId,force){
  if(force===undefined) force=false;
  if(!apiKey()||!brandId){app.credentialMatches=[];return}
  const cached=app.v2Cache.matches[brandId];
  if(!force&&cached&&v2Fresh(cached.at,V2_CACHE_MS.matches)){app.credentialMatches=cached.data||[];return}
  try{
    const d=await apiGet('credential-matches',{brandId:brandId});
    app.credentialMatches=d.data||[];
    app.v2Cache.matches[brandId]={at:Date.now(),data:app.credentialMatches};
    setConnection(true);
  }catch(err){
    app.credentialMatches=cached?.data||[];
    setConnection(false,err.message)
  }
}
function v2OpportunityPrep(){
  const avail=(app.availableBrands||[]).slice().sort((a,b)=>(b.score||0)-(a.score||0));
  if(!app.selected||!avail.find(x=>x.id===app.selected)) app.selected=avail[0]?avail[0].id:null;
  const l=avail.find(x=>x.id===app.selected);
  $('#title').textContent='V2 OPPORTUNITY PREP';
  $('#subtitle').textContent='Available Brand → Credential Matching → Selected Sales Pack';
  if(!l){
    $('#content').innerHTML='<div class="full-panel"><div class="empty">No Available brands yet. Mark a brand Available in Daily Radar first.</div></div>';
    return;
  }

  const savedMatches=(app.credentialMatches||[]);
  const hasSavedSelection=savedMatches.length>0;
  const priorSelected=new Set(
    savedMatches
      .filter(x=>String(x.Selected_By_User).toLowerCase()==='true')
      .map(x=>String(x.Credential_ID))
  );
  const recs=v2RecommendedCredentials(l);
  const topIds=new Set(recs.filter(x=>x._score>=35).slice(0,8).map(x=>String(x.Credential_ID)));

  const leftRows=avail.map(x=>
    '<tr data-prep-brand="'+esc(x.id)+'" class="'+(x.id===l.id?'selected':'')+'">'+
    '<td><div class="brand-name">'+esc(x.brandName)+'</div></td>'+
    '<td>'+esc(x.industry)+'</td>'+
    '<td>'+esc(x.buyingSignal)+'</td>'+
    '<td>'+fmtM(x.revenueMinM)+'–'+fmtM(x.revenueMaxM)+'</td></tr>'
  ).join('');

  const credRows=recs.length ? recs.map(c=>{
    const id=String(c.Credential_ID||'');
    const checked=hasSavedSelection ? priorSelected.has(id) : topIds.has(id);
    return '<label class="credential-item">'+
      '<input type="checkbox" data-cred="'+esc(id)+'" '+(checked?'checked':'')+'>'+
      '<div><div class="credential-name">'+esc(c.Credential_Name)+'</div>'+
      '<div class="sub">'+esc(c.Credential_Type)+' · '+esc(c.Industry||'All')+' · Match '+c._score+'</div>'+
      (c.Google_Drive_URL?'<a class="link" target="_blank" rel="noopener" href="'+esc(c.Google_Drive_URL)+'">Open Drive ↗</a>':'')+
      '</div></label>';
  }).join('') : '<div class="empty">No credentials yet. Add them in Credential Library.</div>';

  $('#content').innerHTML=
    '<div class="workspace">'+
      '<div class="panel"><div class="filters"><strong>Available Brands</strong><div class="spacer"></div><span class="sub">'+avail.length+' brands</span></div>'+
      '<div class="table-wrap"><table><thead><tr><th>Brand</th><th>Industry</th><th>Signal</th><th>Potential</th></tr></thead><tbody>'+leftRows+'</tbody></table></div></div>'+
      '<div class="panel"><div class="detail"><span class="badge">AVAILABLE</span><h3>'+esc(l.brandName)+'</h3>'+
      '<div class="sub">'+esc(l.industry)+' · '+esc(l.buyingSignal)+'</div>'+
      '<div class="section"><strong>Why Now</strong><div class="sub v2-copy">'+esc(l.whyNow)+'</div></div>'+
      '<div class="section"><strong>Recommended Credential Pack</strong><div class="sub">Rule-based match by Industry + Signal + Tags. Multi-select allowed.</div>'+
      '<div class="credential-list">'+credRows+'</div></div>'+
      '<div class="section"><button class="btn primary" id="saveCredentialPack">Save Credential Pack</button> <button class="btn" id="selectRecommended">Select Recommended</button></div>'+      '<div class="next-stage-card"><div><span class="next-stage-badge">EMAIL DRAFTING</span><strong>Continue from Opportunity Prep to Email Draft</strong><div class="sub">Uses the saved Brand context + Buying Signal + selected Credential Pack. Draft only — Sales reviews and sends.</div></div><button class="btn primary" id="openEmailDrafting">Open Email Drafting →</button></div>'+
      '</div></div></div>';

  document.querySelectorAll('[data-prep-brand]').forEach(r=>{
    r.onclick=async()=>{
      app.selected=r.dataset.prepBrand;
      await v2LoadMatches(app.selected);
      v2OpportunityPrep();
    };
  });
  const sr=$('#selectRecommended');
  if(sr) sr.onclick=()=>document.querySelectorAll('[data-cred]').forEach(cb=>{cb.checked=topIds.has(cb.dataset.cred);});
  const openEmail=$('#openEmailDrafting');
  if(openEmail) openEmail.onclick=async()=>{
    app.view='email';
    app.emailDraft=null;
    app.emailDraftBrandId=l.id;
    await v2LoadMatches(l.id);
    v2EmailDrafting();
  };
  const save=$('#saveCredentialPack');
  if(save) save.onclick=async()=>{
    const ids=[...document.querySelectorAll('[data-cred]:checked')].map(x=>x.dataset.cred);
    const scores={};
    recs.forEach(c=>scores[String(c.Credential_ID)]=c._score);
    try{
      await apiPost('credential-selection',{
        brandId:l.id,
        credentialIds:ids,
        recommendedIds:[...topIds],
        matchScores:scores,
        origin:'V2 Opportunity Prep',
        createdBy:'AI Sales Radar V2'
      });
      await v2LoadMatches(l.id,true);
      alert('Credential Pack saved.');
      v2OpportunityPrep();
    }catch(err){
      alert('Save failed: '+err.message);
    }
  };
}
function v2CredentialLibrary(){
  $('#title').textContent='CREDENTIAL LIBRARY';
  $('#subtitle').textContent='Paste one Google Drive link → analyze → review → save';

  const p=app.credentialPreview;
  const typeOptions=['Industry Overview','Case Study','New Launches','Media Credentials'];
  const preview=p ? (
    '<div class="smart-preview">'+
      '<div class="smart-preview-head"><div><span class="badge">ANALYZED</span><h3>'+esc(p.fileName||p.credentialName||'Credential')+'</h3>'+
      '<div class="sub">'+esc(p.analysisSource||'')+' · Confidence '+esc(p.confidence||0)+'/100</div></div>'+
      '<div class="smart-status '+(p.active?'active':'inactive')+'">'+(p.active?'ACTIVE':'INACTIVE')+'</div></div>'+
      '<div class="smart-grid">'+
        '<label>Credential Name<input id="previewName" value="'+esc(p.credentialName||p.fileName||'')+'"></label>'+
        '<label>Credential Type<select id="previewType">'+typeOptions.map(t=>'<option '+(p.credentialType===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
        '<label>Industry<input id="previewIndustry" value="'+esc(p.industry||'')+'"></label>'+
        '<label class="wide">Tags<input id="previewTags" value="'+esc(p.tags||'')+'"></label>'+
      '</div>'+
      '<div class="smart-meta">'+
        '<div><span>Source modified</span><strong>'+esc(p.sourceLastModified||'—')+'</strong></div>'+
        '<div><span>Date added</span><strong>Auto on save</strong></div>'+
        '<div><span>Record updated</span><strong>Auto on save</strong></div>'+
        '<div><span>File type</span><strong>'+esc(p.mimeType||'—')+'</strong></div>'+
      '</div>'+
      '<div class="settings-actions"><button class="btn primary" id="confirmCredential">Confirm & Add</button><button class="btn" id="reanalyzeCredential">Re-analyze</button><button class="btn" id="cancelCredentialPreview">Cancel</button></div>'+
    '</div>'
  ) : '';

  const body=(app.credentials||[]).map(c=>
    '<tr><td><div class="brand-name">'+esc(c.Credential_Name)+'</div><div class="sub">'+esc(c.Analysis_Source||'')+'</div></td>'+
    '<td>'+esc(c.Credential_Type)+'</td>'+
    '<td>'+esc(c.Industry)+'</td>'+
    '<td>'+esc(c.Tags)+'</td>'+
    '<td><span class="smart-status '+(String(c.Active).toLowerCase()==='true'?'active':'inactive')+'">'+(String(c.Active).toLowerCase()==='true'?'ACTIVE':'INACTIVE')+'</span></td>'+
    '<td>'+esc(c.Source_Last_Modified||'—')+'</td>'+
    '<td>'+esc(c.Last_Updated||'—')+'</td>'+
    '<td>'+(c.Google_Drive_URL?'<a class="link" target="_blank" rel="noopener" href="'+esc(c.Google_Drive_URL)+'">Open ↗</a>':'')+'</td></tr>'
  ).join('');

  $('#content').innerHTML=
    '<div class="full-panel">'+
      '<div class="smart-intake">'+
        '<div><span class="next-stage-badge">V2.0.1 · SMART INTAKE</span><h3>Paste Google Drive Link</h3>'+
        '<div class="sub">System reads Drive metadata and, for native Google Docs / Slides / Sheets, available text content. You review before saving.</div></div>'+
        '<div class="smart-url-row"><input id="smartDriveUrl" placeholder="https://drive.google.com/..."><button class="btn primary" id="analyzeCredential">Analyze Link</button></div>'+
      '</div>'+
      preview+
      '<div class="section"><div class="filters"><strong>Credential Library</strong><div class="spacer"></div><span class="sub">'+(app.credentials||[]).length+' active credentials</span></div>'+
      '<div class="table-wrap v2-table"><table><thead><tr><th>Name</th><th>Type</th><th>Industry</th><th>Tags</th><th>Active</th><th>Source Modified</th><th>Record Updated</th><th>Drive</th></tr></thead><tbody>'+body+'</tbody></table></div></div>'+
    '</div>';

  const analyze=async(url)=>{
    const driveUrl=String(url||'').trim();
    if(!driveUrl){ alert('Paste a Google Drive file URL first.'); return; }
    const btn=$('#analyzeCredential');
    if(btn){ btn.disabled=true; btn.textContent='Analyzing…'; }
    try{
      const d=await apiPost('credential-analyze',{driveUrl:driveUrl});
      app.credentialPreview=d.data||null;
      v2CredentialLibrary();
    }catch(err){
      alert('Analyze failed: '+err.message);
      if(btn){ btn.disabled=false; btn.textContent='Analyze Link'; }
    }
  };

  $('#analyzeCredential').onclick=()=>analyze($('#smartDriveUrl').value);
  const re=$('#reanalyzeCredential');
  if(re) re.onclick=()=>analyze(app.credentialPreview?.driveUrl||'');
  const cancel=$('#cancelCredentialPreview');
  if(cancel) cancel.onclick=()=>{app.credentialPreview=null;v2CredentialLibrary();};

  const confirm=$('#confirmCredential');
  if(confirm) confirm.onclick=async()=>{
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
    confirm.disabled=true;
    confirm.textContent='Saving…';
    try{
      await apiPost('credential-upsert',payload);
      app.credentialPreview=null;
      await v2LoadCredentials(false,true);
      v2CredentialLibrary();
    }catch(err){
      confirm.disabled=false;
      confirm.textContent='Confirm & Add';
      alert('Save failed: '+err.message);
    }
  };
}


function v2SelectedCredentialRows(){
  const selected=(app.credentialMatches||[]).filter(x=>String(x.Selected_By_User).toLowerCase()==='true');
  const seen=new Set();
  return selected.filter(x=>{
    const id=String(x.Credential_ID||'');
    if(!id||seen.has(id))return false;
    seen.add(id);return true;
  });
}

function v2EmailDrafting(){
  const avail=(app.availableBrands||[]).slice().sort((a,b)=>(b.score||0)-(a.score||0));
  if(!app.selected||!avail.find(x=>x.id===app.selected))app.selected=avail[0]?.id||null;
  const l=avail.find(x=>x.id===app.selected);

  $('#title').textContent='EMAIL DRAFTING';
  $('#subtitle').textContent='Available Brand → Sales Context → Draft → Human Review → Gmail Draft';

  if(!l){
    $('#content').innerHTML='<div class="full-panel"><div class="empty">No Available brands yet. Mark a brand Available first.</div></div>';
    return;
  }

  const selected=v2SelectedCredentialRows();
  const draft=(app.emailDraftBrandId===l.id)?app.emailDraft:null;
  const savedCreds=selected.length
    ? selected.map(x=>'<div class="email-cred-chip">✓ '+esc(x.Credential_Name||x.Credential_ID)+'</div>').join('')
    : '<div class="notice">No saved Credential Pack yet. You can still draft, but saving relevant credentials first will give the email better context.</div>';

  const brandRows=avail.map(x=>
    '<tr data-email-brand="'+esc(x.id)+'" class="'+(x.id===l.id?'selected':'')+'">'+
    '<td><div class="brand-name">'+esc(x.brandName)+'</div><div class="sub">'+esc(x.industry)+'</div></td>'+
    '<td>'+esc(x.buyingSignal)+'</td>'+
    '<td><span class="priority">'+esc(x.priority||'—')+'</span></td></tr>'
  ).join('');

  const draftPanel=draft ? (
    '<div class="email-draft-card">'+
      '<div class="email-draft-head"><div><span class="badge">DRAFT READY</span><h3>'+esc(l.brandName)+'</h3>'+
      '<div class="sub">'+esc(draft.engine||'Draft engine')+' · Human review required</div></div>'+
      '<div class="smart-status active">NOT SENT</div></div>'+
      '<div class="email-insight-grid">'+
        '<div><span>Sales Angle</span><strong>'+esc(draft.salesAngle||'—')+'</strong></div>'+
        '<div><span>Media Direction</span><strong>'+esc(draft.mediaDirection||'—')+'</strong></div>'+
        '<div><span>Next Best Action</span><strong>'+esc(draft.nextBestAction||'—')+'</strong></div>'+
      '</div>'+
      '<div class="email-fields">'+
        '<label>Recipient<input id="emailRecipient" type="email" placeholder="name@company.com" value="'+esc(draft.recipient||'')+'"></label>'+
        '<label>Subject<input id="emailSubject" value="'+esc(draft.subject||'')+'"></label>'+
        '<label class="wide">Email Body<textarea id="emailBody" rows="16">'+esc(draft.body||'')+'</textarea></label>'+
      '</div>'+
      '<div class="human-control-note"><strong>Human Control:</strong> Creating a Gmail Draft does not send the email. Sales must open Gmail, review and press Send manually.</div>'+
      '<div class="settings-actions">'+
        '<button class="btn primary" id="createGmailDraft">Create Gmail Draft</button>'+
        '<button class="btn" id="regenerateEmailDraft">Regenerate</button>'+
        (draft.gmailUrl?'<a class="btn" target="_blank" rel="noopener" href="'+esc(draft.gmailUrl)+'">Open Gmail Drafts ↗</a>':'')+
      '</div>'+
    '</div>'
  ) : (
    '<div class="email-empty-state">'+
      '<div class="email-empty-icon">✦</div>'+
      '<h3>Ready to draft for '+esc(l.brandName)+'</h3>'+
      '<div class="sub">The draft will use the latest Buying Signal, Why Now and saved Credential Pack. It will not invent client budget, campaign timing or media availability.</div>'+
      '<button class="btn primary" id="generateEmailDraft">Generate Email Draft</button>'+
    '</div>'
  );

  $('#content').innerHTML=
    '<div class="workspace email-workspace">'+
      '<div class="panel"><div class="filters"><strong>Available Brands</strong><div class="spacer"></div><span class="sub">'+avail.length+' brands</span></div>'+
      '<div class="table-wrap"><table><thead><tr><th>Brand</th><th>Signal</th><th>Priority</th></tr></thead><tbody>'+brandRows+'</tbody></table></div></div>'+
      '<div class="panel email-panel">'+
        '<div class="detail"><span class="badge">AVAILABLE</span><h3>'+esc(l.brandName)+'</h3><div class="sub">'+esc(l.industry)+' · '+esc(l.buyingSignal)+'</div>'+
        '<div class="section"><strong>Why Now</strong><div class="sub v2-copy">'+esc(l.whyNow||'—')+'</div></div>'+
        '<div class="section"><strong>Saved Credential Pack</strong><div class="email-credential-pack">'+savedCreds+'</div></div>'+
        '<div class="section email-controls"><div class="email-control-grid">'+
          '<label>Language<select id="draftLanguage"><option>Thai</option><option>English</option></select></label>'+
          '<label>Tone<select id="draftTone"><option>Professional / Consultative</option><option>Warm / Relationship-led</option><option>Concise / Executive</option></select></label>'+
          '<label class="wide">Preferred CTA<input id="draftCta" placeholder="ขอนัดพูดคุยสั้น ๆ เพื่อแชร์แนวทางสื่อที่เหมาะกับช่วงนี้"></label>'+
        '</div></div>'+
        draftPanel+
        '</div></div>'+
    '</div>';

  document.querySelectorAll('[data-email-brand]').forEach(r=>{
    r.onclick=async()=>{
      app.selected=r.dataset.emailBrand;
      app.emailDraft=null;
      app.emailDraftBrandId=app.selected;
      await v2LoadMatches(app.selected);
      v2EmailDrafting();
    };
  });

  const generate=async()=>{
    const language=$('#draftLanguage')?.value||'Thai';
    const tone=$('#draftTone')?.value||'Professional / Consultative';
    const cta=$('#draftCta')?.value?.trim()||'';
    const btn=$('#generateEmailDraft')||$('#regenerateEmailDraft');
    if(btn){btn.disabled=true;btn.textContent='Generating…';}
    try{
      const d=await apiPost('email-draft-generate',{
        brandId:l.id,
        language,
        tone,
        cta,
        origin:'Dashboard Email Drafting',
        createdBy:'AI Sales Radar'
      });
      app.emailDraft=d.data||null;
      app.emailDraftBrandId=l.id;
      v2EmailDrafting();
    }catch(err){
      if(btn){btn.disabled=false;btn.textContent=btn.id==='regenerateEmailDraft'?'Regenerate':'Generate Email Draft';}
      alert('Draft failed: '+err.message);
    }
  };

  const gen=$('#generateEmailDraft');
  if(gen)gen.onclick=generate;
  const regen=$('#regenerateEmailDraft');
  if(regen)regen.onclick=generate;

  const create=$('#createGmailDraft');
  if(create)create.onclick=async()=>{
    const recipient=$('#emailRecipient').value.trim();
    const subject=$('#emailSubject').value.trim();
    const body=$('#emailBody').value.trim();
    if(!recipient){alert('Please enter the recipient email before creating a Gmail Draft.');return;}
    create.disabled=true;create.textContent='Creating Gmail Draft…';
    try{
      const d=await apiPost('gmail-draft-create',{
        draftId:draft.draftId,
        brandId:l.id,
        recipient,
        subject,
        body,
        origin:'Dashboard Email Drafting',
        createdBy:'AI Sales Radar'
      });
      app.emailDraft={...draft,recipient,subject,body,...(d.data||{})};
      alert('Gmail Draft created. Nothing has been sent.');
      v2EmailDrafting();
    }catch(err){
      create.disabled=false;create.textContent='Create Gmail Draft';
      alert('Gmail Draft failed: '+err.message);
    }
  };
}

const v2BaseRender=render;
render=function(){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===app.view));
  $('#sidePipeline').textContent=fmtM(pipeline());
  setConnection(app.connected,app.lastError);
  if(app.view==='prep') return v2OpportunityPrep();
  if(app.view==='credentials') return v2CredentialLibrary();
  if(app.view==='email') return v2EmailDrafting();
  return v2BaseRender();
};

document.addEventListener('click',async e=>{
  const b=e.target.closest('#nav [data-view="prep"],#nav [data-view="credentials"],#nav [data-view="email"]');
  if(!b)return;
  app.view=b.dataset.view;
  if(app.view==='prep'){
    await Promise.all([v2LoadAvailableBrands(false),v2LoadCredentials(false)]);
    if(!app.selected||!app.availableBrands.find(x=>x.id===app.selected))app.selected=app.availableBrands[0]?.id||null;
    await v2LoadMatches(app.selected)
  }else if(app.view==='credentials'){
    await v2LoadCredentials(false)
  }else if(app.view==='email'){
    await Promise.all([v2LoadAvailableBrands(false),v2LoadCredentials(false)]);
    if(!app.selected||!app.availableBrands.find(x=>x.id===app.selected))app.selected=app.availableBrands[0]?.id||null;
    app.emailDraft=null;app.emailDraftBrandId=app.selected;
    await v2LoadMatches(app.selected)
  }
  render()
},true);

const v2BaseReload=$('#reloadBtn').onclick;
$('#reloadBtn').onclick=async()=>{
  if(app.view==='prep'){
    await Promise.all([v2LoadAvailableBrands(false,true),v2LoadCredentials(false,true)]);
    if(!app.selected||!app.availableBrands.find(x=>x.id===app.selected))app.selected=app.availableBrands[0]?.id||null;
    await v2LoadMatches(app.selected,true);
    render();return
  }
  if(app.view==='credentials'){
    await v2LoadCredentials(false,true);
    render();return
  }
  if(app.view==='email'){
    await Promise.all([v2LoadAvailableBrands(false,true),v2LoadCredentials(false,true)]);
    if(!app.selected||!app.availableBrands.find(x=>x.id===app.selected))app.selected=app.availableBrands[0]?.id||null;
    await v2LoadMatches(app.selected,true);
    app.emailDraft=null;app.emailDraftBrandId=app.selected;
    render();return
  }
  return v2BaseReload()
};
