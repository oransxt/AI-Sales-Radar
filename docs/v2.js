// AI Sales Radar V2.0 extension — Opportunity Prep + Credential Library
app.credentials = app.credentials || [];
app.credentialMatches = app.credentialMatches || [];

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
function v2RecommendedCredentials(l){
  return (app.credentials||[])
    .filter(c=>String(c.Active).toLowerCase()!=='false')
    .map(c=>Object.assign({},c,{_score:v2CredentialScore(l,c)}))
    .sort((a,b)=>b._score-a._score);
}
async function v2LoadCredentials(redraw){
  if(redraw===undefined) redraw=true;
  if(!apiKey()){ app.credentials=[]; if(redraw) render(); return; }
  try{
    const d=await apiGet('credentials',{active:'true'});
    app.credentials=d.data||[];
    setConnection(true);
  }catch(err){
    app.credentials=[];
    setConnection(false,err.message);
  }
  if(redraw) render();
}
async function v2LoadMatches(brandId){
  if(!apiKey()||!brandId){ app.credentialMatches=[]; return; }
  try{
    const d=await apiGet('credential-matches',{brandId:brandId});
    app.credentialMatches=d.data||[];
  }catch(err){
    app.credentialMatches=[];
    setConnection(false,err.message);
  }
}
function v2OpportunityPrep(){
  const avail=filtered(true);
  if(!app.selected||!avail.find(x=>x.id===app.selected)) app.selected=avail[0]?avail[0].id:null;
  const l=avail.find(x=>x.id===app.selected);
  $('#title').textContent='V2 OPPORTUNITY PREP';
  $('#subtitle').textContent='Available Brand → Credential Matching → Selected Sales Pack';
  if(!l){
    $('#content').innerHTML='<div class="full-panel"><div class="empty">No Available brands yet. Mark a brand Available in Daily Radar first.</div></div>';
    return;
  }

  const priorSelected=new Set(
    (app.credentialMatches||[])
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
    const checked=priorSelected.has(id)||topIds.has(id);
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
      '<div class="section"><button class="btn primary" id="saveCredentialPack">Save Credential Pack</button> <button class="btn" id="selectRecommended">Select Recommended</button></div>'+
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
      await v2LoadMatches(l.id);
      alert('Credential Pack saved.');
      v2OpportunityPrep();
    }catch(err){
      alert('Save failed: '+err.message);
    }
  };
}
function v2CredentialLibrary(){
  $('#title').textContent='CREDENTIAL LIBRARY';
  $('#subtitle').textContent='Google Drive links for V2 matching';
  const body=(app.credentials||[]).map(c=>
    '<tr><td><div class="brand-name">'+esc(c.Credential_Name)+'</div></td>'+
    '<td>'+esc(c.Credential_Type)+'</td>'+
    '<td>'+esc(c.Industry)+'</td>'+
    '<td>'+esc(c.Tags)+'</td>'+
    '<td>'+(c.Google_Drive_URL?'<a class="link" target="_blank" rel="noopener" href="'+esc(c.Google_Drive_URL)+'">Open ↗</a>':'')+'</td></tr>'
  ).join('');
  $('#content').innerHTML=
    '<div class="full-panel"><div class="notice good">4 types: Industry Overview · Case Study · New Launches · Media Credentials</div>'+
    '<div class="credential-form">'+
      '<select id="credType"><option>Industry Overview</option><option>Case Study</option><option>New Launches</option><option>Media Credentials</option></select>'+
      '<input id="credName" placeholder="Credential name">'+
      '<input id="credIndustry" placeholder="Industry e.g. Automotive">'+
      '<input id="credTags" placeholder="Tags comma-separated">'+
      '<input id="credUrl" placeholder="Google Drive URL">'+
      '<button class="btn primary" id="addCredential">Add Credential</button>'+
    '</div>'+
    '<div class="table-wrap v2-table"><table><thead><tr><th>Name</th><th>Type</th><th>Industry</th><th>Tags</th><th>Drive</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
  $('#addCredential').onclick=async()=>{
    const payload={
      type:$('#credType').value,
      name:$('#credName').value.trim(),
      industry:$('#credIndustry').value.trim(),
      tags:$('#credTags').value.trim(),
      driveUrl:$('#credUrl').value.trim(),
      active:true
    };
    if(!payload.name||!payload.driveUrl){ alert('Credential name and Google Drive URL are required.'); return; }
    try{
      await apiPost('credential-upsert',payload);
      await v2LoadCredentials(false);
      v2CredentialLibrary();
    }catch(err){ alert('Save failed: '+err.message); }
  };
}

const v2BaseRender=render;
render=function(){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===app.view));
  $('#sidePipeline').textContent=fmtM(pipeline());
  setConnection(app.connected,app.lastError);
  if(app.view==='prep') return v2OpportunityPrep();
  if(app.view==='credentials') return v2CredentialLibrary();
  return v2BaseRender();
};

document.addEventListener('click',async e=>{
  const b=e.target.closest('#nav [data-view="prep"],#nav [data-view="credentials"]');
  if(!b) return;
  app.view=b.dataset.view;
  if(app.view==='prep'){
    await v2LoadCredentials(false);
    await v2LoadMatches(app.selected);
  }else{
    await v2LoadCredentials(false);
  }
  render();
},true);
