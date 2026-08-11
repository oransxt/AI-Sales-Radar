import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const OUT = new URL('../docs/data/daily.json', import.meta.url);
if (!API_KEY) throw new Error('Missing OPENAI_API_KEY');

const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const schema={
  type:'object',additionalProperties:false,
  properties:{brands:{type:'array',minItems:20,maxItems:20,items:{type:'object',additionalProperties:false,properties:{
    brand_name:{type:'string'},company_name:{type:'string'},industry:{type:'string'},brand_type:{type:'string'},
    thailand_evidence:{type:'string'},buying_signal:{type:'string'},signal_date:{type:'string'},why_now:{type:'string'},
    momentum:{type:'string'},estimated_revenue_min_m_thb:{type:'number'},estimated_revenue_max_m_thb:{type:'number'},
    source_urls:{type:'array',items:{type:'string'},minItems:1,maxItems:4},source_labels:{type:'array',items:{type:'string'},minItems:1,maxItems:4},
    scores:{type:'object',additionalProperties:false,properties:{
      thailand_relevance:{type:'integer',minimum:0,maximum:20},buying_signal_strength:{type:'integer',minimum:0,maximum:20},
      revenue_potential:{type:'integer',minimum:0,maximum:20},ooh_fit:{type:'integer',minimum:0,maximum:15},
      momentum:{type:'integer',minimum:0,maximum:10},timing:{type:'integer',minimum:0,maximum:10},evidence_quality:{type:'integer',minimum:0,maximum:5}
    },required:['thailand_relevance','buying_signal_strength','revenue_potential','ooh_fit','momentum','timing','evidence_quality']}
  },required:['brand_name','company_name','industry','brand_type','thailand_evidence','buying_signal','signal_date','why_now','momentum','estimated_revenue_min_m_thb','estimated_revenue_max_m_thb','source_urls','source_labels','scores']}}},
  required:['brands']
};

const prompt=`You are an AI Sales Opportunity Hunter for a Thailand OOH/DOOH media sales team. Today in Bangkok is ${today}.

Find exactly 20 brands with the strongest CURRENT commercial potential for OOH/DOOH media sales in THAILAND.

THAILAND-FIRST: each brand must have real Thailand evidence such as Thai operations, local launch, distributor, official store, Thailand campaign, local social/e-commerce momentum, Thai creator buzz, event, new branch, expansion or market-entry activity.

Search broadly across Thai marketing/business news, official brand/company announcements, publicly discoverable TikTok/social/e-commerce signals, launches, new branches, presenters, partnerships, funding, rebranding, events, exhibitions, hiring and expansion.

Do NOT only return big brands. Include emerging Thai/local/social-first brands with real commercial momentum, foreign brands entering Thailand, and high-upside local brands from TikTok/Instagram/e-commerce that may be ready for mass brand building.

Keep a diversified mix across industries and brand maturity.

Score each brand out of 100 using:
Thailand Relevance /20; Buying Signal /20; Revenue Potential /20; OOH Fit /15; Momentum /10; Timing /10; Evidence /5.

Revenue estimate means potential OOH/DOOH campaign revenue in MILLIONS OF THAI BAHT, not company revenue. Be commercially conservative.

Every brand must include 1-4 exact source URLs actually used. Prefer official and credible Thailand sources. Social/public marketplace sources are acceptable for emerging-brand signals. Never invent URLs.

Return concise, factual output only.`;

const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{'Authorization':`Bearer ${API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:MODEL,input:prompt,tools:[{type:'web_search',user_location:{type:'approximate',country:'TH',city:'Bangkok',region:'Bangkok',timezone:'Asia/Bangkok'}}],text:{format:{type:'json_schema',name:'thailand_daily_brand_radar',strict:true,schema}}})
});
const data=await response.json();
if(!response.ok) throw new Error(data?.error?.message||`OpenAI error ${response.status}`);
let text=data.output_text||'';
if(!text){for(const item of data.output||[])if(item.type==='message')for(const c of item.content||[])if(c.type==='output_text')text=c.text||'';}
if(!text) throw new Error('No structured output returned');
const parsed=JSON.parse(text);

function score(s){return Object.values(s||{}).reduce((a,b)=>a+(Number(b)||0),0)}
function idFor(name){return crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0,12)}
const seen=new Set();
const leads=[];
for(const b of parsed.brands||[]){
  const key=b.brand_name.trim().toLowerCase(); if(!key||seen.has(key)) continue; seen.add(key);
  leads.push({
    id:idFor(b.brand_name),brandName:b.brand_name,companyName:b.company_name,industry:b.industry,brandType:b.brand_type,
    thailandEvidence:b.thailand_evidence,buyingSignal:b.buying_signal,signalDate:b.signal_date,whyNow:b.why_now,momentum:b.momentum,
    revenueMinM:b.estimated_revenue_min_m_thb,revenueMaxM:b.estimated_revenue_max_m_thb,score:score(b.scores),scores:b.scores,
    sources:(b.source_urls||[]).map((url,i)=>({url,label:b.source_labels?.[i]||`Source ${i+1}`}))
  });
}
leads.sort((a,b)=>b.score-a.score);
await fs.mkdir(new URL('../docs/data/',import.meta.url),{recursive:true});
await fs.writeFile(OUT,JSON.stringify({date:today,generatedAt:new Date().toISOString(),leads:leads.slice(0,20)},null,2));
console.log(`Wrote ${Math.min(leads.length,20)} leads for ${today}`);
