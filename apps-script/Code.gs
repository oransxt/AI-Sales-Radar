const RADAR = {
  version: '2.1.0',
  spreadsheetId: '1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo',
  sheets: {
    brands: 'Brand_Master',
    activity: 'Activity_Log',
    radar: 'Daily_Radar',
    config: 'Config',
    credentials: 'Credential_Library',
    credentialMatches: 'Brand_Credential_Match',
    emailDrafts: 'Email_Draft_Log'
  },
  statuses: ['Not Checked', 'Available', 'Has Owner', 'Existing Client', 'Skip'],
  activityTypes: ['MASTER_IMPORT', 'RADAR_DETECTED', 'SIGNAL_UPDATED', 'STATUS_CHANGED', 'CREDENTIAL_SELECTED', 'EMAIL_DRAFT_GENERATED', 'GMAIL_DRAFT_CREATED', 'NOTE_ADDED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Sales Radar')
    .addItem('Setup API Bridge', 'setupBridge')
    .addItem('Rotate API Key', 'rotateApiKey')
    .addItem('Show Web App URL', 'showWebAppUrl')
    .addSeparator()
    .addItem('Setup Sales Flow Sheets', 'setupV2Sheets')
    .addItem('Configure OpenAI Drafting', 'setupOpenAIDrafting')
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
  ensureV2Sheets_();
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
    if (action === 'credentials') {
      return json_({ ok: true, data: getCredentials_(p.type || '', p.industry || '', p.active || 'true') });
    }
    if (action === 'credential-matches') {
      return json_({ ok: true, data: getCredentialMatches_(p.brandId || '') });
    }
    if (action === 'email-drafts') {
      return json_({ ok: true, data: getEmailDrafts_(p.brandId || '', Number(p.limit || 50)) });
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
    if (action === 'credential-upsert') {
      return json_({ ok: true, data: upsertCredential_(body) });
    }
    if (action === 'credential-selection') {
      return json_({ ok: true, data: saveCredentialSelection_(body) });
    }
    if (action === 'credential-analyze') {
      return json_({ ok: true, data: analyzeDriveCredential_(body) });
    }
    if (action === 'email-draft-generate') {
      return json_({ ok: true, data: generateEmailDraft_(body) });
    }
    if (action === 'gmail-draft-create') {
      return json_({ ok: true, data: createGmailDraft_(body) });
    }
    return json_({ ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: err.message }, 500);
  }
}


function setupV2Sheets() {
  ensureV2Sheets_();
  upsertConfig_('Sales Flow Data Layer', 'Credential_Library + Brand_Credential_Match + Email_Draft_Log');
  upsertConfig_('System Version', RADAR.version);
  SpreadsheetApp.getUi().alert(
    'AI Sales Radar',
    'Credential and Email Drafting data layers are ready.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function ensureV2Sheets_() {
  ensureSheet_(RADAR.sheets.credentials, [
    'Credential_ID','Credential_Name','Credential_Type','Industry','Tags',
    'Google_Drive_URL','Active','Date_Added','Last_Updated',
    'Source_Last_Modified','Analysis_Source','File_Mime_Type','Source_File_ID'
  ]);
  ensureSheet_(RADAR.sheets.credentialMatches, [
    'Match_ID','Brand_ID','Brand_Name','Credential_ID','Credential_Name',
    'Match_Score','AI_Recommended','Selected_By_User','Selected_At','Notes'
  ]);
  ensureSheet_(RADAR.sheets.emailDrafts, [
    'Draft_ID','Brand_ID','Brand_Name','Recipient','Language','Tone','Subject','Body',
    'Sales_Angle','Media_Direction','Next_Best_Action','Selected_Credentials','Engine',
    'Status','Gmail_Draft_ID','Created_At','Last_Updated'
  ]);
}

function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  const existing = sheet.getRange(1,1,1,lastCol).getDisplayValues()[0];
  headers.forEach((h,i) => {
    if (String(existing[i] || '').trim() !== h) sheet.getRange(1,i+1).setValue(h);
  });
  sheet.setFrozenRows(1);
  return sheet;
}


function analyzeDriveCredential_(body) {
  const url = String(body.driveUrl || body.googleDriveUrl || '').trim();
  if (!url) throw new Error('Google Drive URL is required');

  const meta = getDriveCredentialMeta_(url);
  const extracted = extractDriveCredentialText_(meta.fileId, meta.mimeType);
  const basis = [meta.name, extracted.text].filter(Boolean).join('\n').slice(0, 30000);
  const classified = classifyCredential_(basis);

  return {
    driveUrl: meta.url,
    fileId: meta.fileId,
    fileName: meta.name,
    mimeType: meta.mimeType,
    active: meta.active,
    dateAdded: now_(),
    sourceLastModified: meta.lastModified,
    analysisSource: extracted.source,
    extractedTextAvailable: !!extracted.text,
    credentialName: meta.name,
    credentialType: classified.credentialType,
    industry: classified.industry,
    tags: classified.tags.join(', '),
    confidence: classified.confidence
  };
}

function getDriveCredentialMeta_(url) {
  const fileId = extractDriveFileId_(url);
  if (!fileId) throw new Error('Could not detect Google Drive file ID from URL');

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    throw new Error('Cannot access this Google Drive file. Check the link and permissions.');
  }

  return {
    fileId: fileId,
    name: file.getName(),
    mimeType: file.getMimeType(),
    active: !file.isTrashed(),
    dateCreated: formatDateTime_(file.getDateCreated()),
    lastModified: formatDateTime_(file.getLastUpdated()),
    url: file.getUrl() || url
  };
}

function extractDriveFileId_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const patterns = [
    /\/d\/([A-Za-z0-9_-]{20,})/,
    /[?&]id=([A-Za-z0-9_-]{20,})/,
    /^([A-Za-z0-9_-]{20,})$/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = s.match(patterns[i]);
    if (m) return m[1];
  }
  return '';
}

function extractDriveCredentialText_(fileId, mimeType) {
  const limit = 25000;
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      const text = DocumentApp.openById(fileId).getBody().getText();
      return { text: String(text || '').slice(0, limit), source: 'Google Drive metadata + Google Docs text' };
    }

    if (mimeType === 'application/vnd.google-apps.presentation') {
      const presentation = SlidesApp.openById(fileId);
      const chunks = [];
      presentation.getSlides().slice(0, 40).forEach(slide => {
        slide.getShapes().forEach(shape => {
          try {
            const t = shape.getText().asString();
            if (t) chunks.push(t);
          } catch (_) {}
        });
      });
      return { text: chunks.join('\n').slice(0, limit), source: 'Google Drive metadata + Google Slides text' };
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const ss = SpreadsheetApp.openById(fileId);
      const chunks = [];
      ss.getSheets().slice(0, 5).forEach(sh => {
        const values = sh.getDataRange().getDisplayValues().slice(0, 60);
        values.forEach(row => chunks.push(row.slice(0, 20).join(' ')));
      });
      return { text: chunks.join('\n').slice(0, limit), source: 'Google Drive metadata + Google Sheets text' };
    }
  } catch (_) {
    // Fall back to metadata + filename if native text extraction is unavailable.
  }

  return { text: '', source: 'Google Drive metadata + file name' };
}

function containsKeyword_(normalizedText, keyword) {
  const s = String(normalizedText || '');
  const k = normalize_(keyword);
  if (!k) return false;
  const hasThai = /[\u0E00-\u0E7F]/.test(k);
  if (hasThai || /[\s\/-]/.test(k) || k.length > 4) return s.includes(k);
  const escaped = k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i').test(s);
}

function scoreKeywords_(s, weightedWords) {
  return weightedWords.reduce((sum, pair) => sum + (containsKeyword_(s, pair[0]) ? pair[1] : 0), 0);
}

function classifyCredential_(text) {
  const raw = String(text || '');
  const s = normalize_(raw);

  const typeRules = [
    { type:'Case Study', words:[
      ['case study',6],['case-study',6],['กรณีศึกษา',6],
      ['campaign result',4],['campaign results',4],['effectiveness',3],
      ['success story',3],['ผลลัพธ์',3],['campaign',1],['results',2],['result',2]
    ]},
    { type:'New Launches', words:[
      ['new launch',6],['new product',5],['สินค้าใหม่',5],['เปิดตัว',4],
      ['new media',4],['new format',4],['new site',3],['opening',2],['launch',2]
    ]},
    { type:'Industry Overview', words:[
      ['industry overview',6],['market overview',6],['category overview',5],
      ['trend report',4],['consumer insight',4],['ภาพรวมอุตสาหกรรม',6],
      ['เทรนด์',3],['อินไซต์',3],['overview',2],['insight',2],['trend',2]
    ]},
    { type:'Media Credentials', words:[
      ['media credential',7],['media credentials',7],['credential',5],
      ['media kit',5],['rate card',6],['ratecard',6],['ข้อมูลสื่อ',5],['เรทการ์ด',6],
      ['inventory',3],['screen network',3],['media network',3],['network',1],
      ['billboard',1],['dooh',1],['ooh',1],['plan b tv',2],['signature max',2],
      ['the 20',2],['cookies',2],['bts',1],['transit',1],['airport',1]
    ]}
  ];

  let credentialType = 'Media Credentials';
  let bestTypeScore = -1;
  typeRules.forEach(rule => {
    const score = scoreKeywords_(s, rule.words);
    if (score > bestTypeScore) {
      bestTypeScore = score;
      credentialType = rule.type;
    }
  });
  if (bestTypeScore <= 0) credentialType = 'Media Credentials';

  const industries = [
    { name:'Automotive', words:['automotive','auto','car','cars','vehicle','ev','electric vehicle','รถยนต์','รถไฟฟ้า'] },
    { name:'Retail / Fashion', words:['retail','fashion','apparel','shoes','shoe','clothing','luxury','department store','store opening','แฟชั่น','เสื้อผ้า','รองเท้า','ค้าปลีก'] },
    { name:'Beauty / Personal Care', words:['beauty','cosmetic','cosmetics','skincare','personal care','makeup','ความงาม','เครื่องสำอาง','สกินแคร์'] },
    { name:'Banking / Finance', words:['bank','banking','finance','financial','credit card','wealth','fund','insurance','fintech','ธนาคาร','การเงิน','บัตรเครดิต','กองทุน','ประกัน'] },
    { name:'Food / Beverage', words:['food','beverage','restaurant','qsr','coffee','cafe','drink','snack','อาหาร','เครื่องดื่ม','ร้านอาหาร','กาแฟ'] },
    { name:'Healthcare / Medical', words:['healthcare','hospital','medical','clinic','pharma','pharmaceutical','medicine','health','โรงพยาบาล','คลินิก','ยา','สุขภาพ'] },
    { name:'Travel / Airline / Tourism', words:['airline','aviation','travel','tourism','hotel','airport','flight','สายการบิน','ท่องเที่ยว','โรงแรม','สนามบิน'] },
    { name:'Technology / App / Platform', words:['technology','tech','app','application','platform','digital service','software','saas','ecommerce','e-commerce','เทคโนโลยี','แอป','แพลตฟอร์ม'] },
    { name:'Real Estate', words:['real estate','property','residence','residential','condo','condominium','housing','บ้าน','คอนโด','อสังหาริมทรัพย์'] },
    { name:'Entertainment / Streaming', words:['entertainment','streaming','movie','film','series','music','cinema','disney','netflix','บันเทิง','ภาพยนตร์','ซีรีส์'] },
    { name:'Education', words:['education','school','university','college','course','เรียน','โรงเรียน','มหาวิทยาลัย','การศึกษา'] },
    { name:'B2B / Industrial', words:['industrial','industry equipment','machinery','manufacturing','logistics','construction','factory','b2b','อุตสาหกรรม','เครื่องจักร','โลจิสติกส์','โรงงาน'] },
    { name:'Sports / Apparel', words:['sports','sport','football','running','fitness','sportswear','athlete','กีฬา','ฟุตบอล','วิ่ง','ฟิตเนส'] }
  ];

  let industry = 'General / Multi-Industry';
  let bestIndustryScore = 0;
  industries.forEach(rule => {
    let score = 0;
    rule.words.forEach(w => { if (containsKeyword_(s, w)) score += 1; });
    if (score > bestIndustryScore) {
      bestIndustryScore = score;
      industry = rule.name;
    }
  });

  const tagRules = [
    ['Product Launch',['launch','new product','เปิดตัว','สินค้าใหม่']],
    ['Expansion',['expansion','new branch','new store','opening','ขยายสาขา','สาขาใหม่']],
    ['Brand Awareness',['brand awareness','awareness','สร้างการรับรู้']],
    ['Consideration',['consideration','consider','พิจารณา']],
    ['Conversion',['conversion','sales','purchase','ยอดขาย','ซื้อ']],
    ['Gen Z',['gen z','gen-z','เจน z']],
    ['First Jobber',['first jobber','young professional','วัยเริ่มทำงาน']],
    ['Premium',['premium','luxury','affluent','high net worth']],
    ['Mass',['mass market','mass audience','mass']],
    ['Bangkok',['bangkok','bkk','กรุงเทพ']],
    ['Nationwide',['nationwide','national','ทั่วประเทศ']],
    ['CBD',['cbd','central business district','สุขุมวิท','สีลม','สาทร','อโศก']],
    ['OOH',['ooh','out of home','out-of-home']],
    ['DOOH',['dooh','digital out of home','digital-out-of-home']],
    ['Billboard',['billboard']],
    ['Transit',['transit','bts','mrt','bus','train body']],
    ['Airport',['airport','suvarnabhumi','don mueang','สนามบิน','สุวรรณภูมิ']],
    ['Retail Media',['retail media','mall','shopping mall','department store']],
    ['Long-term',['long term','long-term','always on','always-on']],
    ['Tactical',['tactical','burst','short term','short-term']],
    ['Case Study',['case study','กรณีศึกษา']],
    ['Insight',['insight','consumer insight','อินไซต์']],
    ['Media Network',['media network','inventory','screen network','network']]
  ];

  const tags = [];
  tagRules.forEach(rule => {
    if (rule[1].some(w => containsKeyword_(s, w))) tags.push(rule[0]);
  });

  if (!tags.includes(credentialType)) tags.unshift(credentialType);
  if (industry !== 'General / Multi-Industry' && !tags.includes(industry)) tags.unshift(industry);

  const confidence = Math.min(100, 30 + Math.min(bestTypeScore, 10) * 5 + Math.min(bestIndustryScore, 5) * 8 + Math.min(tags.length, 6) * 3);
  return { credentialType, industry, tags: tags.slice(0, 12), confidence };
}

function formatDateTime_(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function getCredentials_(typeFilter, industryFilter, activeFilter) {
  ensureV2Sheets_();
  let rows = readObjects_(RADAR.sheets.credentials);
  if (String(activeFilter).toLowerCase() !== 'all') {
    const wantActive = String(activeFilter).toLowerCase() !== 'false';
    rows = rows.filter(r => truthyValue_(r.Active) === wantActive);
  }
  if (typeFilter) rows = rows.filter(r => normalize_(r.Credential_Type) === normalize_(typeFilter));
  if (industryFilter) {
    const ind = normalize_(industryFilter);
    rows = rows.filter(r => {
      const ci = normalize_(r.Industry);
      return !ci || ci === 'all' || ci === ind || ci.includes(ind) || ind.includes(ci);
    });
  }
  return rows;
}

function getCredentialMatches_(brandId) {
  ensureV2Sheets_();
  let rows = readObjects_(RADAR.sheets.credentialMatches);
  if (brandId) rows = rows.filter(r => String(r.Brand_ID) === String(brandId));
  rows.reverse();
  return rows;
}

function upsertCredential_(body) {
  ensureV2Sheets_();
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.credentials);
  const data = valuesWithHeaders_(sheet);
  const name = String(body.name || body.credentialName || '').trim();
  const type = String(body.type || body.credentialType || '').trim();
  const allowedTypes = ['Industry Overview','Case Study','New Launches','Media Credentials'];
  if (!name) throw new Error('Credential name is required');
  if (!allowedTypes.includes(type)) throw new Error('Invalid credential type');
  const url = String(body.driveUrl || body.googleDriveUrl || '').trim();
  if (!url) throw new Error('Google Drive URL is required');

  let meta;
  try {
    meta = getDriveCredentialMeta_(url);
  } catch (err) {
    if (body.allowInaccessible === true) {
      meta = { fileId:'', name:name, mimeType:'', active:false, lastModified:'', url:url };
    } else {
      throw err;
    }
  }

  let rowIndex = -1;
  let id = String(body.credentialId || '').trim();
  if (id && data.map.Credential_ID !== undefined) {
    rowIndex = findRowByValue_(data.values, data.map.Credential_ID, id);
  }
  if (rowIndex < 2) {
    id = nextCredentialId_(data.values, data.map.Credential_ID);
    const row = new Array(data.headers.length).fill('');
    setByHeader_(row,data.map,'Credential_ID',id);
    setByHeader_(row,data.map,'Credential_Name',name);
    setByHeader_(row,data.map,'Credential_Type',type);
    setByHeader_(row,data.map,'Industry',body.industry || '');
    setByHeader_(row,data.map,'Tags',body.tags || '');
    setByHeader_(row,data.map,'Google_Drive_URL',meta.url || url);
    setByHeader_(row,data.map,'Active',meta.active);
    setByHeader_(row,data.map,'Date_Added',now_());
    setByHeader_(row,data.map,'Last_Updated',now_());
    setByHeader_(row,data.map,'Source_Last_Modified',body.sourceLastModified || meta.lastModified || '');
    setByHeader_(row,data.map,'Analysis_Source',body.analysisSource || '');
    setByHeader_(row,data.map,'File_Mime_Type',body.mimeType || meta.mimeType || '');
    setByHeader_(row,data.map,'Source_File_ID',body.fileId || meta.fileId || '');
    sheet.appendRow(row);
  } else {
    setCellByHeader_(sheet,rowIndex,data.map,'Credential_Name',name);
    setCellByHeader_(sheet,rowIndex,data.map,'Credential_Type',type);
    setCellByHeader_(sheet,rowIndex,data.map,'Industry',body.industry || '');
    setCellByHeader_(sheet,rowIndex,data.map,'Tags',body.tags || '');
    setCellByHeader_(sheet,rowIndex,data.map,'Google_Drive_URL',meta.url || url);
    setCellByHeader_(sheet,rowIndex,data.map,'Active',meta.active);
    setCellByHeader_(sheet,rowIndex,data.map,'Last_Updated',now_());
    setCellByHeader_(sheet,rowIndex,data.map,'Source_Last_Modified',body.sourceLastModified || meta.lastModified || '');
    setCellByHeader_(sheet,rowIndex,data.map,'Analysis_Source',body.analysisSource || '');
    setCellByHeader_(sheet,rowIndex,data.map,'File_Mime_Type',body.mimeType || meta.mimeType || '');
    setCellByHeader_(sheet,rowIndex,data.map,'Source_File_ID',body.fileId || meta.fileId || '');
  }
  return { credentialId:id, credentialName:name, credentialType:type };
}

function saveCredentialSelection_(body) {
  ensureV2Sheets_();
  const brandId = String(body.brandId || '').trim();
  if (!brandId) throw new Error('brandId is required');
  const brand = findBrand_(brandId);
  if (!brand) throw new Error('Brand not found: ' + brandId);
  if (String(brand.Salesforce_Status || '') !== 'Available') {
    throw new Error('Credential selection is allowed only for Available brands');
  }

  const selectedIds = Array.isArray(body.credentialIds) ? body.credentialIds.map(String) : [];
  const scores = body.matchScores || {};
  const recommended = new Set((body.recommendedIds || []).map(String));
  const credentials = getCredentials_('', '', 'all');
  const credById = {};
  credentials.forEach(c => credById[String(c.Credential_ID)] = c);

  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.credentialMatches);
  const data = valuesWithHeaders_(sheet);
  const existingByCredential = {};
  for (let r=1; r<data.values.length; r++) {
    if (String(data.values[r][data.map.Brand_ID]) === brandId) {
      existingByCredential[String(data.values[r][data.map.Credential_ID])] = r + 1;
    }
  }

  Object.keys(existingByCredential).forEach(cid => {
    const row = existingByCredential[cid];
    setCellByHeader_(sheet,row,data.map,'Selected_By_User',selectedIds.includes(cid));
    if (selectedIds.includes(cid)) setCellByHeader_(sheet,row,data.map,'Selected_At',now_());
  });

  selectedIds.forEach(cid => {
    const cred = credById[cid];
    if (!cred) return;
    const existingRow = existingByCredential[cid];
    if (existingRow) {
      setCellByHeader_(sheet,existingRow,data.map,'Credential_Name',cred.Credential_Name || '');
      setCellByHeader_(sheet,existingRow,data.map,'Match_Score',Number(scores[cid] || 0));
      setCellByHeader_(sheet,existingRow,data.map,'AI_Recommended',recommended.has(cid));
      setCellByHeader_(sheet,existingRow,data.map,'Selected_By_User',true);
      setCellByHeader_(sheet,existingRow,data.map,'Selected_At',now_());
    } else {
      const row = new Array(data.headers.length).fill('');
      setByHeader_(row,data.map,'Match_ID','M-' + Utilities.getUuid().slice(0,8));
      setByHeader_(row,data.map,'Brand_ID',brandId);
      setByHeader_(row,data.map,'Brand_Name',brand.Brand_Name || '');
      setByHeader_(row,data.map,'Credential_ID',cid);
      setByHeader_(row,data.map,'Credential_Name',cred.Credential_Name || '');
      setByHeader_(row,data.map,'Match_Score',Number(scores[cid] || 0));
      setByHeader_(row,data.map,'AI_Recommended',recommended.has(cid));
      setByHeader_(row,data.map,'Selected_By_User',true);
      setByHeader_(row,data.map,'Selected_At',now_());
      setByHeader_(row,data.map,'Notes',body.notes || '');
      sheet.appendRow(row);
    }
  });

  const names = selectedIds.map(id => credById[id]?.Credential_Name).filter(Boolean);
  appendActivity_({
    brandId,
    brandName: brand.Brand_Name || brandId,
    type: 'CREDENTIAL_SELECTED',
    newStatus: brand.Salesforce_Status || 'Available',
    details: names.length ? ('Selected credentials: ' + names.join(' | ')) : 'Credential selection cleared',
    origin: body.origin || 'V2 Opportunity Prep',
    createdBy: body.createdBy || 'AI Sales Radar V2'
  });

  return { brandId, selectedCount:selectedIds.length, selectedCredentialIds:selectedIds };
}

function nextCredentialId_(values, idCol) {
  let max = 0;
  if (idCol === undefined) return 'CRD0001';
  for (let r=1; r<values.length; r++) {
    const m = String(values[r][idCol] || '').match(/CRD(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'CRD' + String(max + 1).padStart(4,'0');
}

function truthyValue_(v) {
  const s = String(v ?? '').toLowerCase().trim();
  return v === true || ['true','yes','1','active'].includes(s);
}


function setupOpenAIDrafting() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const currentModel = props.getProperty('OPENAI_MODEL') || 'gpt-6-astra';
  const response = ui.prompt(
    'AI Sales Radar — OpenAI Drafting',
    'Paste OPENAI_API_KEY. The key is stored only in Apps Script Properties, not in GitHub or Google Sheets.\n\nLeave blank and press OK to keep template fallback only.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const key = String(response.getResponseText() || '').trim();
  if (key) props.setProperty('OPENAI_API_KEY', key);
  props.setProperty('OPENAI_MODEL', currentModel);
  upsertConfig_('Email Draft Engine', key ? ('OpenAI Responses API / ' + currentModel) : 'Template fallback');
  upsertConfig_('Email Draft Human Control', 'Draft only - Sales reviews and sends');
  ui.alert(
    'Email Drafting',
    key ? ('OpenAI drafting configured with model ' + currentModel + '.') : 'Template fallback remains enabled. No OpenAI key was stored.',
    ui.ButtonSet.OK
  );
}

function getEmailDrafts_(brandId, limit) {
  ensureV2Sheets_();
  let rows = readObjects_(RADAR.sheets.emailDrafts);
  if (brandId) rows = rows.filter(r => String(r.Brand_ID) === String(brandId));
  rows.reverse();
  return rows.slice(0, Math.max(1, Math.min(limit || 50, 500)));
}

function getSelectedCredentialPack_(brandId) {
  const matches = getCredentialMatches_(brandId).filter(r => truthyValue_(r.Selected_By_User));
  if (!matches.length) return [];

  const credentials = readObjects_(RADAR.sheets.credentials);
  const byId = {};
  credentials.forEach(c => byId[String(c.Credential_ID)] = c);

  const seen = {};
  return matches.filter(m => {
    const id = String(m.Credential_ID || '');
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  }).map(m => {
    const c = byId[String(m.Credential_ID)] || {};
    return {
      id: String(m.Credential_ID || ''),
      name: String(c.Credential_Name || m.Credential_Name || ''),
      type: String(c.Credential_Type || ''),
      industry: String(c.Industry || ''),
      tags: String(c.Tags || ''),
      url: String(c.Google_Drive_URL || '')
    };
  });
}

function generateEmailDraft_(body) {
  ensureV2Sheets_();
  const brandId = String(body.brandId || '').trim();
  if (!brandId) throw new Error('brandId is required');

  const brand = findBrand_(brandId);
  if (!brand) throw new Error('Brand not found: ' + brandId);
  if (String(brand.Salesforce_Status || '') !== 'Available') {
    throw new Error('Email drafting is available only for Salesforce_Status = Available');
  }

  const language = String(body.language || 'Thai').trim();
  const tone = String(body.tone || 'Professional / Consultative').trim();
  const cta = String(body.cta || '').trim();
  const credentials = getSelectedCredentialPack_(brandId);
  const context = buildEmailDraftContext_(brand, credentials, language, tone, cta);

  let draft;
  let engine = 'Template fallback';
  const props = PropertiesService.getScriptProperties();
  const openAIKey = String(props.getProperty('OPENAI_API_KEY') || '').trim();

  if (openAIKey) {
    try {
      draft = callOpenAIEmailDraft_(context, openAIKey, props.getProperty('OPENAI_MODEL') || 'gpt-6-astra');
      engine = 'OpenAI Responses API';
    } catch (err) {
      draft = buildFallbackEmailDraft_(context);
      engine = 'Template fallback after AI error';
      draft.engineNote = 'AI generation failed; fallback used: ' + err.message;
    }
  } else {
    draft = buildFallbackEmailDraft_(context);
  }

  draft.brandId = brandId;
  draft.brandName = brand.Brand_Name || brandId;
  draft.language = language;
  draft.tone = tone;
  draft.credentials = credentials;
  draft.engine = engine;
  draft.recipient = String(body.recipient || '').trim();

  const saved = saveEmailDraftLog_(draft);
  draft.draftId = saved.draftId;

  appendActivity_({
    brandId,
    brandName: draft.brandName,
    type: 'EMAIL_DRAFT_GENERATED',
    newStatus: brand.Salesforce_Status || 'Available',
    buyingSignal: brand.Last_Buying_Signal || '',
    signalDate: brand.Last_Signal_Date || '',
    details: 'Email draft generated · ' + engine + ' · ' + language + ' · ' + credentials.length + ' credential(s)',
    origin: body.origin || 'Email Drafting',
    createdBy: body.createdBy || 'AI Sales Radar'
  });

  return draft;
}

function buildEmailDraftContext_(brand, credentials, language, tone, cta) {
  return {
    brandName: String(brand.Brand_Name || ''),
    companyName: String(brand.Company_Name || brand.Brand_Name || ''),
    industry: String(brand.Industry || ''),
    buyingSignal: String(brand.Last_Buying_Signal || ''),
    signalDate: String(brand.Last_Signal_Date || ''),
    whyNow: String(brand.Why_Now || brand.Thailand_Evidence || ''),
    priority: String(brand.Priority || ''),
    opportunityScore: Number(brand.Opportunity_Score || 0),
    revenueMinM: Number(brand.Revenue_Min_M_THB || 0),
    revenueMaxM: Number(brand.Revenue_Max_M_THB || 0),
    language: language,
    tone: tone,
    cta: cta || (normalize_(language).includes('thai')
      ? 'ขอนัดพูดคุยสั้น ๆ เพื่อแชร์แนวทางสื่อที่เหมาะกับช่วงนี้'
      : 'Request a short meeting to share media directions relevant to this opportunity'),
    credentials: credentials
  };
}

function buildFallbackEmailDraft_(ctx) {
  const thai = normalize_(ctx.language).includes('thai');
  const links = ctx.credentials.filter(c => c.url).map(c => (c.name + ': ' + c.url));
  const credentialText = links.length
    ? (thai ? '\n\nข้อมูลประกอบที่เกี่ยวข้อง:\n- ' : '\n\nRelevant credentials:\n- ') + links.join('\n- ')
    : '';

  if (thai) {
    const subject = 'ขอแชร์แนวทาง OOH/DOOH สำหรับ ' + ctx.brandName;
    const body = [
      'เรียน ทีม ' + ctx.brandName + ' ครับ',
      '',
      'ผมจาก Plan B Media ครับ เห็นความเคลื่อนไหวล่าสุดของ ' + ctx.brandName + (ctx.buyingSignal ? ' ในเรื่อง ' + ctx.buyingSignal : '') + ' และมองว่าเป็นจังหวะที่น่าสนใจสำหรับการต่อยอดการสื่อสารผ่าน OOH/DOOH',
      '',
      ctx.whyNow ? 'จากข้อมูลที่พบ: ' + ctx.whyNow : 'ผมจึงอยากขอแชร์แนวทางสื่อที่สามารถช่วยสร้างการมองเห็นและต่อยอดช่วงเวลาของแบรนด์ได้',
      '',
      'เบื้องต้น Plan B สามารถช่วยวาง Media Direction ให้สอดคล้องกับกลุ่มเป้าหมาย พื้นที่ และจังหวะของแคมเปญ โดยผมได้คัด Credential ที่เกี่ยวข้องไว้ประกอบการพูดคุยแล้ว',
      credentialText,
      '',
      ctx.cta,
      '',
      'หากสะดวก ผมยินดีเตรียมแนวทางให้กระชับตาม Objective และพื้นที่ที่แบรนด์ให้ความสำคัญครับ',
      '',
      'ขอบคุณครับ'
    ].join('\n');
    return {
      subject: subject,
      body: body,
      salesAngle: 'ใช้ Buying Signal ล่าสุดเป็นเหตุผลในการเข้าหา และวาง OOH/DOOH เป็นตัวเร่งการมองเห็นในจังหวะที่แบรนด์กำลังเคลื่อนไหว',
      mediaDirection: 'เริ่มจาก Objective + Audience + Geography แล้วเลือก OOH/DOOH format ที่เหมาะสม โดยยังไม่สมมติ budget หรือ availability',
      nextBestAction: ctx.cta
    };
  }

  const subject = 'OOH/DOOH opportunity for ' + ctx.brandName;
  const body = [
    'Dear ' + ctx.brandName + ' Team,',
    '',
    'I’m reaching out from Plan B Media after seeing the recent ' + (ctx.buyingSignal || 'brand activity') + ' around ' + ctx.brandName + '. It looks like a timely opportunity to explore how OOH/DOOH could support visibility and campaign momentum.',
    '',
    ctx.whyNow ? 'What caught our attention: ' + ctx.whyNow : 'I would like to share a few media directions relevant to the brand’s current momentum.',
    '',
    'We can shape the recommendation around your objective, target audience and priority geography. I have also shortlisted relevant credentials for the discussion.',
    credentialText,
    '',
    ctx.cta,
    '',
    'Happy to tailor the direction once we understand the campaign objective and timing.',
    '',
    'Best regards'
  ].join('\n');
  return {
    subject: subject,
    body: body,
    salesAngle: 'Use the latest buying signal as the reason to engage now, with OOH/DOOH positioned as a visibility and momentum driver.',
    mediaDirection: 'Start from objective, audience and geography, then recommend relevant OOH/DOOH formats without inventing budget or availability.',
    nextBestAction: ctx.cta
  };
}

function callOpenAIEmailDraft_(ctx, apiKey, model) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string' },
      body: { type: 'string' },
      salesAngle: { type: 'string' },
      mediaDirection: { type: 'string' },
      nextBestAction: { type: 'string' }
    },
    required: ['subject','body','salesAngle','mediaDirection','nextBestAction']
  };

  const credentialText = ctx.credentials.map(c =>
    '- ' + c.name + ' | ' + c.type + ' | ' + c.industry + (c.url ? ' | ' + c.url : '')
  ).join('\n') || '- None selected';

  const prompt = [
    'You are drafting a first-contact B2B sales email for Plan B Media, an OOH/DOOH media company in Thailand.',
    'Use only the facts provided below. Do not invent campaign dates, budget, media availability, contact names, performance results, or client intent.',
    'The email must sound human, concise and consultative, not like generic AI copy.',
    'Draft only. The salesperson will review and send manually.',
    '',
    'Language: ' + ctx.language,
    'Tone: ' + ctx.tone,
    'Brand: ' + ctx.brandName,
    'Company: ' + ctx.companyName,
    'Industry: ' + ctx.industry,
    'Buying Signal: ' + ctx.buyingSignal,
    'Signal Date: ' + ctx.signalDate,
    'Why Now / Evidence: ' + ctx.whyNow,
    'Internal Opportunity Score: ' + ctx.opportunityScore,
    'Internal Revenue Potential Range (not client budget): THB ' + ctx.revenueMinM + '–' + ctx.revenueMaxM + 'M',
    'Preferred CTA: ' + ctx.cta,
    'Selected Credentials:',
    credentialText,
    '',
    'Return a short subject, a ready-to-edit email body, one salesAngle sentence, one mediaDirection sentence, and one nextBestAction sentence.'
  ].join('\n');

  const payload = {
    model: model,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'sales_email_draft',
        strict: true,
        schema: schema
      }
    }
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const raw = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('OpenAI API HTTP ' + status + ': ' + raw.slice(0, 220));
  }

  const parsed = JSON.parse(raw);
  const outputText = extractOpenAIOutputText_(parsed);
  if (!outputText) throw new Error('OpenAI response did not contain output text');

  const result = JSON.parse(outputText);
  return {
    subject: String(result.subject || ''),
    body: String(result.body || ''),
    salesAngle: String(result.salesAngle || ''),
    mediaDirection: String(result.mediaDirection || ''),
    nextBestAction: String(result.nextBestAction || '')
  };
}

function extractOpenAIOutputText_(response) {
  const chunks = [];
  (response.output || []).forEach(item => {
    (item.content || []).forEach(content => {
      if (content && content.type === 'output_text' && content.text) chunks.push(content.text);
    });
  });
  return chunks.join('\n').trim();
}

function saveEmailDraftLog_(draft) {
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.emailDrafts);
  const data = valuesWithHeaders_(sheet);
  const draftId = 'ED-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,6);
  const row = new Array(data.headers.length).fill('');

  setByHeader_(row,data.map,'Draft_ID',draftId);
  setByHeader_(row,data.map,'Brand_ID',draft.brandId || '');
  setByHeader_(row,data.map,'Brand_Name',draft.brandName || '');
  setByHeader_(row,data.map,'Recipient',draft.recipient || '');
  setByHeader_(row,data.map,'Language',draft.language || '');
  setByHeader_(row,data.map,'Tone',draft.tone || '');
  setByHeader_(row,data.map,'Subject',draft.subject || '');
  setByHeader_(row,data.map,'Body',draft.body || '');
  setByHeader_(row,data.map,'Sales_Angle',draft.salesAngle || '');
  setByHeader_(row,data.map,'Media_Direction',draft.mediaDirection || '');
  setByHeader_(row,data.map,'Next_Best_Action',draft.nextBestAction || '');
  setByHeader_(row,data.map,'Selected_Credentials',(draft.credentials || []).map(c => c.name).join(' | '));
  setByHeader_(row,data.map,'Engine',draft.engine || '');
  setByHeader_(row,data.map,'Status','Preview');
  setByHeader_(row,data.map,'Created_At',now_());
  setByHeader_(row,data.map,'Last_Updated',now_());
  sheet.appendRow(row);
  return { draftId: draftId };
}

function createGmailDraft_(body) {
  ensureV2Sheets_();
  const draftId = String(body.draftId || '').trim();
  const brandId = String(body.brandId || '').trim();
  const to = String(body.to || body.recipient || '').trim();
  const subject = String(body.subject || '').trim();
  const emailBody = String(body.body || '').trim();

  if (!brandId) throw new Error('brandId is required');
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('A valid recipient email is required');
  if (!subject) throw new Error('Email subject is required');
  if (!emailBody) throw new Error('Email body is required');

  const brand = findBrand_(brandId);
  if (!brand) throw new Error('Brand not found: ' + brandId);
  if (String(brand.Salesforce_Status || '') !== 'Available') {
    throw new Error('Gmail draft creation is available only for Salesforce_Status = Available');
  }

  const gmailDraft = GmailApp.createDraft(to, subject, emailBody, {
    htmlBody: textToHtmlEmail_(emailBody),
    name: 'Plan B Media'
  });

  updateEmailDraftLog_(draftId, {
    recipient: to,
    subject: subject,
    body: emailBody,
    status: 'Gmail Draft',
    gmailDraftId: gmailDraft.getId()
  });

  appendActivity_({
    brandId,
    brandName: brand.Brand_Name || brandId,
    type: 'GMAIL_DRAFT_CREATED',
    newStatus: brand.Salesforce_Status || 'Available',
    buyingSignal: brand.Last_Buying_Signal || '',
    signalDate: brand.Last_Signal_Date || '',
    details: 'Gmail draft created for ' + to + ' · Draft ID ' + gmailDraft.getId(),
    origin: body.origin || 'Email Drafting',
    createdBy: body.createdBy || 'AI Sales Radar'
  });

  return {
    draftId: draftId,
    gmailDraftId: gmailDraft.getId(),
    gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    recipient: to,
    subject: subject,
    sent: false
  };
}

function updateEmailDraftLog_(draftId, patch) {
  if (!draftId) return;
  const sheet = getSpreadsheet_().getSheetByName(RADAR.sheets.emailDrafts);
  const data = valuesWithHeaders_(sheet);
  const rowIndex = findRowByValue_(data.values, data.map.Draft_ID, draftId);
  if (rowIndex < 2) return;

  setCellByHeader_(sheet,rowIndex,data.map,'Recipient',patch.recipient);
  setCellByHeader_(sheet,rowIndex,data.map,'Subject',patch.subject);
  setCellByHeader_(sheet,rowIndex,data.map,'Body',patch.body);
  setCellByHeader_(sheet,rowIndex,data.map,'Status',patch.status);
  setCellByHeader_(sheet,rowIndex,data.map,'Gmail_Draft_ID',patch.gmailDraftId);
  setCellByHeader_(sheet,rowIndex,data.map,'Last_Updated',now_());
}

function textToHtmlEmail_(text) {
  const escaped = String(text || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return '<div style="font-family:Arial,sans-serif;line-height:1.55;color:#222">' + linked.replace(/\n/g,'<br>') + '</div>';
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
