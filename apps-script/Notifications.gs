const RADAR_NOTIFY = {
  version: '1.9.6',
  timezone: 'Asia/Bangkok',
  dashboardUrl: 'https://oransxt.github.io/AI-Sales-Radar/',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1CC6qCo8ThdOiSfmfVdzxSuTArVQ5ZVfmRmw5lUNw6oo/edit',
  triggerHandler: 'emailNotificationHeartbeat'
};

/**
 * Run once from Apps Script after adding this file.
 * Prompts for the recipient email, installs an hourly watcher, and sends a test email.
 */
function setupEmailNotifications() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail() || '';
  const hint = existing ? ('Current/default: ' + existing + '\n\n') : '';
  const response = ui.prompt(
    'AI Sales Radar — Email Notification',
    hint + 'Enter the email address that should receive Daily Radar notifications:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;
  const email = String(response.getResponseText() || '').trim();
  if (!isValidEmail_(email)) {
    ui.alert('Invalid email address. Please run setupEmailNotifications() again.');
    return;
  }

  props.setProperties({
    NOTIFY_EMAIL: email,
    NOTIFY_ENABLED: 'true',
    NOTIFY_VERSION: RADAR_NOTIFY.version
  });

  removeNotificationTriggers_();
  ScriptApp.newTrigger(RADAR_NOTIFY.triggerHandler)
    .timeBased()
    .everyHours(1)
    .create();

  if (typeof upsertConfig_ === 'function') {
    upsertConfig_('Notification Module', 'Email / MailApp');
    upsertConfig_('Notification Version', RADAR_NOTIFY.version);
    upsertConfig_('Notification Status', 'Enabled');
    upsertConfig_('Notification Recipient', email);
    upsertConfig_('Notification Trigger', 'Hourly watcher; sends once per new Daily Radar date');
  }

  sendTestNotification();
  ui.alert(
    'Email notification enabled',
    'A test email was sent to ' + email + '. The system now checks hourly and sends only once when a new Daily Radar for today is ready.',
    ui.ButtonSet.OK
  );
}

function disableEmailNotifications() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('NOTIFY_ENABLED', 'false');
  removeNotificationTriggers_();
  if (typeof upsertConfig_ === 'function') {
    upsertConfig_('Notification Status', 'Disabled');
  }
}

function sendTestNotification() {
  const email = getNotificationEmail_();
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error('No remaining MailApp recipient quota today.');
  }
  MailApp.sendEmail({
    to: email,
    subject: 'AI Sales Radar — Email notification is ready',
    body: 'AI Sales Radar email notification has been enabled successfully.\n\nDashboard: ' + RADAR_NOTIFY.dashboardUrl + '\nGoogle Sheet: ' + RADAR_NOTIFY.sheetUrl,
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#17203a;line-height:1.5">' +
      '<h2 style="margin:0 0 8px">AI Sales Radar notification is ready</h2>' +
      '<p>Your Daily Radar email notification has been enabled successfully.</p>' +
      '<p><a href="' + RADAR_NOTIFY.dashboardUrl + '">Open Dashboard</a> &nbsp;·&nbsp; <a href="' + RADAR_NOTIFY.sheetUrl + '">Open Google Sheet</a></p>' +
      '<p style="color:#69728a;font-size:12px">Click Less. Close Deal More.</p>' +
      '</div>',
    name: 'AI Sales Radar'
  });
  return { ok: true, email: email };
}

/**
 * Installed time-driven trigger. It is intentionally cheap to run:
 * - exits when notifications are disabled
 * - exits when today's radar is not ready
 * - exits when today's radar was already emailed
 */
function emailNotificationHeartbeat() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('NOTIFY_ENABLED') !== 'true') return;

  const rows = getDailyRadar_('', '');
  if (!rows || !rows.length) return;

  const discoveryDate = dateKey_(rows[0].Discovery_Date);
  const today = Utilities.formatDate(new Date(), RADAR_NOTIFY.timezone, 'yyyy-MM-dd');
  if (!discoveryDate || discoveryDate !== today) return;

  const lastNotified = props.getProperty('LAST_NOTIFIED_DISCOVERY_DATE') || '';
  if (lastNotified === discoveryDate) return;

  sendDailyRadarNotification_(rows, discoveryDate);
  props.setProperty('LAST_NOTIFIED_DISCOVERY_DATE', discoveryDate);
  props.setProperty('LAST_NOTIFICATION_AT', new Date().toISOString());

  if (typeof upsertConfig_ === 'function') {
    upsertConfig_('Last Notification Date', discoveryDate);
    upsertConfig_('Last Notification At', Utilities.formatDate(new Date(), RADAR_NOTIFY.timezone, 'yyyy-MM-dd HH:mm:ss'));
  }
}

/** Manual resend of the latest radar. Useful for testing. */
function sendLatestRadarNotificationNow() {
  const rows = getDailyRadar_('', '');
  if (!rows || !rows.length) throw new Error('Daily_Radar has no data.');
  const discoveryDate = dateKey_(rows[0].Discovery_Date) || 'Latest';
  sendDailyRadarNotification_(rows, discoveryDate);
  return { ok: true, discoveryDate: discoveryDate, count: rows.length };
}

function sendDailyRadarNotification_(rows, discoveryDate) {
  const email = getNotificationEmail_();
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error('No remaining MailApp recipient quota today.');
  }

  const sorted = rows.slice().sort(function(a, b) {
    return Number(a.Daily_Rank || 999) - Number(b.Daily_Rank || 999);
  });

  const newCount = sorted.filter(function(r) { return truthy_(r.Is_New); }).length;
  const updatedCount = sorted.filter(function(r) { return truthy_(r.Is_Updated); }).length;
  const highCount = sorted.filter(function(r) {
    const p = String(r.Priority || '').toUpperCase();
    return p === 'HIGH' || p === 'HOT';
  }).length;

  const revenueMin = sorted.reduce(function(sum, r) { return sum + number_(r.Revenue_Min_M_THB); }, 0);
  const revenueMax = sorted.reduce(function(sum, r) { return sum + number_(r.Revenue_Max_M_THB); }, 0);
  const top = sorted.slice(0, 5);

  const subject = 'AI Sales Radar — ' + sorted.length + ' opportunities ready • ' + discoveryDate;
  const plainRows = top.map(function(r) {
    return '#' + (r.Daily_Rank || '-') + ' ' + (r.Brand_Name || '-') + ' | ' + (r.Priority || '-') +
      ' | THB ' + formatM_(r.Revenue_Min_M_THB) + '–' + formatM_(r.Revenue_Max_M_THB) + 'M\n' +
      'Signal: ' + (r.Buying_Signal || '-');
  }).join('\n\n');

  const plain = [
    'AI Sales Radar — Daily Radar Ready',
    'Date: ' + discoveryDate,
    'Opportunities: ' + sorted.length,
    'High/HOT: ' + highCount,
    'New: ' + newCount + ' | Updated: ' + updatedCount,
    'Estimated pipeline: THB ' + formatM_(revenueMin) + '–' + formatM_(revenueMax) + 'M',
    '',
    'TOP 5',
    plainRows,
    '',
    'Next step: Open the dashboard and mark each brand Available / Has Owner / Existing Client.',
    'Dashboard: ' + RADAR_NOTIFY.dashboardUrl,
    'Google Sheet: ' + RADAR_NOTIFY.sheetUrl
  ].join('\n');

  const tableRows = top.map(function(r) {
    const source = String(r.Source_URL_1 || '');
    const brand = htmlEscape_(r.Brand_Name || '-');
    const brandCell = source
      ? '<a href="' + htmlEscape_(source) + '" style="color:#4157df;text-decoration:none;font-weight:700">' + brand + '</a>'
      : '<strong>' + brand + '</strong>';
    return '<tr>' +
      '<td style="padding:9px;border-bottom:1px solid #edf0f5">' + htmlEscape_(r.Daily_Rank || '-') + '</td>' +
      '<td style="padding:9px;border-bottom:1px solid #edf0f5">' + brandCell + '</td>' +
      '<td style="padding:9px;border-bottom:1px solid #edf0f5">' + htmlEscape_(r.Priority || '-') + '</td>' +
      '<td style="padding:9px;border-bottom:1px solid #edf0f5">฿' + formatM_(r.Revenue_Min_M_THB) + '–' + formatM_(r.Revenue_Max_M_THB) + 'M</td>' +
      '<td style="padding:9px;border-bottom:1px solid #edf0f5">' + htmlEscape_(r.Buying_Signal || '-') + '</td>' +
      '</tr>';
  }).join('');

  const html = '<div style="font-family:Arial,sans-serif;color:#17203a;line-height:1.45;max-width:900px;margin:auto">' +
    '<div style="background:#151b35;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">' +
      '<div style="font-size:12px;opacity:.75">AI SALES RADAR • THAILAND OOH/DOOH</div>' +
      '<h1 style="margin:6px 0 2px;font-size:26px">Daily Radar Ready</h1>' +
      '<div style="opacity:.85">' + htmlEscape_(discoveryDate) + ' • Click Less. Close Deal More.</div>' +
    '</div>' +
    '<div style="border:1px solid #e6e9f2;border-top:0;padding:22px 24px;border-radius:0 0 14px 14px">' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">' +
        metricHtml_(sorted.length, 'Opportunities') +
        metricHtml_(highCount, 'High / HOT') +
        metricHtml_(newCount, 'New') +
        metricHtml_(updatedCount, 'Updated') +
        metricHtml_('฿' + formatM_(revenueMin) + '–' + formatM_(revenueMax) + 'M', 'Est. Pipeline') +
      '</div>' +
      '<h3 style="margin:0 0 10px">Top 5 to check first</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f7f8fc;text-align:left">' +
        '<th style="padding:9px">#</th><th style="padding:9px">Brand</th><th style="padding:9px">Priority</th><th style="padding:9px">Potential</th><th style="padding:9px">Buying Signal</th>' +
      '</tr></thead><tbody>' + tableRows + '</tbody></table>' +
      '<div style="margin-top:20px;padding:15px;background:#f7f8fc;border-radius:10px">' +
        '<strong>Next step:</strong> Check Salesforce ownership and mark each brand <strong>Available / Has Owner / Existing Client</strong>. Only Available brands move to next-stage analysis.' +
      '</div>' +
      '<p style="margin:20px 0 0"><a href="' + RADAR_NOTIFY.dashboardUrl + '" style="display:inline-block;background:#4d5cff;color:#fff;text-decoration:none;padding:11px 15px;border-radius:8px;font-weight:700">Open AI Sales Radar</a> ' +
      '<a href="' + RADAR_NOTIFY.sheetUrl + '" style="display:inline-block;margin-left:8px;color:#4157df;text-decoration:none;padding:11px 8px">Open Master Sheet</a></p>' +
      '<p style="color:#69728a;font-size:11px;margin-top:20px">Estimated revenue is rule-based opportunity potential, not a disclosed client budget.</p>' +
    '</div>' +
  '</div>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: 'AI Sales Radar'
  });
}

function getNotificationEmail_() {
  const props = PropertiesService.getScriptProperties();
  const email = String(props.getProperty('NOTIFY_EMAIL') || '').trim();
  if (!isValidEmail_(email)) {
    throw new Error('Notification email is not configured. Run setupEmailNotifications() first.');
  }
  return email;
}

function removeNotificationTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === RADAR_NOTIFY.triggerHandler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function metricHtml_(value, label) {
  return '<div style="min-width:120px;padding:12px 14px;border:1px solid #e6e9f2;border-radius:10px;background:#fff">' +
    '<div style="font-size:20px;font-weight:800">' + htmlEscape_(value) + '</div>' +
    '<div style="font-size:11px;color:#69728a;margin-top:3px">' + htmlEscape_(label) + '</div>' +
  '</div>';
}

function dateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, RADAR_NOTIFY.timezone, 'yyyy-MM-dd');
  }
  const s = String(value || '').trim();
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, RADAR_NOTIFY.timezone, 'yyyy-MM-dd');
}

function number_(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function formatM_(value) {
  const n = number_(value);
  return String(Math.round(n * 10) / 10);
}

function truthy_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function htmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
