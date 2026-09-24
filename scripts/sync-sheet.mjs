import fs from 'node:fs/promises';

const DAILY_FILE = new URL('../docs/data/daily.json', import.meta.url);
const webAppUrl = String(process.env.RADAR_WEB_APP_URL || '').trim();
const apiKey = String(process.env.RADAR_API_KEY || '').trim();

if (!webAppUrl) {
  throw new Error('RADAR_WEB_APP_URL is not configured');
}

if (!apiKey) {
  console.log('RADAR_API_KEY is not configured. Skipping Google Sheets sync.');
  process.exit(0);
}

const daily = JSON.parse(await fs.readFile(DAILY_FILE, 'utf8'));
const leads = Array.isArray(daily.leads) ? daily.leads : [];

if (!daily.date) throw new Error('daily.json is missing date');
if (!leads.length) throw new Error('daily.json has no leads to sync');

const items = leads.map((lead, index) => ({
  rank: index + 1,
  brand: lead.brandName || '',
  company: lead.companyName || '',
  industry: lead.industry || '',
  brandType: lead.brandType || '',
  buyingSignal: lead.buyingSignal || '',
  signalDate: lead.signalDate || '',
  whyNow: lead.whyNow || '',
  opportunityScore: lead.score ?? '',
  priority: lead.priority || '',
  revenueMin: lead.revenueMinM ?? '',
  revenueMax: lead.revenueMaxM ?? '',
  momentum: lead.momentum || '',
  thailandEvidence: lead.thailandEvidence || '',
  sourceUrl1: lead.sources?.[0]?.url || '',
  sourceUrl2: lead.sources?.[1]?.url || '',
  sourceLabel: lead.sources?.[0]?.label || ''
}));

const payload = {
  action: 'sync-radar',
  key: apiKey,
  discoveryDate: daily.date,
  engineVersion: daily.engine || 'FREE-RSS-RULES',
  items
};

const response = await fetch(webAppUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(payload),
  redirect: 'follow'
});

const text = await response.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  throw new Error(`Apps Script returned non-JSON response (${response.status}): ${text.slice(0, 300)}`);
}

if (!json.ok) {
  throw new Error(`Apps Script sync failed: ${json.error || 'unknown error'}`);
}

const data = json.data || {};
console.log(`Google Sheets sync complete: ${data.count ?? items.length} leads for ${data.discoveryDate || daily.date}.`);


async function apiGet(action, params = {}) {
  const u = new URL(webAppUrl);
  u.searchParams.set('action', action);
  u.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const r = await fetch(u, { redirect: 'follow' });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); }
  catch { throw new Error('V2 smoke '+action+' returned non-JSON: '+t.slice(0,200)); }
  if (!j.ok) throw new Error('V2 smoke '+action+' failed: '+(j.error || 'unknown'));
  return j;
}

async function apiPost(action, body = {}) {
  const r = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, key: apiKey, ...body }),
    redirect: 'follow'
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); }
  catch { throw new Error('V2 smoke '+action+' returned non-JSON: '+t.slice(0,200)); }
  if (!j.ok) throw new Error('V2 smoke '+action+' failed: '+(j.error || 'unknown'));
  return j;
}

const health = await apiGet('health');
console.log('V2_SMOKE health version=' + health.version);

const available = await apiGet('brands', { status: 'Available', limit: 10 });
if (!available.data?.length) throw new Error('V2 smoke: no Available brand');
const smokeBrand = available.data[0];

const credentialList = await apiGet('credentials', { active: 'all' });
const testName = '[TEST] V2 Live Smoke';
let testCredential = credentialList.data?.find(x => x.Credential_Name === testName);
if (!testCredential) {
  const up = await apiPost('credential-upsert', {
    name: testName,
    type: 'Media Credentials',
    industry: smokeBrand.Industry || 'All',
    tags: 'v2-smoke-test',
    driveUrl: 'https://docs.google.com/spreadsheets/d/1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo/edit',
    active: true
  });
  testCredential = { Credential_ID: up.data.credentialId, Credential_Name: testName };
}
const cid = String(testCredential.Credential_ID);

await apiPost('credential-selection', {
  brandId: smokeBrand.Brand_ID,
  credentialIds: [cid],
  recommendedIds: [cid],
  matchScores: { [cid]: 99 },
  origin: 'V2 Live Smoke Test',
  createdBy: 'GitHub Actions'
});

const readback = await apiGet('credential-matches', { brandId: smokeBrand.Brand_ID });
const ok = readback.data?.some(x =>
  String(x.Credential_ID) === cid &&
  String(x.Selected_By_User).toLowerCase() === 'true'
);
if (!ok) throw new Error('V2 smoke: selected credential missing on read-back');

console.log('V2_SMOKE_PASS brand=' + smokeBrand.Brand_ID + ' credential=' + cid);
