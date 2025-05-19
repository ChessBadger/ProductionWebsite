// expected.js

let data = [];
let currentEmps = [];
let selectedEmps = []; // { id, name, avg, role }
let currentWorkload = 0;
let avgType = "account"; // 'account' or 'store'
let currentRecs = []; // all rows for the selected store

// 0. Alias groups (all keys lower-cased)
const ACCOUNT_GROUPS = {
  //prettier-ignore
  "kroger": ["kroger", "mariano's"],

  // PIGGLY WIGGLY aliases
  "piggly wiggly": [
    "piggly wiggly",
    "piggly wiggly - franchise",
    "pigs coporate",
    "pigs dave s",
    "pigs fox brothers",
    "pigs jake b",
    "pigs malicki",
    "pigs migel",
    "pigs mike day",
    "pigs red",
    "pigs ryan o",
    "pigs stinebrinks",
    "pigs stoneridge",
    "pigs tietz",
  ],

  // ASCENSION
  "ascension rx": [
    "ascension rx",
    "ascension rx - per k",
    "ascension rx - man hr",
  ],

  //SCHIERL
  "fuel on": ["fuel on", "relaince fuel, llc", "reliance fuel, llc", "schierl"],

  //Single C-Store
  "single c-stores": [
    "single c-stores",
    "*single c-stores $-check",
    "*single c-stores $ cash",
  ],
};
const ACCOUNT_KEY_MAP = Object.entries(ACCOUNT_GROUPS).reduce((m, [k, als]) => {
  m[k] = k;
  als.forEach((a) => (m[a] = k));
  return m;
}, {});
function normalizeAccountKey(name) {
  return (
    ACCOUNT_KEY_MAP[name.trim().toLowerCase()] || name.trim().toLowerCase()
  );
}

// helper to normalize any name to its group key
function normalizeAccountKey(name) {
  return (
    ACCOUNT_KEY_MAP[name.trim().toLowerCase()] || name.trim().toLowerCase()
  );
}

async function fetchData() {
  const res = await fetch("EmployeeProductionExport.json");
  const json = await res.json();
  data = (json["EmployeeProductionExportLashaun"] || []).map((r) => ({
    ...r,
    StoreName: r.StoreName.trim(),
  }));
  initStoreAutocomplete();
}

function clearEmployees() {
  selectedEmps = [];
  document.getElementById("selected-emps").innerHTML = "";
  document.getElementById("sel-info").textContent = "";
  const inp = document.getElementById("emp-input");
  inp.value = "";
  inp.disabled = true;
  document.getElementById("suggestions").innerHTML = "";
  updateCalcButton();
}

function clearResults() {
  document.getElementById("workload-info").textContent = "";
  document.getElementById("time-result").textContent = "";
}

function initStoreAutocomplete() {
  const list = document.getElementById("stores");
  const names = [...new Set(data.map((r) => r.StoreName))].sort();
  names.forEach((name) => {
    const o = document.createElement("option");
    o.value = name;
    list.appendChild(o);
  });
  document
    .getElementById("store-input")
    .addEventListener("change", onStoreSelected);
}

function onStoreSelected(e) {
  const store = e.target.value.trim();
  clearEmployees();
  clearResults();

  if (!store) return;

  // grab & keep for "store"‑avg mode:

  const recs = data.filter((r) => r.StoreName.trim() === store);
  currentRecs = recs;
  if (!recs.length) return;

  // weighted‑average workload (same as before)…
  const totalsByDate = recs.reduce((m, r) => {
    m[r.DateOfInv] = (m[r.DateOfInv] || 0) + r.Total_Ext_Qty;
    return m;
  }, {});
  const dates = Object.keys(totalsByDate).sort(
    (a, b) => new Date(a) - new Date(b)
  );
  const n = dates.length;
  const rawW = dates.map((_, i) => i + 1);
  const wsum = rawW.reduce((s, w) => s + w, 0);
  const weights = rawW.map((w) => w / wsum);
  let weighted = 0;
  dates.forEach((d, i) => (weighted += totalsByDate[d] * weights[i]));
  currentWorkload = weighted;
  document.getElementById("workload-info").textContent =
    `Weighted avg workload for "${store}" over ${n} dates: ` +
    `${Math.round(weighted).toLocaleString()} pcs.`;

  buildEmployeeList(recs[0].AccountName);
}

function buildEmployeeList(account) {
  let acctRecs;
  if (avgType === "store") {
    // use everything for this store
    acctRecs = currentRecs;
  } else {
    // your old account‑group logic
    const normKey = normalizeAccountKey(account);
    acctRecs = data.filter(
      (r) => normalizeAccountKey(r.AccountName || "") === normKey
    );
  }

  // tally PiecesPerHr per employee from acctRecs …
  const stats = {};
  acctRecs.forEach((r) => {
    const id = r.Employee;
    if (!stats[id]) {
      stats[id] = { name: `${r.FirstName} ${r.LastName}`, total: 0, count: 0 };
    }
    stats[id].total += r.PiecesPerHr;
    stats[id].count++;
  });

  currentEmps = Object.entries(stats)
    .map(([id, v]) => ({ id, name: v.name, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg);

  document.getElementById("emp-input").disabled = false;
}

function updateSuggestions() {
  const q = document.getElementById("emp-input").value.trim().toLowerCase();
  const sug = document.getElementById("suggestions");
  sug.innerHTML = "";
  if (!q) return;

  currentEmps
    .filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) &&
        !selectedEmps.some((s) => s.id === emp.id)
    )
    .slice(0, 8)
    .forEach((emp) => {
      const li = document.createElement("li");
      li.textContent = `${emp.name} — ${emp.avg.toFixed(1)} pph`;
      li.addEventListener("click", () => onSuggestionClick(emp));
      sug.appendChild(li);
    });
}

function onSuggestionClick(emp) {
  selectedEmps.push({ ...emp, role: "general" });
  renderTag(emp.id);
  updateSelectedInfo();
  updateCalcButton();
  document.getElementById("emp-input").value = "";
  document.getElementById("suggestions").innerHTML = "";
}

function renderTag(id) {
  const sel = selectedEmps.find((e) => e.id === id);
  const container = document.getElementById("selected-emps");
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.dataset.id = id;

  // name
  const nameSpan = document.createElement("span");
  nameSpan.textContent = sel.name;
  tag.appendChild(nameSpan);

  // role dropdown now shows percentages
  const roleSelect = document.createElement("select");
  roleSelect.className = "role-select";

  // 1) list of roles
  const ROLES = ["general", "supervisor", "rx", "late", "early"];
  // 2) how much of avg throughput each does
  const ROLE_FACTORS = {
    general: 1.0,
    supervisor: 0.3,
    rx: 0.5,
    late: 0.5,
    early: 0.75,
  };
  // 3) pretty display names
  const ROLE_LABELS = {
    general: "General",
    supervisor: "Supervisor",
    rx: "Kroger Rx",
    late: "Arriving Late",
    early: "Leaving Early",
  };

  ROLES.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    // compute percent = factor × 100, rounded if you like
    const pct = Math.round(ROLE_FACTORS[r] * 100);
    opt.text = `${ROLE_LABELS[r]} (${pct}%)`;
    roleSelect.appendChild(opt);
  });

  roleSelect.value = sel.role;
  roleSelect.addEventListener("change", (e) => setRole(id, e.target.value));
  tag.appendChild(roleSelect);

  container.appendChild(tag);
}

function setRole(id, role) {
  const idx = selectedEmps.findIndex((e) => e.id === id);
  if (idx !== -1) selectedEmps[idx].role = role;
  enforceRoleLimits();
}

function removeTag(id) {
  selectedEmps = selectedEmps.filter((e) => e.id !== id);
  const tag = document.querySelector(`.tag[data-id="${id}"]`);
  if (tag) tag.remove();
  updateSelectedInfo();
  updateCalcButton();
}

function enforceRoleLimits() {
  const supCount = selectedEmps.filter((e) => e.role === "supervisor").length;
  const rxCount = selectedEmps.filter((e) => e.role === "rx").length;

  document.querySelectorAll(".tag").forEach((tag) => {
    const sel = selectedEmps.find((e) => e.id === tag.dataset.id);
    const selElem = tag.querySelector("select.role-select");

    // Supervisor: only one
    selElem.querySelector('option[value="supervisor"]').disabled =
      sel.role !== "supervisor" && supCount >= 1;

    // Rx: max two
    selElem.querySelector('option[value="rx"]').disabled =
      sel.role !== "rx" && rxCount >= 2;

    // "Late" stays always enabled
  });

  updateSelectedInfo();
  updateCalcButton();
}

function updateSelectedInfo() {
  const info = document.getElementById("sel-info");
  if (!selectedEmps.length) {
    info.textContent = "";
    return;
  }
  const parts = selectedEmps.map((e) => `${e.name} (${e.role})`);
  info.textContent = `${selectedEmps.length} employees selected`;
}

function updateCalcButton() {
  // enable Calculate as soon as at least one employee is selected
  const btn = document.getElementById("calc-btn");
  btn.disabled = selectedEmps.length === 0;
}

function calculateTime() {
  let capacity = 0;
  selectedEmps.forEach((e) => {
    let factor = 1;
    if (e.role === "early") factor = 0.75;
    if (e.role === "late" || e.role === "rx") factor = 0.5;
    if (e.role === "supervisor") factor = 0.3;
    capacity += e.avg * factor;
  });
  const hours = currentWorkload / capacity;
  document.getElementById("time-result").textContent =
    `Estimated: ${hours.toFixed(2)} hrs ` +
    `(capacity: ${capacity.toFixed(1)} pph)`;
}

document.addEventListener("DOMContentLoaded", () => {
  fetchData();
  document
    .getElementById("emp-input")
    .addEventListener("input", updateSuggestions);
  document.getElementById("emp-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const items = document.querySelectorAll("#suggestions li");
      if (items.length === 1) {
        e.preventDefault();
        items[0].click();
      }
    }
  });
  document.getElementById("calc-btn").addEventListener("click", calculateTime);
});

// handle switching between account/store
document.querySelectorAll('input[name="avg-type"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    avgType = e.target.value;
    const storeInput = document.getElementById("store-input");
    // if a store is already selected, re‑trigger
    if (storeInput.value.trim()) {
      storeInput.dispatchEvent(new Event("change"));
    }
  });
});
