import fs from 'node:fs';
import { enrichLeads } from './gemini-enrich.mjs';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY secret not available to this workflow');
}
const daily = JSON.parse(fs.readFileSync(new URL('../docs/data/daily.json', import.meta.url), 'utf8'));
const sample = daily.leads.slice(0, 3).map(lead => ({
  ...structuredClone(lead),
  _headlines: [lead.thailandEvidence].filter(Boolean)
}));
if (sample.length !== 3) throw new Error('Daily Radar requires at least three sample leads');
const result = await enrichLeads(sample);
console.log('Gemini live test:', JSON.stringify(result));
if (result.status !== 'success' || result.accepted < 1) {
  throw new Error('Gemini live enrichment not validated: ' + result.status);
}
console.log('PASS: live structured AI response validated; no Sheet writes or emails sent.');
