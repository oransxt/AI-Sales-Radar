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
