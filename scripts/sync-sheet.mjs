import fs from 'node:fs/promises';

const DAILY_FILE = new URL('../docs/data/daily.json', import.meta.url);
const webAppUrl = String(process.env.RADAR_WEB_APP_URL || '').trim();
const apiKey = String(process.env.RADAR_API_KEY || '').trim();
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CONTENT_RETRY_STATUSES = new Set([401, 403, 404, 408, 429, 500, 502, 503, 504]);
const MAX_CONTENT_ATTEMPTS = 4;

if (!webAppUrl) {
  throw new Error('RADAR_WEB_APP_URL is not configured');
}

if (!apiKey) {
  throw new Error('RADAR_API_KEY is not configured');
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseJsonResponse(text, status, phase) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Apps Script returned non-JSON response during ${phase} (${status}): ${text.slice(0, 300)}`);
  }
}

function isGoogleContentUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'script.googleusercontent.com' || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

async function postAppsScript(payloadBody) {
  // Apps Script ContentService intentionally responds through a one-time
  // script.googleusercontent.com URL. Handle that redirect ourselves so the
  // mutating POST is executed exactly once. Only the safe GET to the one-time
  // content URL is retried if Google's content-serving layer is briefly stale.
  const initial = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payloadBody),
    redirect: 'manual',
    signal: AbortSignal.timeout(240000)
  });

  if (!REDIRECT_STATUSES.has(initial.status)) {
    const text = await initial.text();
    return {
      json: parseJsonResponse(text, initial.status, 'POST response'),
      status: initial.status,
      redirected: false
    };
  }

  const location = initial.headers.get('location');
  if (!location) {
    throw new Error(`Apps Script returned redirect ${initial.status} without a Location header`);
  }

  const contentUrl = new URL(location, webAppUrl).toString();
  if (!isGoogleContentUrl(contentUrl)) {
    throw new Error(`Apps Script returned an unexpected redirect host: ${new URL(contentUrl).hostname}`);
  }

  console.log(`Apps Script POST accepted (HTTP ${initial.status}); reading ContentService response.`);

  let lastStatus = 0;
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_CONTENT_ATTEMPTS; attempt++) {
    const response = await fetch(contentUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(60000)
    });
    lastStatus = response.status;
    lastText = await response.text();

    if (response.ok) {
      return {
        json: parseJsonResponse(lastText, response.status, 'ContentService response'),
        status: response.status,
        redirected: true
      };
    }

    if (!CONTENT_RETRY_STATUSES.has(response.status) || attempt === MAX_CONTENT_ATTEMPTS) {
      break;
    }

    const waitMs = 2500 * attempt;
    console.log(`ContentService response HTTP ${response.status}; retrying safe GET in ${waitMs}ms (attempt ${attempt + 1}/${MAX_CONTENT_ATTEMPTS}).`);
    await sleep(waitMs);
  }

  throw new Error(`Apps Script ContentService response failed after ${MAX_CONTENT_ATTEMPTS} attempts (HTTP ${lastStatus}): ${lastText.slice(0, 300)}`);
}

const result = await postAppsScript(payload);
const json = result.json;

if (!json.ok) {
  throw new Error(`Apps Script sync failed: ${json.error || 'unknown error'}`);
}

const data = json.data || {};
const syncedCount = Number(data.count ?? items.length);
if (syncedCount !== items.length) {
  throw new Error(`Apps Script sync count mismatch: expected ${items.length}, received ${syncedCount}`);
}

console.log(`Google Sheets sync complete: ${syncedCount} leads for ${data.discoveryDate || daily.date}.`);
