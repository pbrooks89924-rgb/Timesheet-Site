// Paste your deployed Apps Script web app URL here.
// Leave the placeholder to try the form with sample categories.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6Mug-7imdOobQiPASnfTDm8CZMK_rh_Hz0Ii9IwxS2sGn11ub-YSpwaZ5oinJ5dNFOw/exec";

const SAMPLE = {
  workers: ["Dave", "Pete"],
  mains: ["Roofing", "Groundworks", "Joinery", "External"],
  mapping: {
    Roofing: ["Slating", "Fascia Boards", "Ridges", "Felt and battens"],
    Groundworks: ["Excavation", "Drainage", "Foundations"],
    Joinery: ["First fix", "Second fix", "Door hanging"],
    External: ["Scaffold", "Guttering", "Render"],
  },
  categories: [
    { main: "Roofing", sub: "Slating", target: 40, actual: 28 },
    { main: "Roofing", sub: "Fascia Boards", target: 12, actual: 14 },
    { main: "Roofing", sub: "Ridges", target: 8, actual: 3 },
    { main: "Groundworks", sub: "Excavation", target: 24, actual: 24 },
    { main: "Groundworks", sub: "Drainage", target: 16, actual: 6 },
    { main: "Joinery", sub: "First fix", target: 30, actual: 4 },
    { main: "External", sub: "Scaffold", target: 10, actual: 0 },
  ],
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let formData = null;
let demoMode = false;
let selectedDate = startOfDay(new Date());
let windowCenter = startOfDay(new Date());

async function init() {
  renderDates();

  try {
    formData = await loadFormData();
  } catch (err) {
    const openedAsFile = location.protocol === "file:";
    showMessage(
      openedAsFile
        ? "Open this from a website, not by double-clicking the file. A local HTML file is not allowed to read the sheet."
        : "Could not load categories. Use the /exec link in script.js, not the long googleusercontent link.",
      "error",
    );
    return;
  }

  const wSel = document.getElementById("worker");
  formData.workers.forEach((w) => {
    const o = document.createElement("option");
    o.value = o.textContent = w;
    wSel.appendChild(o);
  });

  const lastWorker = localStorage.getItem("lastWorker");
  if (lastWorker && formData.workers.includes(lastWorker)) {
    wSel.value = lastWorker;
  }

  wSel.addEventListener("change", () => {
    localStorage.setItem("lastWorker", wSel.value);
    loadRecent();
  });

  addEntry();
  document.getElementById("submitBtn").disabled = false;
  loadRecent();

  if (demoMode) {
    showMessage(
      "Demo mode. Paste the Apps Script URL into script.js before real use.",
      "info",
    );
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, n) {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isoDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + m + "-" + d;
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + "th";
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

function renderDates() {
  const row = document.getElementById("dateRow");
  row.innerHTML = "";

  const left = document.createElement("button");
  left.type = "button";
  left.className = "date-arrow";
  left.setAttribute("aria-label", "Earlier dates");
  left.textContent = "‹";
  left.addEventListener("click", () => {
    windowCenter = addDays(windowCenter, -1);
    renderDates();
  });

  const strip = document.createElement("div");
  strip.className = "date-strip";

  for (let offset = -1; offset <= 1; offset++) {
    const day = addDays(windowCenter, offset);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    if (sameDay(day, selectedDate)) btn.classList.add("selected");
    btn.innerHTML =
      '<span class="wk">' + WEEKDAYS[day.getDay()] + "</span>" +
      '<span class="num">' + ordinal(day.getDate()) + "</span>";
    btn.addEventListener("click", () => {
      selectedDate = day;
      renderDates();
    });
    strip.appendChild(btn);
  }

  const right = document.createElement("button");
  right.type = "button";
  right.className = "date-arrow";
  right.setAttribute("aria-label", "Later dates");
  right.textContent = "›";
  right.addEventListener("click", () => {
    windowCenter = addDays(windowCenter, 1);
    renderDates();
  });

  row.append(left, strip, right);
}

async function loadFormData() {
  if (!SCRIPT_URL || SCRIPT_URL.includes("YOUR_APPS_SCRIPT")) {
    demoMode = true;
    return SAMPLE;
  }
  const res = await fetch(SCRIPT_URL + "?action=getData");
  if (!res.ok) throw new Error("status " + res.status);
  const data = await res.json();
  if (!data || !Array.isArray(data.workers)) throw new Error("bad data");
  return data;
}

function addEntry() {
  if (!formData) return;

  const div = document.createElement("div");
  div.className = "entry";
  div.innerHTML = `
    <button class="remove" type="button" aria-label="Remove job">×</button>
    <label>Main category</label>
    <select class="main">
      <option value="">Select…</option>
    </select>
    <label>Subcategory</label>
    <select class="sub">
      <option value="">Select main first</option>
    </select>
    <label>Hours</label>
    <input type="number" class="hours" step="0.25" min="0" max="16" placeholder="0" inputmode="decimal">
    <label>Notes</label>
    <textarea class="notes" placeholder="Anything I should know"></textarea>
  `;

  const mainSel = div.querySelector(".main");
  formData.mains.forEach((m) => {
    const o = document.createElement("option");
    o.value = o.textContent = m;
    mainSel.appendChild(o);
  });

  div.querySelector(".remove").addEventListener("click", () => {
    div.remove();
    updateTotal();
  });
  mainSel.addEventListener("change", () => fillSubs(mainSel));
  div.querySelector(".hours").addEventListener("input", updateTotal);

  document.getElementById("entries").appendChild(div);
}

function fillSubs(mainSel) {
  const subSel = mainSel.parentElement.querySelector(".sub");
  subSel.innerHTML = '<option value="">Select…</option>';
  const main = mainSel.value;
  if (main && formData.mapping[main]) {
    formData.mapping[main].forEach((s) => {
      const o = document.createElement("option");
      o.value = o.textContent = s;
      subSel.appendChild(o);
    });
  }
}

function updateTotal() {
  let t = 0;
  document.querySelectorAll(".hours").forEach((inp) => {
    t += Number(inp.value) || 0;
  });
  document.getElementById("total").textContent = t.toFixed(2);
}

async function submitAll() {
  const entries = [];
  document.querySelectorAll(".entry").forEach((div) => {
    const main = div.querySelector(".main").value;
    const sub = div.querySelector(".sub").value;
    const hours = Number(div.querySelector(".hours").value);
    const notes = div.querySelector(".notes").value.trim();
    if (main && sub && hours > 0) {
      entries.push({ main, sub, hours, notes });
    }
  });

  if (!entries.length) {
    showMessage("Add at least one job with hours greater than 0.", "error");
    return;
  }

  const worker = document.getElementById("worker").value;
  localStorage.setItem("lastWorker", worker);

  if (demoMode) {
    showMessage(
      "Demo only — nothing was written. Connect the Apps Script URL to save.",
      "info",
    );
    return;
  }

  const payload = {
    date: isoDate(selectedDate),
    worker,
    entries,
  };

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  showOverlay("Submitting", true);

  try {
    const result = await postTimesheet(payload);
    if (!result.success) throw new Error(result.error || "The sheet did not confirm the save.");
    showOverlay("Submitted!", false);
    await wait(2000);
    hideOverlay();
    document.getElementById("entries").innerHTML = "";
    selectedDate = startOfDay(new Date());
    windowCenter = startOfDay(new Date());
    renderDates();
    addEntry();
    updateTotal();
    document.getElementById("message").innerHTML = "";
    loadRecent();
  } catch (err) {
    hideOverlay();
    showMessage("Failed to save: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit timesheet";
  }
}

function showOverlay(text, spinning) {
  const overlay = document.getElementById("overlay");
  const card = overlay.querySelector(".overlay-card");
  document.getElementById("overlayText").textContent = text;
  document.getElementById("spinner").classList.toggle("done", !spinning);
  card.style.transition = "none";
  card.style.opacity = "0";
  card.style.transform = "translateY(16px)";
  void card.offsetWidth;
  card.style.transition = "";
  card.style.opacity = "";
  card.style.transform = "";
  overlay.classList.add("show");
}

function hideOverlay() {
  document.getElementById("overlay").classList.remove("show");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postTimesheet(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error("status " + res.status);
    return data;
  });
}

function friendlyDate(iso) {
  const parts = String(iso).split("-");
  const day = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(day.getTime())) return iso;
  return WEEKDAYS[day.getDay()] + " " + ordinal(day.getDate());
}

function loadRecent() {
  const box = document.getElementById("recent");
  const worker = document.getElementById("worker").value;
  if (!worker) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = '<p class="recent-empty">Loading…</p>';
  fetchRecent(worker)
    .then((rows) => renderRecent(rows))
    .catch(() => {
      box.innerHTML = '<p class="recent-empty">Could not load recent entries.</p>';
    });
}

function openRecent() {
  document.getElementById("recentPop").classList.add("show");
  loadRecent();
}

function closeRecent() {
  document.getElementById("recentPop").classList.remove("show");
}

function fetchRecent(worker) {
  if (demoMode) {
    return Promise.resolve([
      { row: 1, date: isoDate(startOfDay(new Date())), main: "Roofing", sub: "Slating", hours: 6, notes: "" },
    ]);
  }
  return fetch(SCRIPT_URL + "?action=recent&worker=" + encodeURIComponent(worker))
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error("status " + res.status);
      if (!data || !Array.isArray(data.recent)) {
        throw new Error("Redeploy the Apps Script to turn on Remove.");
      }
      return data.recent;
    });
}

function renderRecent(rows) {
  const box = document.getElementById("recent");
  box.innerHTML = "";
  if (!rows.length) {
    box.innerHTML = '<p class="recent-empty">Nothing from the last 7 days.</p>';
    return;
  }
  rows.forEach((row) => {
    const line = document.createElement("div");
    line.className = "recent-row";
    const note = row.notes
      ? '<div class="recent-note">' + esc(row.notes) + "</div>"
      : "";
    line.innerHTML =
      '<div class="recent-copy">' +
        '<div class="recent-title">' + esc(friendlyDate(row.date) + " · " + row.sub) + "</div>" +
        '<div class="recent-meta">' + esc(formatHrs(row.hours) + " hrs · " + row.main) + "</div>" +
        note +
      "</div>" +
      '<button type="button" class="remove-entry">Remove</button>';
    line.querySelector(".remove-entry").addEventListener("click", () => askRemove(line, row));
    box.appendChild(line);
  });
}

function askRemove(line, row) {
  const actions = document.createElement("div");
  const no = document.createElement("button");
  no.type = "button";
  no.className = "confirm-no";
  no.textContent = "No";
  const yes = document.createElement("button");
  yes.type = "button";
  yes.className = "confirm-yes";
  yes.textContent = "Yes";
  no.addEventListener("click", () => loadRecent());
  yes.addEventListener("click", () => removeRecent(row, yes));
  actions.append(no, yes);
  line.querySelector(".remove-entry").replaceWith(actions);
}

async function removeRecent(row, button) {
  button.disabled = true;
  const worker = document.getElementById("worker").value;
  if (demoMode) {
    loadRecent();
    return;
  }
  try {
    const result = await postTimesheet({
      action: "void",
      worker,
      row: row.row,
      main: row.main,
      sub: row.sub,
      hours: row.hours,
    });
    if (!result.success) throw new Error(result.error || "The sheet did not confirm.");
    loadRecent();
  } catch (err) {
    showMessage("Could not remove that line: " + err.message, "error");
    loadRecent();
  }
}

function showMessage(text, type) {
  document.getElementById("message").innerHTML =
    '<div class="msg ' + type + '">' + text + "</div>";
}

document.getElementById("addBtn").addEventListener("click", addEntry);
document.getElementById("recentOpen").addEventListener("click", openRecent);
document.getElementById("recentClose").addEventListener("click", closeRecent);
document.getElementById("recentX").addEventListener("click", closeRecent);
document.getElementById("submitBtn").addEventListener("click", submitAll);
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
init();

function esc(value) {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/"/g, "\u0026quot;");
}

function formatHrs(n) {
  return String(Math.round((Number(n) || 0) * 100) / 100);
}

function barModel(actual, target) {
  const used = Number(actual) || 0;
  const allowed = Number(target) || 0;
  if (allowed <= 0) return { pct: used > 0 ? 100 : 0, over: used > 0 };
  return { pct: Math.min(used / allowed, 1) * 100, over: used > allowed };
}

function groupCategories(rows) {
  const groups = [];
  const index = {};
  (rows || []).forEach((row) => {
    if (!index[row.main]) {
      index[row.main] = { main: row.main, subs: [] };
      groups.push(index[row.main]);
    }
    index[row.main].subs.push(row);
  });
  return groups;
}

function meter(actual, target) {
  const model = barModel(actual, target);
  return (
    '<div class="bar' + (model.over ? " over" : "") + '">' +
      '<span style="width:' + model.pct + '%"></span>' +
    "</div>"
  );
}

function renderTargets() {
  const list = document.getElementById("targetList");
  const rows = formData && formData.categories;
  if (!rows) {
    list.innerHTML = '<p class="msg info">Redeploy the Apps Script, then open Target again. The sheet needs to send the target hours.</p>';
    return;
  }

  const groups = groupCategories(rows);
  let site = 0;
  let allowed = 0;
  list.innerHTML = "";

  groups.forEach((group) => {
    const actual = group.subs.reduce((sum, row) => sum + (Number(row.actual) || 0), 0);
    const target = group.subs.reduce((sum, row) => sum + (Number(row.target) || 0), 0);
    site += actual;
    allowed += target;

    const card = document.createElement("section");
    card.className = "target-card";
    card.innerHTML =
      '<div class="target-head">' +
        '<button type="button" class="expander" aria-expanded="false" aria-label="Show ' + esc(group.main) + '">+</button>' +
        '<div class="target-copy">' +
          '<div class="target-line"><h2>' + esc(group.main) + "</h2><span class=\"hrs\">" + formatHrs(actual) + "/" + formatHrs(target) + " hrs</span></div>" +
          meter(actual, target) +
        "</div>" +
      "</div>" +
      '<div class="subs" hidden></div>';

    const subs = card.querySelector(".subs");
    group.subs.forEach((row) => {
      const line = document.createElement("div");
      line.className = "sub-row";
      line.innerHTML =
        '<div class="target-line"><span class="sub-name">' + esc(row.sub) + '</span><span class="hrs">' +
        formatHrs(row.actual) + "/" + formatHrs(row.target) + " hrs</span></div>" +
        meter(row.actual, row.target);
      subs.appendChild(line);
    });

    card.querySelector(".expander").addEventListener("click", () => {
      const open = subs.hidden;
      subs.hidden = !open;
      const button = card.querySelector(".expander");
      button.textContent = open ? "–" : "+";
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    list.appendChild(card);
  });

  const whole = document.createElement("section");
  whole.className = "target-card";
  whole.innerHTML =
    '<div class="target-line"><span class="whole-name">Whole job</span><span class="hrs">' +
    formatHrs(site) + "/" + formatHrs(allowed) + " hrs</span></div>" +
    meter(site, allowed);
  list.appendChild(whole);
}

async function showView(name) {
  document.getElementById("sheetView").hidden = name !== "sheet";
  document.getElementById("targetView").hidden = name !== "target";
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  if (name !== "target") return;
  try {
    formData = await loadFormData();
  } catch (err) {
    document.getElementById("targetList").innerHTML =
      '<p class="msg error">Could not load targets from the sheet.</p>';
    return;
  }
  renderTargets();
}
