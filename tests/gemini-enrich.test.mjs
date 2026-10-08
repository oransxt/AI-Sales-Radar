import test from 'node:test';
import assert from 'node:assert/strict';
import { groundedCanonicalName, validateInsight, applyInsight, enrichLeads } from '../scripts/gemini-enrich.mjs';

function lead(name='KFC') {
  return {
    brandName:name,companyName:name,thailandEvidence:name+' เปิดสาขาใหม่ในไทย',
    buyingSignal:'Expansion / new branches',signalDate:'2026-10-08',
    score:80,scores:{thailand_relevance:18,buying_signal_strength:18,revenue_potential:14,
      ooh_fit:14,momentum:6,timing:10,evidence_quality:5},
    sources:[{url:'https://news.google.com/rss/articles/example',label:'News'}],
    _headlines:[name+' เปิดสาขาใหม่ในไทย']
  };
}
function insight(name='KFC') {
  return {
    index:0,brandName:name,signalType:'Expansion / new branches',thailandRelevant:true,
    confidence:0.92,
    businessContext:'แบรนด์มีการเปิดสาขาใหม่ในประเทศไทยตามรายงานข่าว',
    whyNow:'การขยายสาขาอาจเป็นจังหวะที่เหมาะกับการพูดคุยถึงเป้าหมายการเติบโต',
    salesAngle:'สอบถามเป้าหมายการสื่อสารกับลูกค้าในพื้นที่สาขาใหม่',
    nextBestAction:'นัดพูดคุยเพื่อทำความเข้าใจวัตถุประสงค์และช่วงเวลาของแบรนด์'
  };
}
test('brand canonicalization must be grounded in the headline',()=>{
  assert.equal(groundedCanonicalName('KFC','KFC เปิดสาขาใหม่ในไทย'),'KFC');
  assert.equal(groundedCanonicalName('Invented','KFC เปิดสาขาใหม่ในไทย'),'');
  assert.equal(groundedCanonicalName('Launch','Launch KFC ในไทย'),'');
});
test('AI results are rejected when unsupported, low confidence, or media recommendations',()=>{
  assert.equal(validateInsight({...insight(),confidence:0.4},lead()),null);
  assert.equal(validateInsight({...insight(),thailandRelevant:false},lead()),null);
  assert.equal(validateInsight({...insight(),signalType:'Guaranteed ad budget'},lead()),null);
  assert.equal(validateInsight({...insight(),salesAngle:'Recommend OOH billboards in Bangkok immediately'},lead()),null);
  assert.equal(validateInsight({...insight(),whyNow:'https://malicious.example.com contact now'},lead()),null);
});
test('accepted AI changes only rule-defined scoring inputs',()=>{
  const l=lead();
  const accepted=applyInsight(l,{...insight(),signalType:'New campaign'},'gemini-test');
  assert.equal(accepted,true);
  assert.equal(l.scores.buying_signal_strength,16);
  assert.equal(l.scores.timing,8);
  assert.equal(l.scores.revenue_potential,14);
  assert.equal(l.ai.status,'validated');
  assert.equal(l.ai.confidence,0.92);
  assert.equal(l.whyNow,undefined);
});
test('missing key keeps all rule data unchanged',async()=>{
  const l=lead(),old=structuredClone(l);
  const result=await enrichLeads([l],{enabled:true,apiKey:''});
  assert.equal(result.status,'missing_key');
  assert.deepEqual(l,old);
});
test('valid structured JSON batch enriches via header-only key',async()=>{
  const l=lead();
  let calls=0;
  const result=await enrichLeads([l],{
    enabled:true,apiKey:'TEST_KEY',model:'gemini-3.1-flash-lite',
    fetchImpl:async(url,options)=>{
      calls++;
      assert.match(url,/generativelanguage.googleapis.com/);
      assert.equal(options.headers['x-goog-api-key'],'TEST_KEY');
      assert.ok(!url.includes('TEST_KEY'));
      assert.equal(options.body.includes('TEST_KEY'),false);
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({results:[insight()]})}]}}]})};
    }
  });
  assert.equal(calls,1);
  assert.equal(result.status,'success');
  assert.equal(result.accepted,1);
  assert.equal(l.ai.model,'gemini-3.1-flash-lite');
});
test('quota or HTTP errors stop additional calls and preserve fallback',async()=>{
  const ls=Array.from({length:22},()=>lead());
  let calls=0;
  const result=await enrichLeads(ls,{
    enabled:true,apiKey:'TEST_KEY',
    fetchImpl:async()=>{calls++;return {ok:false,status:429};}
  });
  assert.equal(calls,1);
  assert.equal(result.status,'fallback');
  assert.equal(result.accepted,0);
  assert.ok(ls.every(x=>!x.ai));
});
test('disabled flag never calls Gemini',async()=>{
  let calls=0;
  const result=await enrichLeads([lead()],{enabled:false,apiKey:'TEST_KEY',
    fetchImpl:async()=>{calls++;throw Error('Should not call');}});
  assert.equal(result.status,'disabled');
  assert.equal(calls,0);
});
