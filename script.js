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
  });

  addEntry();
  document.getElementById("submitBtn").disabled = false;

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

  for (let offset = -2; offset <= 2; offset++) {
    const day = addDays(windowCenter, offset);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    if (Math.abs(offset) === 2) btn.classList.add("faded");
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

function showMessage(text, type) {
  document.getElementById("message").innerHTML =
    '<div class="msg ' + type + '">' + text + "</div>";
}

document.getElementById("addBtn").addEventListener("click", addEntry);
document.getElementById("submitBtn").addEventListener("click", submitAll);
init();
