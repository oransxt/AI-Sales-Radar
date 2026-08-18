# AI Sales Radar — Email Notifications (v1.9.6)

This module sends one Daily Radar summary email when a new `Daily_Radar` for the current Bangkok date is ready.

## What it sends

- Daily Radar date
- Total opportunities
- High/HOT opportunity count
- New and updated signal counts
- Estimated pipeline range
- Top 5 brands to check first
- Direct links to the live Dashboard and Google Sheet
- Reminder to mark Salesforce status as Available / Has Owner / Existing Client

## Setup (one time)

1. Open the master Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Click **+** next to Files → **Script**.
4. Name it `Notifications`.
5. Copy all code from `apps-script/Notifications.gs` in GitHub and paste it into the new file.
6. Save.
7. Select function `setupEmailNotifications` from the function dropdown.
8. Click **Run**.
9. Approve the additional Mail permission when Google asks.
10. Enter the email address that should receive notifications.
11. A test email is sent immediately.

After setup, an installable time-driven trigger checks every hour. It sends only when today's Daily Radar exists and that date has not already been notified.

## Manual test / controls

- `sendTestNotification()` — sends a connection test email.
- `sendLatestRadarNotificationNow()` — manually sends the latest Daily Radar summary.
- `disableEmailNotifications()` — disables the notification and removes its hourly trigger.
- `setupEmailNotifications()` — re-enable or change the recipient email.

## Why hourly instead of a fixed time

The discovery workflow can finish later than its nominal schedule. An hourly watcher is more robust: it sends after the new Daily Radar actually exists, while `LAST_NOTIFIED_DISCOVERY_DATE` prevents duplicate emails.

## Cost

No paid API is required. The module uses Google Apps Script `MailApp` under the Google account that owns/runs the Apps Script project. Normal Google Apps Script mail quotas apply.
