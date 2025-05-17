// compare.js

// 0. Alias groups mapping (all keys & values lower‑cased for matching)
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

// 2. Compute per‑employee averages
function computeAverages(data) {
  const groups = {};
  data.forEach((i) => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name]) {
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
    }
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

// 3. Compute overall group average
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

// 4. Compute a group-average for a selected account
function computeAccountGroupAvg(accountName) {
  const key = accountName.toLowerCase();
  const groupKeys = ACCOUNT_GROUPS[key] || [key];
  const rows = rawData.filter((r) =>
    groupKeys.includes((r.AccountName || "").toLowerCase())
  );
  const perEmp = computeAverages(rows);
  return computeGroupAvg(perEmp);
}

// 5. Initialize the compare page controls
function initComparePage(data) {
  rawData = data;

  // Populate the account datalist
  const list = document.getElementById("account-list");
  list.innerHTML = "";
  Array.from(new Set(data.map((r) => r.AccountName).filter(Boolean)))
    .sort()
    .forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc;
      list.appendChild(opt);
    });

  // Default metric to "all"
  document.getElementById("compare-metric").value = "all";

  // Wire up the Compare button
  document.getElementById("compare-btn").addEventListener("click", () => {
    const a = document.getElementById("accountA").value;
    const b = document.getElementById("accountB").value;
    const metric = document.getElementById("compare-metric").value;
    if (!a || !b || a === b) {
      alert("Pick two different accounts");
      return;
    }

    const avgA = computeAccountGroupAvg(a);
    const avgB = computeAccountGroupAvg(b);

    document.getElementById("labelA").textContent = a;
    document.getElementById("labelB").textContent = b;

    updateCompareChart(avgA, avgB, metric);
    updateCompareTable(avgA, avgB);
  });
}

// 6. Render the Chart.js bar chart (with dual axes)
let compareChart = null;
function updateCompareChart(a, b, metric) {
  const ctx = document.getElementById("compareChart").getContext("2d");
  if (compareChart) compareChart.destroy();

  const nameA = document.getElementById("labelA").textContent;
  const nameB = document.getElementById("labelB").textContent;

  // x‑axis will be the two accounts
  const labels = [nameA, nameB];
  const datasets = [];

  if (metric === "all") {
    // three series: pieces/hr & SKU/hr on left axis, $/hr on right
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
    // single‑metric view
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
        // left axis for pieces & SKU
        yPieces: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Pieces & SKU per hr" },
        },
        // right axis for dollars
        yDollars: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: "$ per hr" },
          ticks: { callback: (v) => "$" + v },
        },
      },
      plugins: {
        legend: { position: "top" },
      },
    },
  });
}

// 7. Populate the comparison table
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

// 8. On load: fetch the JSON and initialize
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("EmployeeProductionExport.json");
  const json = await res.json();
  initComparePage(json.EmployeeProductionExportLashaun);
});
