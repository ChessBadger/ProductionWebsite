// store-comparison.js
let rawData = [];

/** 1) Load & unwrap the JSON export */
async function loadData() {
  const resp = await fetch("EmployeeProductionExport.json");
  if (!resp.ok) throw new Error(`Failed to load data: ${resp.statusText}`);
  const json = await resp.json();
  // If it's an object wrapper, grab its first array property
  const arr = Array.isArray(json) ? json : json[Object.keys(json)[0]];
  if (!Array.isArray(arr)) throw new Error("JSON did not contain an array");
  return arr;
}

/** 2) Populate Account autocomplete */
function initAccountDatalist(data) {
  const list = document.getElementById("account-list");
  const accts = Array.from(
    new Set(data.map((r) => r.AccountName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  list.innerHTML = accts.map((a) => `<option value="${a}">`).join("");
}

/** 3) Compute & render the table rows */
function updateTable() {
  const acct = document.getElementById("account-search").value.trim();
  const slice = acct ? rawData.filter((r) => r.AccountName === acct) : rawData;

  // Group by StoreName
  const groups = {};
  slice.forEach((r) => {
    const store = r.StoreName || "(no store)";
    groups[store] = groups[store] || [];
    groups[store].push(r);
  });

  const tbody = document.querySelector("#store-table tbody");
  tbody.innerHTML = ""; // clear

  // Helper: average of a numeric field
  const avgOf = (arr, field) =>
    arr.reduce((sum, x) => sum + Number(x[field] || 0), 0) / arr.length;

  Object.entries(groups).forEach(([store, recs]) => {
    // compute averages as before
    const avgOf = (arr, f) =>
      arr.reduce((s, x) => s + Number(x[f] || 0), 0) / arr.length;

    // NEW: grand total of ext_qty
    const totalExtQty = recs.reduce(
      (sum, x) => sum + Number(x.ext_qty || 0),
      0
    );

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${store}</td>
      <td>${avgOf(recs, "PiecesPerHr").toFixed(2)}</td>
      <td>${avgOf(recs, "DollarPerHr").toFixed(2)}</td>
      <td>${avgOf(recs, "SkusPerHr").toFixed(2)}</td>
-     <td>${recs.length}</td>
+     <td>${totalExtQty.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

/** 4) Make the table sortable */
function makeTableSortable(table) {
  const headers = table.querySelectorAll("th");
  headers.forEach((th, idx) => {
    let asc = true;
    th.addEventListener("click", () => {
      const type = th.dataset.type; // 'number' or 'string'
      const rows = Array.from(table.tBodies[0].rows);
      rows.sort((a, b) => {
        let aVal = a.cells[idx].textContent.trim();
        let bVal = b.cells[idx].textContent.trim();
        if (type === "number") {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        if (aVal < bVal) return asc ? -1 : 1;
        if (aVal > bVal) return asc ? 1 : -1;
        return 0;
      });
      // re-append in sorted order
      const tbody = table.tBodies[0];
      rows.forEach((r) => tbody.appendChild(r));

      // update arrow UI
      headers.forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(asc ? "sort-asc" : "sort-desc");

      asc = !asc;
    });
  });
}

/** Debounce helper */
function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** 5) Initialization */
document.addEventListener("DOMContentLoaded", () => {
  loadData()
    .then((data) => {
      rawData = data;
      initAccountDatalist(rawData);
      updateTable();
      makeTableSortable(document.getElementById("store-table"));

      document
        .getElementById("account-search")
        .addEventListener("input", debounce(updateTable));
    })
    .catch((err) => console.error("Error:", err));
});
