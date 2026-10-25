/**
 * Work Timsheets
 * Tabs: Categories | Workers | TimeEntries
 *
 * Categories:   A MainCategory | B SubCategory
 * Workers:      A worker name
 * TimeEntries:  A Timestamp | B Date | C Worker | D MainCategory
 *               E SubCategory | F Hours | G Notes
 *
 * Deploy: Extensions → Apps Script → paste this file →
 * Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the web app URL into script.js (SCRIPT_URL).
 */
const SS = SpreadsheetApp.getActiveSpreadsheet();
const CAT_SHEET = SS.getSheetByName("Categories");
const WORKER_SHEET = SS.getSheetByName("Workers");
const LOG_SHEET = SS.getSheetByName("TimeEntries");

function doGet(e) {
  var data = getFormData();
  var callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[A-Za-z0-9_]+$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(data) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = readPayload(e);
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var now = new Date();
    var rows = (payload.entries || []).map(function (entry) {
      return [
        now,
        payload.date,
        payload.worker,
        entry.main,
        entry.sub,
        Number(entry.hours),
        entry.notes || "",
      ];
    });

    if (rows.length) {
      LOG_SHEET.getRange(LOG_SHEET.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    }

    lock.releaseLock();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function readPayload(e) {
  if (e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  return JSON.parse(e.postData.contents);
}

function getFormData() {
  const cats = CAT_SHEET.getDataRange().getValues().slice(1);
  const workers = WORKER_SHEET.getDataRange().getValues().slice(1)
    .map(function (r) { return r[0]; })
    .filter(Boolean);

  const mains = [];
  const mapping = {};
  cats.forEach(function (r) {
    const main = r[0];
    const sub = r[1];
    if (!main || !sub) return;
    if (mains.indexOf(main) === -1) mains.push(main);
    if (!mapping[main]) mapping[main] = [];
    if (mapping[main].indexOf(sub) === -1) mapping[main].push(sub);
  });

  return { workers: workers, mains: mains, mapping: mapping };
}
