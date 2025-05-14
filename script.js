// script.js

// 1. load and unwrap JSON
async function loadData() {
  const res  = await fetch('EmployeeProductionExport.json');
  const json = await res.json();
  return json.EmployeeProductionExportLashaun; // adjust key if different
}

// 2. populate datalist for store suggestions
function initStoreDatalist(data) {
  const list = document.getElementById('store-list');
  const stores = Array.from(new Set(data.map(i => i.StoreName))).sort();
  list.innerHTML = '';
  stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    list.appendChild(opt);
  });
}

// 3. main update logic: filter by store, employee, account, timeframe
function updateView(data) {
  const storeTerm    = document.getElementById('store-search').value.toLowerCase();
  const employeeTerm = document.getElementById('employee-search').value.toLowerCase();
  const accountTerm  = document.getElementById('account-search').value.toLowerCase();
  const tf           = document.getElementById('timeframe-select').value;
  const now          = new Date();

  let filtered = data.filter(i => {
    const storeMatch = !storeTerm || i.StoreName.toLowerCase().includes(storeTerm);
    const name       = `${i.FirstName} ${i.LastName}`.toLowerCase();
    const empMatch   = !employeeTerm || name.includes(employeeTerm);
    const acctMatch  = !accountTerm || (i.AccountName || '').toLowerCase().includes(accountTerm);
    return storeMatch && empMatch && acctMatch;
  });

  // timeframe filter by DateOfInv
  if (tf !== 'all') {
    const cutoff = new Date(now);
    if (tf === 'week')  cutoff.setDate(now.getDate() - 7);
    if (tf === 'month') cutoff.setMonth(now.getMonth() - 1);
    if (tf === 'year')  cutoff.setFullYear(now.getFullYear() - 1);
    filtered = filtered.filter(i => new Date(i.DateOfInv) >= cutoff);
  }

  renderTable(filtered);
  renderChartAverages(filtered);
}

// 4. render the raw table of filtered records
function renderTable(data) {
  const tbody = document.querySelector('#metricsTable tbody');
  tbody.innerHTML = '';
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.FirstName} ${item.LastName}</td>
      <td>${item.AccountName || ''}</td>
      <td>${item.StoreName}</td>
      <td>${new Date(item.DateOfInv).toLocaleDateString()}</td>
      <td>${(item.PiecesPerHr || 0).toFixed(2)}</td>
      <td>${(item.DollarPerHr || 0).toFixed(2)}</td>
      <td>${(item.SkusPerHr   || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. init Chart.js
let chart;
function initChart() {
  const ctx = document.getElementById('metricsChart').getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Pieces/hr', data: [], stack: 'a' },
        { label: '$/hr',      data: [], stack: 'b' },
        { label: 'SKU/hr',    data: [], stack: 'c' }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// 6. compute & update chart averages
function renderChartAverages(data) {
  const groups = {};
  data.forEach(i => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name]) groups[name] = { p:0, d:0, s:0, c:0 };
    groups[name].p += i.PiecesPerHr  || 0;
    groups[name].d += i.DollarPerHr  || 0;
    groups[name].s += i.SkusPerHr    || 0;
    groups[name].c++;
  });
  const rows = Object.entries(groups).map(([name, g]) => ({
    name,
    pieces:  g.c ? g.p / g.c : 0,
    dollars: g.c ? g.d / g.c : 0,
    skus:    g.c ? g.s / g.c : 0
  })).sort((a,b) => b.pieces - a.pieces);

  chart.data.labels             = rows.map(r => r.name);
  chart.data.datasets[0].data   = rows.map(r => r.pieces);
  chart.data.datasets[1].data   = rows.map(r => r.dollars);
  chart.data.datasets[2].data   = rows.map(r => r.skus);
  chart.update();
}

// 7. wire up on load
document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadData();
  initStoreDatalist(data);
  chart = initChart();

  ['store-search','employee-search','account-search','timeframe-select'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input',  () => updateView(data));
    el.addEventListener('change', () => updateView(data));
  });

  updateView(data);
});
