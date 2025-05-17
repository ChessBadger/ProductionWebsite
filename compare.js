// compare.js

// 0. Alias groups (all keys lower‑cased)
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
};

// build a quick map alias→canonical
const ACCOUNT_KEY_MAP = Object.entries(ACCOUNT_GROUPS).reduce(
  (map, [canonical, aliases]) => {
    map[canonical] = canonical;
    for (let a of aliases) {
      map[a] = canonical;
    }
    return map;
  },
  {}
);

// helper to normalize any name to its group key
function normalizeAccountKey(name) {
  return (
    ACCOUNT_KEY_MAP[name.trim().toLowerCase()] || name.trim().toLowerCase()
  );
}

// 1. Raw data container
let rawData = [];

// 2. Timeframe‑filter helper
function filterByTimeframe(rows, tf) {
  if (tf === "all") return rows;
  const cutoff = new Date();
  if (tf === "week") cutoff.setDate(cutoff.getDate() - 7);
  else if (tf === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  else if (tf === "6month") cutoff.setMonth(cutoff.getMonth() - 6);
  else if (tf === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return rows.filter((i) => new Date(i.DateOfInv) >= cutoff);
}

// 3. Compute per‑employee averages
function computeAverages(data) {
  const groups = {};
  data.forEach((i) => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name])
      groups[name] = {
        p: 0,
        d: 0,
        s: 0,
        delta: 0,
        g5: 0,
        g10: 0,
        g15: 0,
        c: 0,
      };
    groups[name].p += i.PiecesPerHr || 0;
    groups[name].d += i.DollarPerHr || 0;
    groups[name].s += i.SkusPerHr || 0;
    groups[name].delta += i.AVG_DELTA || 0;
    groups[name].g5 += i.GAP5_COUNT || 0;
    groups[name].g10 += i.GAP10_COUNT || 0;
    groups[name].g15 += i.GAP15_COUNT || 0;
    groups[name].c++;
  });
  return Object.entries(groups).map(([name, g]) => ({
    name,
    pieces: g.p / g.c,
    dollars: g.d / g.c,
    skus: g.s / g.c,
    avg_delta: g.delta / g.c,
    gap5: g.g5 / g.c,
    gap10: g.g10 / g.c,
    gap15: g.g15 / g.c,
  }));
}

// 4. Compute overall group average
function computeGroupAvg(rows) {
  const sum = rows.reduce(
    (acc, r) => {
      acc.pieces += r.pieces;
      acc.dollars += r.dollars;
      acc.skus += r.skus;
      acc.avg_delta += r.avg_delta;
      acc.gap5 += r.gap5;
      acc.gap10 += r.gap10;
      acc.gap15 += r.gap15;
      return acc;
    },
    {
      pieces: 0,
      dollars: 0,
      skus: 0,
      avg_delta: 0,
      gap5: 0,
      gap10: 0,
      gap15: 0,
    }
  );
  const n = rows.length || 1;
  return {
    name: "Group Average",
    pieces: sum.pieces / n,
    dollars: sum.dollars / n,
    skus: sum.skus / n,
    avg_delta: sum.avg_delta / n,
    gap5: sum.gap5 / n,
    gap10: sum.gap10 / n,
    gap15: sum.gap15 / n,
  };
}

// 5. Compute account‐group average, *with* timeframe
function computeAccountGroupAvg(accountName, tf) {
  // normalize the group key
  const normKey = normalizeAccountKey(accountName || "");

  // filter rows whose AccountName maps to that key
  let rows = rawData.filter(
    (r) => normalizeAccountKey(r.AccountName || "") === normKey
  );

  // apply the same timeframe logic
  rows = filterByTimeframe(rows, tf);

  // per‐employee averages, then group‐average
  const perEmp = computeAverages(rows);
  return computeGroupAvg(perEmp);
}

// 6. Initialize page controls & events
function initComparePage(data) {
  rawData = data;

  // account list
  const list = document.getElementById("account-list");
  list.innerHTML = "";
  Array.from(new Set(data.map((r) => r.AccountName).filter(Boolean)))
    .sort()
    .forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc;
      list.appendChild(opt);
    });

  // employee list
  const empList = document.getElementById("compare-employee-list");
  empList.innerHTML = "";
  Array.from(new Set(data.map((r) => `${r.FirstName} ${r.LastName}`)))
    .sort()
    .forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      empList.appendChild(opt);
    });

  // shared compare routine
  function doCompare() {
    // raw text from the two dropdowns
    const rawA = document.getElementById("accountA").value.trim();
    const rawB = document.getElementById("accountB").value.trim();
    // normalized keys
    const normA = normalizeAccountKey(rawA);
    const normB = normalizeAccountKey(rawB);

    const empTerm = document
      .getElementById("compare-employee-search")
      .value.trim()
      .toLowerCase();
    const metric = document.getElementById("compare-metric").value;
    const tf = document.getElementById("timeframe-select").value;

    // hide/show the employee‐compare section
    const empSection = document.querySelector(".employee-compare-section");
    if (empSection) {
      empSection.style.display = empTerm ? "none" : "block";
    }

    // nothing to do if either empty or they picked the same group
    if (!rawA || !rawB || normA === normB) return;

    // --- Account A ---
    let rowsA = rawData.filter(
      (r) => normalizeAccountKey(r.AccountName || "") === normA
    );
    rowsA = filterByTimeframe(rowsA, tf);
    if (empTerm) {
      rowsA = rowsA.filter((i) =>
        `${i.FirstName} ${i.LastName}`.toLowerCase().includes(empTerm)
      );
    }
    const perEmpA = computeAverages(rowsA);
    const avgA = computeGroupAvg(perEmpA);

    // --- Account B ---
    let rowsB = rawData.filter(
      (r) => normalizeAccountKey(r.AccountName || "") === normB
    );
    rowsB = filterByTimeframe(rowsB, tf);
    if (empTerm) {
      rowsB = rowsB.filter((i) =>
        `${i.FirstName} ${i.LastName}`.toLowerCase().includes(empTerm)
      );
    }
    const perEmpB = computeAverages(rowsB);
    const avgB = computeGroupAvg(perEmpB);

    // update the top‐level comparison
    document.getElementById("labelA").textContent = rawA;
    document.getElementById("labelB").textContent = rawB;
    updateCompareChart(avgA, avgB, metric);
    updateCompareTable(avgA, avgB);

    // update the per‐employee breakdown
    updateEmployeeCompareHeader();
    updateEmployeeCompareTable(perEmpA, perEmpB);
  }

  // auto‑run on any control change
  [
    "accountA",
    "accountB",
    "compare-employee-search",
    "compare-metric",
    "timeframe-select",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, doCompare);
  });

  // initial draw
  doCompare();
}

// 7. Render Chart.js with dual axes
let compareChart = null;
function updateCompareChart(a, b, metric) {
  const ctx = document.getElementById("compareChart").getContext("2d");
  if (compareChart) compareChart.destroy();

  const nameA = document.getElementById("labelA").textContent;
  const nameB = document.getElementById("labelB").textContent;
  const labels = [nameA, nameB];
  const datasets = [];

  if (metric === "all") {
    datasets.push(
      {
        label: "Pieces/hr",
        data: [a.pieces, b.pieces],
        yAxisID: "yPieces",
      },
      {
        label: "SKU/hr",
        data: [a.skus, b.skus],
        yAxisID: "yPieces",
      },
      {
        label: "$/hr",
        data: [a.dollars, b.dollars],
        yAxisID: "yDollars",
      }
    );
  } else {
    const display =
      metric === "pieces" ? "Pieces/hr" : metric === "skus" ? "SKU/hr" : "$/hr";
    datasets.push({
      label: display,
      data: [a[metric], b[metric]],
      yAxisID: metric === "dollars" ? "yDollars" : "yPieces",
    });
  }

  compareChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: {
        yPieces: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Pieces & SKU per hr" },
        },
        yDollars: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: "$ per hr" },
          ticks: { callback: (v) => "$" + v },
        },
      },
      plugins: { legend: { position: "top" } },
    },
  });
}

// 8. Populate comparison table
function updateCompareTable(a, b) {
  const tbody = document.querySelector("#compareTable tbody");
  tbody.innerHTML = "";
  ["pieces", "skus", "dollars", "avg_delta", "gap5", "gap10", "gap15"].forEach(
    (key) => {
      const label =
        key === "avg_delta"
          ? "AVG DELTA (s)"
          : key.replace(/_/g, " ").toUpperCase();
      const format = (v) => (key === "avg_delta" ? v * 60 : v).toFixed(2);

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${label}</td>
      <td>${format(a[key])}</td>
      <td>${format(b[key])}</td>
    `;

      tbody.appendChild(tr);
    }
  );
}

function setupEmployeeCompareSorting() {
  const table = document.getElementById("employeeCompareTable");
  const headers = table.querySelectorAll("th.sortable");

  headers.forEach((th, idx) => {
    let asc = true;
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const tbody = table.querySelector("tbody");
      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((a, b) => {
        let vA = a.children[idx].textContent.trim();
        let vB = b.children[idx].textContent.trim();
        // numeric vs string
        const nA = parseFloat(vA),
          nB = parseFloat(vB);
        if (!isNaN(nA) && !isNaN(nB)) {
          vA = nA;
          vB = nB;
        } else {
          vA = vA.toLowerCase();
          vB = vB.toLowerCase();
        }
        if (vA < vB) return asc ? -1 : 1;
        if (vA > vB) return asc ? 1 : -1;
        return 0;
      });
      // update sort classes
      headers.forEach((h) => h.classList.remove("asc", "desc"));
      th.classList.add(asc ? "asc" : "desc");
      // re‑append in new order
      rows.forEach((r) => tbody.appendChild(r));
      asc = !asc;
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("EmployeeProductionExport.json");
  const json = await res.json();
  initComparePage(json.EmployeeProductionExportLashaun);
  setupAutoClear();
  setupEmployeeCompareSorting();

  document.getElementById("refresh-btn")?.addEventListener("click", () => {
    window.location.reload();
  });
});

/**
 * Update the employee‐compare table header to show real account names
 */
function updateEmployeeCompareHeader() {
  const nameA = document.getElementById("labelA").textContent;
  const nameB = document.getElementById("labelB").textContent;

  ["pieces", "skus", "dollars"].forEach((metric) => {
    document.getElementById(`labelA-${metric}`).textContent = nameA;
    document.getElementById(`labelB-${metric}`).textContent = nameB;
  });
}

/**
 * Render the employee‐compare table body
 * perA / perB are arrays from computeAverages(rowsA) and computeAverages(rowsB)
 */
function updateEmployeeCompareTable(perA, perB) {
  const tbody = document.querySelector("#employeeCompareTable tbody");
  tbody.innerHTML = "";

  // 1. Build arrays of names for each account
  const namesA = perA.map((r) => r.name);
  const namesB = perB.map((r) => r.name);

  // 2. Compute intersection: only names present in both accounts
  const names = namesA.filter((name) => namesB.includes(name)).sort();

  // 3. For each common employee, append a row
  names.forEach((name) => {
    const aRow = perA.find((r) => r.name === name);
    const bRow = perB.find((r) => r.name === name);

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${name}</td>
        <td>${aRow.pieces.toFixed(2)}</td>
        <td>${bRow.pieces.toFixed(2)}</td>
        <td>${aRow.skus.toFixed(2)}</td>
        <td>${bRow.skus.toFixed(2)}</td>
        <td>${aRow.dollars.toFixed(2)}</td>
        <td>${bRow.dollars.toFixed(2)}</td>
      `;
    tbody.appendChild(tr);
  });
}

// --- auto‑clear inputs on focus (for compare page) ---
function setupAutoClear() {
  ["accountA", "accountB", "compare-employee-search"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("focus", () => {
      if (input.value !== "") {
        input.value = "";
        // force re-run of the compare logic
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
}
