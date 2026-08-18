const RADAR = {
  version: '1.9.5',
  spreadsheetId: '1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo',
  sheets: {
    brands: 'Brand_Master',
    activity: 'Activity_Log',
    radar: 'Daily_Radar',
    config: 'Config'
  },
  statuses: ['Not Checked', 'Available', 'Has Owner', 'Existing Client', 'Skip'],
  activityTypes: ['MASTER_IMPORT', 'RADAR_DETECTED', 'SIGNAL_UPDATED', 'STATUS_CHANGED', 'CREDENTIAL_SELECTED', 'NOTE_ADDED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Sales Radar')
    .addItem('Setup API Bridge', 'setupBridge')
    .addItem('Rotate API Key', 'rotateApiKey')
    .addItem('Show Web App URL', 'showWebAppUrl')
    .addToUi();
}

function setupBridge() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', RADAR.spreadsheetId);
  let key = props.getProperty('RADAR_API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('RADAR_API_KEY', key);
  }
  upsertConfig_('Data Layer Version', RADAR.version);
  upsertConfig_('API Bridge', 'Google Apps Script');
  upsertConfig_('API Bridge Status', 'Configured - deploy as Web App');
  Logger.log('RADAR_API_KEY: ' + key);
  Logger.log('Web App URL after deployment: ' + (ScriptApp.getService().getUrl() || 'Not deployed yet'));
  return { ok: true, version: RADAR.version, apiKey: key, webAppUrl: ScriptApp.getService().getUrl() || '' };
}

function rotateApiKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('RADAR_API_KEY', key);
  Logger.log('NEW RADAR_API_KEY: ' + key);
  return key;
}

function showWebAppUrl() {
  const url = ScriptApp.getService().getUrl() || 'Not deployed yet';
  SpreadsheetApp.getUi().alert('AI Sales Radar Web App URL', url, SpreadsheetApp.getUi().ButtonSet.OK);
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    requireKey_(p.key);
    const action = String(p.action || 'health').toLowerCase();

    if (action === 'health') {
      return json_({ ok: true, version: RADAR.version, time: now_(), spreadsheetId: getSpreadsheet_().getId() });
    }
    if (action === 'daily-radar') {
      return json_({ ok: true, data: getDailyRadar_(p.date || '', p.status || '') });
    }
    if (action === 'brands') {
      return json_({ ok: true, data: getBrands_(p.status || '', Number(p.limit || 500)) });
    }
    if (action === 'activities') {
      return json_({ ok: true, data: getActivities_(p.brandId || '', Number(p.limit || 200)) });
    }
    return json_({ ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    requireKey_(body.key);
    const action = String(body.action || '').toLowerCase();

    if (action === 'status') {
      return json_({ ok: true, data: updateStatus_(body) });
    }
    if (action === 'activity') {
      return json_({ ok: true, data: addActivity_(body) });
    }
    if (action === 'sync-radar') {
      return json_({ ok: true, data: syncRadar_(body) });
    }
    return json_({ ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: err.message }, 500);
  }
}

function getDailyRadar_(dateFilter, statusFilter) {
  const rows = readObjects_(RADAR.sheets.radar);
  let out = rows;
  if (dateFilter) out = out.filter(r => String(r.Discovery_Date) === String(dateFilter));
  if (!dateFilter && out.length) {
    const latest = out.map(r => String(r.Discovery_Date || '')).sort().pop();
    out = out.filter(r => String(r.Discovery_Date) === latest);
  }
  if (statusFilter) out = out.filter(r => String(r.Salesforce_Status) === String(statusFilter));
  return out.sort((a, b) => Number(a.Daily_Rank || 999) - Number(b.Daily_Rank || 999));
}

function getBrands_(statusFilter, limit) {
  let rows = readObjects_(RADAR.sheets.brands);
  if (statusFilter) rows = rows.filter(r => String(r.Salesforce_Status) === String(statusFilter));
  rows.sort((a, b) => String(b.Last_Seen || '').localeCompare(String(a.Last_Seen || '')));
  return rows.slice(0, Math.max(1, Math.min(limit || 500, 2000)));
}

function getActivities_(brandId, limit) {
  let rows = readObjects_(RADAR.sheets.activity);
  if (brandId) rows = rows.filter(r => String(r.Brand_ID) === String(brandId));
  rows.reverse();
  return rows.slice(0, Math.max(1, Math.min(limit || 200, 2000)));
}

function updateStatus_(body) {
  const brandId = String(body.brandId || '').trim();
  const newStatus = String(body.status || '').trim();
  if (!brandId) throw new Error('brandId is required');
  if (!RADAR.statuses.includes(newStatus)) throw new Error('Invalid status: ' + newStatus);

  const ss = getSpreadsheet_();
  const brandSheet = ss.getSheetByName(RADAR.sheets.brands);
  const brandData = valuesWithHeaders_(brandSheet);
  const idCol = brandData.map.Brand_ID;
  const statusCol = brandData.map.Salesforce_Status;
  const nameCol = brandData.map.Brand_Name;
  const rowIndex = findRowByValue_(brandData.values, idCol, brandId);
  if (rowIndex < 2) throw new Error('Brand not found: ' + brandId);

  const oldStatus = String(brandSheet.getRange(rowIndex, statusCol + 1).getValue() || 'Not Checked');
  brandSheet.getRange(rowIndex, statusCol + 1).setValue(newStatus);
  const brandName = String(brandSheet.getRange(rowIndex, nameCol + 1).getValue() || brandId);

  const radarSheet = ss.getSheetByName(RADAR.sheets.radar);
  const radarData = valuesWithHeaders_(radarSheet);
  if (radarData.map.Brand_ID !== undefined && radarData.map.Salesforce_Status !== undefined) {
    for (let r = radarData.values.length - 1; r >= 1; r--) {
      if (String(radarData.values[r][radarData.map.Brand_ID]) === brandId) {
        radarSheet.getRange(r + 1, radarData.map.Salesforce_Status + 1).setValue(newStatus);
        break;
      }
    }
  }

  appendActivity_({
    brandId,
    brandName,
    type: 'STATUS_CHANGED',
    oldStatus,
    newStatus,
    details: body.details || ('Salesforce status changed from ' + oldStatus + ' to ' + newStatus),
    origin: body.origin || 'Dashboard',
    createdBy: body.createdBy || 'AI Sales Radar Web'
  });

  return { brandId, brandName, oldStatus, newStatus };
}

function addActivity_(body) {
  const brandId = String(body.brandId || '').trim();
  const type = String(body.type || 'NOTE_ADDED').trim();
  if (!brandId) throw new Error('brandId is required');
  if (!RADAR.activityTypes.includes(type)) throw new Error('Invalid activity type: ' + type);
  const brand = findBrand_(brandId);
  if (!brand) throw new Error('Brand not found: ' + brandId);
  return appendActivity_({
    brandId,
    brandName: brand.Brand_Name,
    type,
    oldStatus: body.oldStatus || '',
    newStatus: body.newStatus || brand.Salesforce_Status || '',
    buyingSignal: body.buyingSignal || '',
    signalDate: body.signalDate || '',
    score: body.score || '',
    priority: body.priority || '',
    revenueMin: body.revenueMin || '',
    revenueMax: body.revenueMax || '',
    sourceUrl: body.sourceUrl || '',
    sourceLabel: body.sourceLabel || '',
    details: body.details || '',
    origin: body.origin || 'Dashboard',
    createdBy: body.createdBy || 'AI Sales Radar Web'
  });
}

function syncRadar_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new Error('items[] is required');
  const discoveryDate = String(body.discoveryDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
  const engineVersion = String(body.engineVersion || RADAR.version);
  const results = [];

  items.forEach((item, i) => {
    const result = upsertBrandFromRadar_(item, discoveryDate);
    upsertDailyRadar_(item, result, discoveryDate, i + 1, engineVersion);
    appendActivity_({
      brandId: result.brandId,
      brandName: result.brandName,
      type: result.isNew ? 'RADAR_DETECTED' : (result.signalUpdated ? 'SIGNAL_UPDATED' : 'RADAR_DETECTED'),
      newStatus: result.status,
      buyingSignal: item.buyingSignal || '',
      signalDate: item.signalDate || '',
      score: item.opportunityScore || '',
      priority: item.priority || '',
      revenueMin: item.revenueMin || '',
      revenueMax: item.revenueMax || '',
      sourceUrl: item.sourceUrl1 || '',
      sourceLabel: item.sourceLabel || '',
      details: item.whyNow || '',
      origin: 'Daily Discovery',
      createdBy: engineVersion
    });
    results.push(result);
  });

  return { discoveryDate, count: results.length, results };
}

function upsertBrandFromRadar_(item, discoveryDate) {
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.brands);
  const data = valuesWithHeaders_(sheet);
  const brandName = String(item.brand || item.brandName || '').trim();
  if (!brandName) throw new Error('Each radar item requires brand');
  let rowIndex = -1;
  for (let r = 1; r < data.values.length; r++) {
    if (normalize_(data.values[r][data.map.Brand_Name]) === normalize_(brandName)) { rowIndex = r + 1; break; }
  }

  let isNew = false;
  let brandId;
  let status = 'Not Checked';
  let oldSignal = '';
  if (rowIndex === -1) {
    isNew = true;
    brandId = nextBrandId_(data.values, data.map.Brand_ID);
    const row = new Array(data.headers.length).fill('');
    setByHeader_(row, data.map, 'Brand_ID', brandId);
    setByHeader_(row, data.map, 'Brand_Name', brandName);
    setByHeader_(row, data.map, 'Company_Name', item.company || '');
    setByHeader_(row, data.map, 'Industry', item.industry || '');
    setByHeader_(row, data.map, 'Brand_Type', item.brandType || 'Radar Discovery');
    setByHeader_(row, data.map, 'Salesforce_Status', status);
    setByHeader_(row, data.map, 'Priority', item.priority || '');
    setByHeader_(row, data.map, 'Opportunity_Score', item.opportunityScore || '');
    setByHeader_(row, data.map, 'Revenue_Min_M_THB', item.revenueMin || '');
    setByHeader_(row, data.map, 'Revenue_Max_M_THB', item.revenueMax || '');
    setByHeader_(row, data.map, 'First_Seen', discoveryDate);
    setByHeader_(row, data.map, 'Last_Seen', discoveryDate);
    setByHeader_(row, data.map, 'Times_Detected', 1);
    setByHeader_(row, data.map, 'Last_Buying_Signal', item.buyingSignal || '');
    setByHeader_(row, data.map, 'Last_Signal_Date', item.signalDate || '');
    setByHeader_(row, data.map, 'Momentum', item.momentum || '');
    setByHeader_(row, data.map, 'Thailand_Evidence', item.thailandEvidence || '');
    setByHeader_(row, data.map, 'Why_Now', item.whyNow || '');
    setByHeader_(row, data.map, 'Primary_Source_URL', item.sourceUrl1 || '');
    setByHeader_(row, data.map, 'Notes', 'Created by Apps Script radar sync');
    setByHeader_(row, data.map, 'Active', true);
    sheet.appendRow(row);
  } else {
    brandId = String(sheet.getRange(rowIndex, data.map.Brand_ID + 1).getValue());
    status = String(sheet.getRange(rowIndex, data.map.Salesforce_Status + 1).getValue() || 'Not Checked');
    oldSignal = String(sheet.getRange(rowIndex, data.map.Last_Buying_Signal + 1).getValue() || '');
    setCellByHeader_(sheet, rowIndex, data.map, 'Company_Name', item.company || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Industry', item.industry || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Priority', item.priority || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Opportunity_Score', item.opportunityScore !== undefined ? item.opportunityScore : undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Revenue_Min_M_THB', item.revenueMin !== undefined ? item.revenueMin : undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Revenue_Max_M_THB', item.revenueMax !== undefined ? item.revenueMax : undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Last_Seen', discoveryDate);
    setCellByHeader_(sheet, rowIndex, data.map, 'Times_Detected', Number(sheet.getRange(rowIndex, data.map.Times_Detected + 1).getValue() || 0) + 1);
    setCellByHeader_(sheet, rowIndex, data.map, 'Last_Buying_Signal', item.buyingSignal || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Last_Signal_Date', item.signalDate || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Why_Now', item.whyNow || undefined);
    setCellByHeader_(sheet, rowIndex, data.map, 'Primary_Source_URL', item.sourceUrl1 || undefined);
  }

  return { brandId, brandName, status, isNew, signalUpdated: !isNew && item.buyingSignal && normalize_(oldSignal) !== normalize_(item.buyingSignal) };
}

function upsertDailyRadar_(item, brandResult, discoveryDate, rank, engineVersion) {
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.radar);
  const data = valuesWithHeaders_(sheet);
  let targetRow = -1;
  for (let r = 1; r < data.values.length; r++) {
    if (String(data.values[r][data.map.Discovery_Date]) === discoveryDate && String(data.values[r][data.map.Brand_ID]) === brandResult.brandId) {
      targetRow = r + 1;
      break;
    }
  }
  const row = new Array(data.headers.length).fill('');
  setByHeader_(row, data.map, 'Discovery_Date', discoveryDate);
  setByHeader_(row, data.map, 'Daily_Rank', Number(item.rank || rank));
  setByHeader_(row, data.map, 'Brand_ID', brandResult.brandId);
  setByHeader_(row, data.map, 'Brand_Name', brandResult.brandName);
  setByHeader_(row, data.map, 'Company_Name', item.company || '');
  setByHeader_(row, data.map, 'Industry', item.industry || '');
  setByHeader_(row, data.map, 'Brand_Type', item.brandType || 'Radar Discovery');
  setByHeader_(row, data.map, 'Buying_Signal', item.buyingSignal || '');
  setByHeader_(row, data.map, 'Signal_Date', item.signalDate || '');
  setByHeader_(row, data.map, 'Why_Now', item.whyNow || '');
  setByHeader_(row, data.map, 'Opportunity_Score', item.opportunityScore || '');
  setByHeader_(row, data.map, 'Priority', item.priority || '');
  setByHeader_(row, data.map, 'Revenue_Min_M_THB', item.revenueMin || '');
  setByHeader_(row, data.map, 'Revenue_Max_M_THB', item.revenueMax || '');
  setByHeader_(row, data.map, 'Salesforce_Status', brandResult.status);
  setByHeader_(row, data.map, 'Source_URL_1', item.sourceUrl1 || '');
  setByHeader_(row, data.map, 'Source_URL_2', item.sourceUrl2 || '');
  setByHeader_(row, data.map, 'Is_New', !!brandResult.isNew);
  setByHeader_(row, data.map, 'Is_Updated', !!brandResult.signalUpdated);
  setByHeader_(row, data.map, 'Engine_Version', engineVersion);
  if (targetRow === -1) sheet.appendRow(row);
  else sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}

function appendActivity_(a) {
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.activity);
  const data = valuesWithHeaders_(sheet);
  const row = new Array(data.headers.length).fill('');
  const id = 'ACT-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss') + '-' + String(a.brandId || '').replace(/[^0-9]/g, '').padStart(4, '0');
  setByHeader_(row, data.map, 'Activity_ID', id);
  setByHeader_(row, data.map, 'Activity_DateTime', now_());
  setByHeader_(row, data.map, 'Brand_ID', a.brandId || '');
  setByHeader_(row, data.map, 'Brand_Name', a.brandName || '');
  setByHeader_(row, data.map, 'Activity_Type', a.type || 'NOTE_ADDED');
  setByHeader_(row, data.map, 'Old_Status', a.oldStatus || '');
  setByHeader_(row, data.map, 'New_Status', a.newStatus || '');
  setByHeader_(row, data.map, 'Buying_Signal', a.buyingSignal || '');
  setByHeader_(row, data.map, 'Signal_Date', a.signalDate || '');
  setByHeader_(row, data.map, 'Opportunity_Score', a.score || '');
  setByHeader_(row, data.map, 'Priority', a.priority || '');
  setByHeader_(row, data.map, 'Revenue_Min_M_THB', a.revenueMin || '');
  setByHeader_(row, data.map, 'Revenue_Max_M_THB', a.revenueMax || '');
  setByHeader_(row, data.map, 'Source_URL', a.sourceUrl || '');
  setByHeader_(row, data.map, 'Source_Label', a.sourceLabel || '');
  setByHeader_(row, data.map, 'Details', a.details || '');
  setByHeader_(row, data.map, 'Origin', a.origin || '');
  setByHeader_(row, data.map, 'Created_By', a.createdBy || 'AI Sales Radar');
  sheet.appendRow(row);
  return { activityId: id };
}

function findBrand_(brandId) {
  const rows = readObjects_(RADAR.sheets.brands);
  return rows.find(r => String(r.Brand_ID) === String(brandId)) || null;
}

function readObjects_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r.some(v => v !== '')).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = r[i] === undefined ? '' : r[i]);
    return o;
  });
}

function valuesWithHeaders_(sheet) {
  if (!sheet) throw new Error('Sheet not found');
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(String);
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return { values, headers, map };
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID') || RADAR.spreadsheetId;
  return SpreadsheetApp.openById(id);
}

function requireKey_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('RADAR_API_KEY');
  if (!expected) throw new Error('API bridge is not configured. Run setupBridge() first.');
  if (!key || String(key) !== String(expected)) throw new Error('Unauthorized');
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('JSON body is required');
  try { return JSON.parse(e.postData.contents); }
  catch (_) { throw new Error('Invalid JSON body'); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function normalize_(v) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findRowByValue_(values, colIndex, target) {
  for (let r = 1; r < values.length; r++) if (String(values[r][colIndex]) === String(target)) return r + 1;
  return -1;
}

function nextBrandId_(values, idCol) {
  let max = 0;
  for (let r = 1; r < values.length; r++) {
    const m = String(values[r][idCol] || '').match(/BR(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'BR' + String(max + 1).padStart(4, '0');
}

function setByHeader_(row, map, header, value) {
  if (map[header] !== undefined) row[map[header]] = value;
}

function setCellByHeader_(sheet, rowIndex, map, header, value) {
  if (value === undefined || map[header] === undefined) return;
  sheet.getRange(rowIndex, map[header] + 1).setValue(value);
}

function upsertConfig_(key, value) {
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.config);
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(key)) {
      sheet.getRange(r + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}
