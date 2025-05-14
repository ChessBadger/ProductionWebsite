// script.js

let rawData = [];
let chart = null;
let employeeTrendChart = null;
let avgRows = [];

// 1. Load and unwrap JSON
async function loadData() {
  const res  = await fetch('EmployeeProductionExport.json');
  const json = await res.json();
  return json.EmployeeProductionExportLashaun;
}

// 2. Populate datalists for suggestions
function initStoreDatalist(data) {
  const list   = document.getElementById('store-list');
  const stores = Array.from(new Set(data.map(i => i.StoreName))).sort();
  list.innerHTML = '';
  stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    list.appendChild(opt);
  });
}
function initEmployeeDatalist(data) {
  const list      = document.getElementById('employee-list');
  const employees = Array.from(new Set(data.map(i => `${i.FirstName} ${i.LastName}`))).sort();
  list.innerHTML = '';
  employees.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e;
    list.appendChild(opt);
  });
}
function initAccountDatalist(data) {
  const list     = document.getElementById('account-list');
  const accounts = Array.from(new Set(data.map(i => i.AccountName || ''))).filter(a => a).sort();
  list.innerHTML = '';
  accounts.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    list.appendChild(opt);
  });
}

// 3. Compute per-employee averages (for avgTable/chart)
function computeAverages(data) {
  const groups = {};
  data.forEach(i => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name]) groups[name] = { p:0, d:0, s:0, delta:0, g5:0, g10:0, g15:0, c:0 };
    groups[name].p     += i.PiecesPerHr  || 0;
    groups[name].d     += i.DollarPerHr  || 0;
    groups[name].s     += i.SkusPerHr    || 0;
    groups[name].delta += i.AVG_DELTA    || 0;
    groups[name].g5    += i.GAP5_COUNT   || 0;
    groups[name].g10   += i.GAP10_COUNT  || 0;
    groups[name].g15   += i.GAP15_COUNT  || 0;
    groups[name].c++;
  });
  return Object.entries(groups).map(([name, g]) => ({
    name,
    pieces:    g.p     / g.c,
    dollars:   g.d     / g.c,
    skus:      g.s     / g.c,
    avg_delta: g.delta / g.c,
    gap5:      g.g5    / g.c,
    gap10:     g.g10   / g.c,
    gap15:     g.g15   / g.c
  }));
}

// 4. Compute the “Group Average” row
function computeGroupAvg(rows) {
  const sum = rows.reduce((acc, r) => {
    acc.pieces  += r.pieces;
    acc.dollars += r.dollars;
    acc.skus    += r.skus;
    acc.avg_delta += r.avg_delta;
    acc.gap5    += r.gap5;
    acc.gap10   += r.gap10;
    acc.gap15   += r.gap15;
    return acc;
  }, { pieces:0, dollars:0, skus:0, avg_delta:0, gap5:0, gap10:0, gap15:0 });
  const n = rows.length || 1;
  return {
    name: 'Group Average',
    pieces:    sum.pieces  / n,
    dollars:   sum.dollars / n,
    skus:      sum.skus    / n,
    avg_delta: sum.avg_delta / n,
    gap5:      sum.gap5    / n,
    gap10:     sum.gap10   / n,
    gap15:     sum.gap15   / n
  };
}

// 5. Render the raw filtered records table
function renderTable(data) {
  const tbody = document.querySelector('#metricsTable tbody');
  tbody.innerHTML = '';
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.FirstName} ${item.LastName}</td>
      <td>${item.AccountName||''}</td>
      <td>${item.StoreName}</td>
      <td>${new Date(item.DateOfInv).toLocaleDateString()}</td>
      <td>${(item.PiecesPerHr||0).toFixed(2)}</td>
      <td>${(item.DollarPerHr||0).toFixed(2)}</td>
      <td>${(item.SkusPerHr||0).toFixed(2)}</td>
      <td>${(item.AVG_DELTA||0).toFixed(2)}</td>
      <td>${item.GAP5_COUNT||0}</td>
      <td>${item.GAP10_COUNT||0}</td>
      <td>${item.GAP15_COUNT||0}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 6. Initialize main Chart.js bar chart (destroy if exists)
function initChart() {
  const ctx = document.getElementById('metricsChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Pieces/hr', data: [], yAxisID: 'yPieces' },
        { label: 'SKU/hr',    data: [], yAxisID: 'yPieces' },
        { label: '$/hr',      data: [], yAxisID: 'yDollars' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        yPieces: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Pieces & SKU per hr' }
        },
        yDollars: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '$ per hr' },
          ticks: { callback: v => '$' + v }
        },
        x: {
          ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 }
        }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// 7. Update main chart (skip the group average row)
function updateChart(rows) {
  const dataRows = rows.slice(1); // drop group average
  const metric = document.getElementById('metric-select').value;
  const topN   = Math.max(1, parseInt(document.getElementById('top-n').value) || 10);

  let sorted = [...dataRows];
  if (metric === 'pieces')      sorted.sort((a,b) => b.pieces  - a.pieces);
  else if (metric === 'skus')   sorted.sort((a,b) => b.skus    - a.skus);
  else if (metric === 'dollars')sorted.sort((a,b) => b.dollars - a.dollars);
  else                           sorted.sort((a,b) => b.pieces  - a.pieces);

  const sliced = sorted.slice(0, topN);
  chart.data.labels           = sliced.map(r => r.name);
  chart.data.datasets[0].data = sliced.map(r => r.pieces);
  chart.data.datasets[1].data = sliced.map(r => r.skus);
  chart.data.datasets[2].data = sliced.map(r => r.dollars);
  chart.data.datasets[0].hidden = metric !== 'all' && metric !== 'pieces';
  chart.data.datasets[1].hidden = metric !== 'all' && metric !== 'skus';
  chart.data.datasets[2].hidden = metric !== 'all' && metric !== 'dollars';
  chart.update();
}

// 8. Render the averages table (includes group average in row 0)
function renderAvgTable(rows) {
  const tbody = document.querySelector('#avgTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.pieces.toFixed(2)}</td>
      <td>${r.dollars.toFixed(2)}</td>
      <td>${r.skus.toFixed(2)}</td>
      <td>${r.avg_delta.toFixed(2)}</td>
      <td>${r.gap5.toFixed(2)}</td>
      <td>${r.gap10.toFixed(2)}</td>
      <td>${r.gap15.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 9. Enable sorting on avgTable, preserving row 0
function setupAvgSorting() {
  document.querySelectorAll('#avgTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      const asc = !th.classList.contains('asc');
      const [group, ...rest] = avgRows;
      rest.sort((a,b) => {
        if (a[key] < b[key]) return asc ? -1 : 1;
        if (a[key] > b[key]) return asc ? 1 : -1;
        return 0;
      });
      avgRows = [group, ...rest];
      document.querySelectorAll('#avgTable th').forEach(x => x.classList.remove('asc','desc'));
      th.classList.add(asc ? 'asc' : 'desc');
      renderAvgTable(avgRows);
    });
  });
}

// 10. Initialize the employee-trend line chart (once)
function initEmployeeTrendChart() {
  const ctx = document.getElementById('employeeTrendChart').getContext('2d');
  if (employeeTrendChart) employeeTrendChart.destroy();
  employeeTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Pieces/hr',
          data: [],
          yAxisID: 'yPieces',
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'SKU/hr',
          data: [],
          yAxisID: 'yPieces',
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: '$/hr',
          data: [],
          yAxisID: 'yDollars',
          fill: false,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: 'Date' },
          ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 }
        },
        yPieces: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Pieces & SKU per hr' }
        },
        yDollars: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '$ per hr' },
          ticks: { callback: v => '$' + v.toLocaleString() }
        }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// 11. Update the employee-trend chart on any filter change
function updateEmployeeTrendChart(raw) {
  const term    = document.getElementById('employee-search').value.trim().toLowerCase();
  const section = document.getElementById('employee-trend-section');

  // hide if no employee
  if (!term) {
    section.style.display = 'none';
    return;
  }

  // apply same store/account/timeframe filtering as updateView
  let filtered = raw.filter(i => {
    const storeTerm = document.getElementById('store-search').value.toLowerCase();
    if (storeTerm && !i.StoreName.toLowerCase().includes(storeTerm)) return false;
    const acctTerm = document.getElementById('account-search').value.toLowerCase();
    if (acctTerm && !( (i.AccountName||'').toLowerCase().includes(acctTerm) )) return false;
    const tf = document.getElementById('timeframe-select').value;
    if (tf !== 'all') {
      const cutoff = new Date();
      if (tf === 'week')  cutoff.setDate(cutoff.getDate() - 7);
      if (tf === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
      if (tf === 'year')  cutoff.setFullYear(cutoff.getFullYear() - 1);
      if (new Date(i.DateOfInv) < cutoff) return false;
    }
    // exact employee match
    return `${i.FirstName} ${i.LastName}`.toLowerCase() === term;
  });

  if (!filtered.length) {
    section.style.display = 'none';
    return;
  }

  // group by day and average
  const byDate = {};
  filtered.forEach(i => {
    const day = i.DateOfInv.slice(0,10);
    if (!byDate[day]) byDate[day] = { p:0, s:0, d:0, c:0 };
    byDate[day].p += i.PiecesPerHr  || 0;
    byDate[day].s += i.SkusPerHr    || 0;
    byDate[day].d += i.DollarPerHr  || 0;
    byDate[day].c++;
  });

  const dates      = Object.keys(byDate).sort();
  const piecesData  = dates.map(d => +(byDate[d].p / byDate[d].c).toFixed(2));
  const skuData     = dates.map(d => +(byDate[d].s / byDate[d].c).toFixed(2));
  const dollarsData = dates.map(d => +(byDate[d].d / byDate[d].c).toFixed(2));

  // update & show
  section.style.display = 'block';
  employeeTrendChart.data.labels            = dates;
  employeeTrendChart.data.datasets[0].data  = piecesData;
  employeeTrendChart.data.datasets[1].data  = skuData;
  employeeTrendChart.data.datasets[2].data  = dollarsData;
  employeeTrendChart.options.plugins.title  = {
    display: true,
    text: `${document.getElementById('employee-search').value.toUpperCase()} – Trend`
  };
  employeeTrendChart.update();
}

// 12. Render, sort, and update everything on filter changes
function updateView(raw) {
  const storeTerm = document.getElementById('store-search').value.toLowerCase();
  const empTerm   = document.getElementById('employee-search').value.toLowerCase();
  const acctTerm  = document.getElementById('account-search').value.toLowerCase();
  const tf        = document.getElementById('timeframe-select').value;
  const now       = new Date();

  let filtered = raw.filter(i => {
    if (storeTerm && !i.StoreName.toLowerCase().includes(storeTerm)) return false;
    const name = `${i.FirstName} ${i.LastName}`.toLowerCase();
    if (empTerm && !name.includes(empTerm)) return false;
    if (acctTerm && !( (i.AccountName||'').toLowerCase().includes(acctTerm) )) return false;
    if (tf !== 'all') {
      const cutoff = new Date(now);
      if (tf === 'week')  cutoff.setDate(cutoff.getDate() - 7);
      if (tf === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
      if (tf === 'year')  cutoff.setFullYear(cutoff.getFullYear() - 1);
      if (new Date(i.DateOfInv) < cutoff) return false;
    }
    return true;
  });

  renderTable(filtered);

  const individuals = computeAverages(filtered);
  const groupAvg    = computeGroupAvg(individuals);
  avgRows           = [groupAvg, ...individuals];

  updateChart(avgRows);
  renderAvgTable(avgRows);
  updateEmployeeTrendChart(raw);
}

// 13. Wire up on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  rawData = await loadData();

  initStoreDatalist(rawData);
  initEmployeeDatalist(rawData);
  initAccountDatalist(rawData);

  initChart();
  initEmployeeTrendChart();
  setupAvgSorting();

  // wire all filters to updateView
  ['store-search','employee-search','account-search','metric-select','top-n','timeframe-select']
    .forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input',  () => updateView(rawData));
      el.addEventListener('change', () => updateView(rawData));
    });

  // toggle avgTable visibility
  document.getElementById('toggle-avg-btn')
    .addEventListener('click', () => {
      const sec  = document.getElementById('avg-section');
      const show = sec.style.display === 'none';
      sec.style.display = show ? 'block' : 'none';
      document.getElementById('toggle-avg-btn').textContent =
        show ? 'Hide All Averages' : 'Show All Averages';
    });

  updateView(rawData);
});
