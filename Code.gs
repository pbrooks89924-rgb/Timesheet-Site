/**
 * Work Timsheets
 * Tabs: Categories | Workers | TimeEntries
 *
 * Categories:   A MainCategory | B SubCategory | C Target hours | D Site hours
 * Workers:      A worker name
 * TimeEntries:  A Timestamp | B Date | C Worker | D MainCategory
 *               E SubCategory | F Hours | G Notes | H Status
 *
 * Status is blank, or Void. Void rows stay in the sheet but are
 * left out of the Categories hours total.
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
  var data = (e && e.parameter && e.parameter.action === "recent")
    ? getRecent(e.parameter.worker || "")
    : getFormData();
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
  var lock = LockService.getScriptLock();
  try {
    var payload = readPayload(e);
    lock.waitLock(10000);
    var result = payload.action === "void" ? voidEntry(payload) : appendEntries(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function appendEntries(payload) {
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
      "",
    ];
  });

  if (rows.length) {
    LOG_SHEET.getRange(LOG_SHEET.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }
  return { success: true, count: rows.length };
}

function voidEntry(payload) {
  ensureStatusHeader();
  var row = Number(payload.row);
  if (!row || row < 2) throw new Error("That line could not be found.");
  var values = LOG_SHEET.getRange(row, 1, 1, 8).getValues()[0];
  if (String(values[2]) !== String(payload.worker)) throw new Error("That line is not yours.");
  if (String(values[3]) !== String(payload.main) || String(values[4]) !== String(payload.sub)) {
    throw new Error("That line has changed. Refresh and try again.");
  }
  if (Math.abs((Number(values[5]) || 0) - (Number(payload.hours) || 0)) > 0.001) {
    throw new Error("That line has changed. Refresh and try again.");
  }
  if (values[7] === "Void") throw new Error("Already removed.");
  var day = dayKey(values[1]);
  if (!day || day < daysAgoKey(7)) throw new Error("Only the last 7 days can be removed.");
  LOG_SHEET.getRange(row, 8).setValue("Void");
  return { success: true };
}

function ensureStatusHeader() {
  if (!LOG_SHEET.getRange("H1").getValue()) LOG_SHEET.getRange("H1").setValue("Status");
}

function dayKey(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function daysAgoKey(n) {
  var day = new Date();
  day.setDate(day.getDate() - n);
  return Utilities.formatDate(day, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getRecent(worker) {
  ensureStatusHeader();
  var data = LOG_SHEET.getDataRange().getValues();
  var cutoff = daysAgoKey(7);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (r[7] === "Void") continue;
    if (String(r[2]) !== String(worker)) continue;
    var day = dayKey(r[1]);
    if (!day || day < cutoff) continue;
    rows.push({
      row: i + 1,
      date: day,
      main: String(r[3] || ""),
      sub: String(r[4] || ""),
      hours: Number(r[5]) || 0,
      notes: String(r[6] || ""),
    });
  }
  rows.reverse();
  return { recent: rows };
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
  const categories = [];
  cats.forEach(function (r) {
    const main = r[0];
    const sub = r[1];
    if (!main || !sub) return;
    categories.push({
      main: String(main),
      sub: String(sub),
      target: Number(r[2]) || 0,
      actual: Number(r[3]) || 0,
    });
    if (mains.indexOf(main) === -1) mains.push(main);
    if (!mapping[main]) mapping[main] = [];
    if (mapping[main].indexOf(sub) === -1) mapping[main].push(sub);
  });

  return { workers: workers, mains: mains, mapping: mapping, categories: categories };
}
