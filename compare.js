// compare.js

// 0. Alias groups (all keys lower‑cased)
const ACCOUNT_GROUPS = {
  "mariano's": ["mariano's", "kroger"],
  kroger: ["mariano's", "kroger"],

  "piggly wiggly": [
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

  "ascension rx - per k": ["ascension rx - per k", "ascension rx - man hr"],
  "ascension rx - man hr": ["ascension rx - per k", "ascension rx - man hr"],

  "fuel on": ["relaince fuel, llc", "reliance fuel, llc", "fuel on", "schierl"],
};

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
  const key = accountName.toLowerCase();
  const groupKeys = ACCOUNT_GROUPS[key] || [key];
  // 5a) filter by account
  let rows = rawData.filter((r) =>
    groupKeys.includes((r.AccountName || "").toLowerCase())
  );
  // 5b) then by timeframe
  rows = filterByTimeframe(rows, tf);
  const perEmp = computeAverages(rows);
  return computeGroupAvg(perEmp);
}

// 6. Initialize page controls & events
function initComparePage(data) {
  // Store the raw data for use in comparisons
  rawData = data;

  // 1. Populate the account datalist
  const list = document.getElementById("account-list");
  list.innerHTML = "";
  Array.from(new Set(data.map((r) => r.AccountName).filter(Boolean)))
    .sort()
    .forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc;
      list.appendChild(opt);
    });

  // 2. Default the timeframe selector to “Last year”
  document.getElementById("timeframe-select").value = "year";

  // 3. The shared compare routine
  function doCompare() {
    const a = document.getElementById("accountA").value;
    const b = document.getElementById("accountB").value;
    const metric = document.getElementById("compare-metric").value;
    const tf = document.getElementById("timeframe-select").value;

    // require two different accounts
    if (!a || !b || a === b) return;

    // --- Filter & compute for Account A ---
    const keyA = a.toLowerCase();
    let rowsA = rawData.filter((r) =>
      (ACCOUNT_GROUPS[keyA] || [keyA]).includes(
        (r.AccountName || "").toLowerCase()
      )
    );
    rowsA = filterByTimeframe(rowsA, tf);
    const perEmpA = computeAverages(rowsA);
    const avgA = computeGroupAvg(perEmpA);

    // --- Filter & compute for Account B ---
    const keyB = b.toLowerCase();
    let rowsB = rawData.filter((r) =>
      (ACCOUNT_GROUPS[keyB] || [keyB]).includes(
        (r.AccountName || "").toLowerCase()
      )
    );
    rowsB = filterByTimeframe(rowsB, tf);
    const perEmpB = computeAverages(rowsB);
    const avgB = computeGroupAvg(perEmpB);

    // 4. Update the account‐level chart & table
    document.getElementById("labelA").textContent = a;
    document.getElementById("labelB").textContent = b;
    updateCompareChart(avgA, avgB, metric);
    updateCompareTable(avgA, avgB);

    // 5. Update the employee‐level header & table
    updateEmployeeCompareHeader();
    updateEmployeeCompareTable(perEmpA, perEmpB);
  }

  // 4. Hook up auto‐compare on any control change
  ["accountA", "accountB", "compare-metric", "timeframe-select"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, doCompare);
    }
  );

  // 5. Run once to populate with defaults
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${key.replace(/_/g, " ").toUpperCase()}</td>
          <td>${a[key].toFixed(2)}</td>
          <td>${b[key].toFixed(2)}</td>
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

  // union of employee names
  const names = Array.from(
    new Set([...perA, ...perB].map((r) => r.name))
  ).sort();

  names.forEach((name) => {
    const aRow = perA.find((r) => r.name === name) || {};
    const bRow = perB.find((r) => r.name === name) || {};

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${name}</td>
        <td>${(aRow.pieces || 0).toFixed(2)}</td>
        <td>${(bRow.pieces || 0).toFixed(2)}</td>
        <td>${(aRow.skus || 0).toFixed(2)}</td>
        <td>${(bRow.skus || 0).toFixed(2)}</td>
        <td>${(aRow.dollars || 0).toFixed(2)}</td>
        <td>${(bRow.dollars || 0).toFixed(2)}</td>
      `;
    tbody.appendChild(tr);
  });
}

// --- auto‑clear inputs on focus (for compare page) ---
function setupAutoClear() {
  // only clear the account inputs
  ["accountA", "accountB"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("focus", () => {
      if (input.value !== "") {
        input.value = "";
      }
    });
  });
}
