// script.js

// Globals
let rawData = [];
let chart = null;
let employeeTrendChart = null;
let avgRows = [];
let tableSortKey = 'date';
let tableSortAsc = false;
let currentPage = 1;
const rowsPerPage = 50;

// Debounce helper
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 1. Load JSON
async function loadData() {
  const res  = await fetch('EmployeeProductionExport.json');
  const json = await res.json();
  return json.EmployeeProductionExportLashaun;
}

// 2. Datalists
function initStoreDatalist(data) {
  const list = document.getElementById('store-list');
  list.innerHTML = '';
  Array.from(new Set(data.map(i => i.StoreName)))
       .sort()
       .forEach(s => {
         const opt = document.createElement('option');
         opt.value = s;
         list.appendChild(opt);
       });
}
function initEmployeeDatalist(data) {
  const list = document.getElementById('employee-list');
  list.innerHTML = '';
  Array.from(new Set(data.map(i => `${i.FirstName} ${i.LastName}`)))
       .sort()
       .forEach(e => {
         const opt = document.createElement('option');
         opt.value = e;
         list.appendChild(opt);
       });
}
function initAccountDatalist(data) {
  const list = document.getElementById('account-list');
  list.innerHTML = '';
  Array.from(new Set(data.map(i => i.AccountName || '')))
       .filter(a => a)
       .sort()
       .forEach(a => {
         const opt = document.createElement('option');
         opt.value = a;
         list.appendChild(opt);
       });
}

// 3. Compute averages
function computeAverages(data) {
  const groups = {};
  data.forEach(i => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name]) groups[name] = { p:0, d:0, s:0, delta:0, g5:0, g10:0, g15:0, c:0 };
    groups[name].p     += i.PiecesPerHr || 0;
    groups[name].d     += i.DollarPerHr || 0;
    groups[name].s     += i.SkusPerHr   || 0;
    groups[name].delta += i.AVG_DELTA   || 0;
    groups[name].g5    += i.GAP5_COUNT  || 0;
    groups[name].g10   += i.GAP10_COUNT || 0;
    groups[name].g15   += i.GAP15_COUNT || 0;
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

// 4. Group average row
function computeGroupAvg(rows) {
  const sum = rows.reduce((acc, r) => {
    acc.pieces    += r.pieces;
    acc.dollars   += r.dollars;
    acc.skus      += r.skus;
    acc.avg_delta += r.avg_delta;
    acc.gap5      += r.gap5;
    acc.gap10     += r.gap10;
    acc.gap15     += r.gap15;
    return acc;
  }, { pieces:0, dollars:0, skus:0, avg_delta:0, gap5:0, gap10:0, gap15:0 });
  const n = rows.length || 1;
  return {
    name: 'Group Average',
    pieces:    sum.pieces   / n,
    dollars:   sum.dollars  / n,
    skus:      sum.skus     / n,
    avg_delta: sum.avg_delta/ n,
    gap5:      sum.gap5     / n,
    gap10:     sum.gap10    / n,
    gap15:     sum.gap15    / n
  };
}

// 5. Init main bar chart
function initChart() {
  const ctx = document.getElementById('metricsChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label:'Pieces/hr', data:[], yAxisID:'yPieces' },
        { label:'SKU/hr',    data:[], yAxisID:'yPieces' },
        { label:'$/hr',      data:[], yAxisID:'yDollars' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        yPieces: { type:'linear', position:'left', beginAtZero:true, title:{display:true,text:'Pieces & SKU per hr'} },
        yDollars:{ type:'linear', position:'right',beginAtZero:true,grid:{drawOnChartArea:false},
                   title:{display:true,text:'$ per hr'},ticks:{callback:v=>'$'+v} },
        x: { ticks:{autoSkip:true, maxRotation:45, minRotation:45} }
      },
      plugins: { legend:{position:'top'} }
    }
  });
}

// 6. Update main chart
function updateChart(rows) {
  const dataRows = rows.slice(1); // drop group average
  const metric = document.getElementById('metric-select').value;
  const topN   = Math.max(1, parseInt(document.getElementById('top-n').value) || 10);

  let sorted = [...dataRows];
  if (metric==='pieces')      sorted.sort((a,b)=>b.pieces - a.pieces);
  else if (metric==='skus')   sorted.sort((a,b)=>b.skus   - a.skus);
  else if (metric==='dollars')sorted.sort((a,b)=>b.dollars-b.dollars);
  else                        sorted.sort((a,b)=>b.pieces - a.pieces);

  const sliced = sorted.slice(0, topN);
  chart.data.labels           = sliced.map(r=>r.name);
  chart.data.datasets[0].data = sliced.map(r=>r.pieces);
  chart.data.datasets[1].data = sliced.map(r=>r.skus);
  chart.data.datasets[2].data = sliced.map(r=>r.dollars);
  chart.data.datasets[0].hidden = metric!=='all'&&metric!=='pieces';
  chart.data.datasets[1].hidden = metric!=='all'&&metric!=='skus';
  chart.data.datasets[2].hidden = metric!=='all'&&metric!=='dollars';
  chart.update();
}

// 7. Render averages table
function renderAvgTable(rows) {
  const tbody = document.querySelector('#avgTable.responsive tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Employee">${r.name}</td>
      <td data-label="Pieces/hr">${r.pieces.toFixed(2)}</td>
      <td data-label="$/hr">${r.dollars.toFixed(2)}</td>
      <td data-label="SKU/hr">${r.skus.toFixed(2)}</td>
      <td data-label="Avg Δ">${r.avg_delta.toFixed(2)}</td>
      <td data-label="Gap5">${r.gap5.toFixed(2)}</td>
      <td data-label="Gap10">${r.gap10.toFixed(2)}</td>
      <td data-label="Gap15">${r.gap15.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. Sort avgTable
function setupAvgSorting() {
  document.querySelectorAll('#avgTable.responsive th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      const asc = !th.classList.contains('asc');
      const [group, ...rest] = avgRows;
      rest.sort((a,b) => a[key]<b[key] ? (asc?-1:1) : a[key]>b[key] ? (asc?1:-1):0);
      avgRows = [group, ...rest];
      document.querySelectorAll('#avgTable.responsive th').forEach(h=>h.classList.remove('asc','desc'));
      th.classList.add(asc?'asc':'desc');
      renderAvgTable(avgRows);
    });
  });
}

// 9. Init employee trend chart
function initEmployeeTrendChart() {
  const ctx = document.getElementById('employeeTrendChart').getContext('2d');
  if (employeeTrendChart) employeeTrendChart.destroy();
  employeeTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label:'Pieces/hr', data:[], yAxisID:'yPieces', fill:false, tension:0.3, pointRadius:3 },
        { label:'SKU/hr',    data:[], yAxisID:'yPieces', fill:false, tension:0.3, pointRadius:3 },
        { label:'$/hr',      data:[], yAxisID:'yDollars',fill:false, tension:0.3, pointRadius:3 }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio: false, 
      scales: {
        x: { title:{display:true,text:'Date'}, ticks:{autoSkip:true, maxRotation:45,minRotation:45} },
        yPieces: { type:'linear',position:'left',beginAtZero:true, title:{display:true,text:'Pieces & SKU/hr'}},
        yDollars:{ type:'linear',position:'right',beginAtZero:true,grid:{drawOnChartArea:false},
                   title:{display:true,text:'$ per hr'}, ticks:{callback:v=>'$'+v}}
      },
      plugins:{legend:{position:'top'}}
    }
  });
}

// 10. Update employee trend
function updateEmployeeTrendChart(raw) {
  const term    = document.getElementById('employee-search').value.trim().toLowerCase();
  const section = document.getElementById('employee-trend-section');
  const metric  = document.getElementById('metric-select').value;

  // Hide if no employee selected
  if (!term) {
    section.style.display = 'none';
    return;
  }

  // Apply store/account/timeframe/employee filters
  let filtered = raw.filter(i => {
    // Store filter
    const storeTerm = document.getElementById('store-search').value.toLowerCase();
    if (storeTerm && !i.StoreName.toLowerCase().includes(storeTerm)) return false;

    // Account filter
    const acctTerm = document.getElementById('account-search').value.toLowerCase();
    if (acctTerm && !( (i.AccountName||'').toLowerCase().includes(acctTerm) )) return false;

    // Timeframe filter
    const tf = document.getElementById('timeframe-select').value;
    if (tf !== 'all') {
      const cutoff = new Date();
      if (tf === 'week')  cutoff.setDate(cutoff.getDate() - 7);
      if (tf === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
      if (tf === '6month')cutoff.setMonth(cutoff.getMonth() - 6);
      if (tf === 'year')  cutoff.setFullYear(cutoff.getFullYear() - 1);
      if (new Date(i.DateOfInv) < cutoff) return false;
    }

    // Exact employee match
    return (`${i.FirstName} ${i.LastName}`.toLowerCase() === term);
  });

  // Hide if no data after filtering
  if (filtered.length === 0) {
    section.style.display = 'none';
    return;
  }

  // Group by date and compute daily averages
  const byDate = {};
  filtered.forEach(i => {
    const day = i.DateOfInv.slice(0,10); // "YYYY-MM-DD"
    if (!byDate[day]) byDate[day] = { p:0, s:0, d:0, c:0 };
    byDate[day].p += i.PiecesPerHr  || 0;
    byDate[day].s += i.SkusPerHr    || 0;
    byDate[day].d += i.DollarPerHr  || 0;
    byDate[day].c++;
  });

  const dates       = Object.keys(byDate).sort();
  const piecesData  = dates.map(d => +(byDate[d].p / byDate[d].c).toFixed(2));
  const skuData     = dates.map(d => +(byDate[d].s / byDate[d].c).toFixed(2));
  const dollarsData = dates.map(d => +(byDate[d].d / byDate[d].c).toFixed(2));

  // Update chart data
  section.style.display = 'block';
  employeeTrendChart.data.labels            = dates;
  employeeTrendChart.data.datasets[0].data  = piecesData;
  employeeTrendChart.data.datasets[1].data  = skuData;
  employeeTrendChart.data.datasets[2].data  = dollarsData;

  // Show/hide lines based on metric dropdown
  employeeTrendChart.data.datasets[0].hidden = metric !== 'all' && metric !== 'pieces';
  employeeTrendChart.data.datasets[1].hidden = metric !== 'all' && metric !== 'skus';
  employeeTrendChart.data.datasets[2].hidden = metric !== 'all' && metric !== 'dollars';

  // Optional: update chart title
  employeeTrendChart.options.plugins.title = {
    display: true,
    text: `${document.getElementById('employee-search').value} – Trend`
  };

  employeeTrendChart.update();
}


// 11. Sort metricsTable
function setupMetricsTableSorting() {
  document.querySelectorAll('#metricsTable.responsive th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (tableSortKey === key) tableSortAsc = !tableSortAsc;
      else { tableSortKey = key; tableSortAsc = true; }
      document.querySelectorAll('#metricsTable.responsive th').forEach(h => h.classList.remove('asc','desc'));
      th.classList.add(tableSortAsc?'asc':'desc');
      debouncedUpdate(rawData);
    });
  });
}

// 12. Render pagination controls
function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const pg = document.getElementById('pagination');
  pg.innerHTML = `
    <button ${currentPage===1?'disabled':''} id="prev">Prev</button>
    <span>Page ${currentPage} of ${totalPages}</span>
    <button ${currentPage===totalPages?'disabled':''} id="next">Next</button>
  `;
  pg.querySelector('#prev').onclick = () => { if(currentPage>1){ currentPage--; debouncedUpdate(rawData); } };
  pg.querySelector('#next').onclick = () => { if(currentPage<totalPages){ currentPage++; debouncedUpdate(rawData); } };
}

// 13. Render raw table with pagination
function renderTable(data) {
  const tbody = document.querySelector('#metricsTable.responsive tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * rowsPerPage;
  const pageData = data.slice(start, start + rowsPerPage);

  pageData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Employee">${item.FirstName} ${item.LastName}</td>
      <td data-label="Account">${item.AccountName||''}</td>
      <td data-label="Store">${item.StoreName}</td>
      <td data-label="Date">${new Date(item.DateOfInv).toLocaleDateString()}</td>
      <td data-label="Pieces/hr">${(item.PiecesPerHr||0).toFixed(2)}</td>
      <td data-label="$/hr">${(item.DollarPerHr||0).toFixed(2)}</td>
      <td data-label="SKU/hr">${(item.SkusPerHr||0).toFixed(2)}</td>
      <td data-label="Avg Δ">${(item.AVG_DELTA||0).toFixed(2)}</td>
      <td data-label="Gap5">${item.GAP5_COUNT||0}</td>
      <td data-label="Gap10">${item.GAP10_COUNT||0}</td>
      <td data-label="Gap15">${item.GAP15_COUNT||0}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(data.length);
}

// 14. Main update: filter, sort, render
function updateView(raw) {
//   currentPage = 1;
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
    if (tf!=='all') {
      const cutoff = new Date(now);
      if (tf==='week')  cutoff.setDate(cutoff.getDate()-7);
      if (tf==='month') cutoff.setMonth(cutoff.getMonth()-1);
      if (tf === '6month') cutoff.setMonth(cutoff.getMonth() - 6);
      if (tf==='year')  cutoff.setFullYear(cutoff.getFullYear()-1);
      if (new Date(i.DateOfInv) < cutoff) return false;
    }
    return true;
  });

  // sort raw table
  filtered.sort((a,b) => {
    let vA, vB;
    switch(tableSortKey) {
      case 'employee':
        vA = `${a.FirstName} ${a.LastName}`.toLowerCase();
        vB = `${b.FirstName} ${b.LastName}`.toLowerCase();
        break;
      case 'account':
        vA = (a.AccountName||'').toLowerCase();
        vB = (b.AccountName||'').toLowerCase();
        break;
      case 'store':
        vA = a.StoreName.toLowerCase();
        vB = b.StoreName.toLowerCase();
        break;
      case 'date':
        vA = new Date(a.DateOfInv);
        vB = new Date(b.DateOfInv);
        break;
      case 'pieces':
        vA = a.PiecesPerHr||0;
        vB = b.PiecesPerHr||0;
        break;
      case 'dollars':
        vA = a.DollarPerHr||0;
        vB = b.DollarPerHr||0;
        break;
      case 'skus':
        vA = a.SkusPerHr||0;
        vB = b.SkusPerHr||0;
        break;
      case 'avg_delta':
        vA = a.AVG_DELTA||0;
        vB = b.AVG_DELTA||0;
        break;
      case 'gap5_count':
        vA = a.GAP5_COUNT||0;
        vB = b.GAP5_COUNT||0;
        break;
      case 'gap10_count':
        vA = a.GAP10_COUNT||0;
        vB = b.GAP10_COUNT||0;
        break;
      case 'gap15_count':
        vA = a.GAP15_COUNT||0;
        vB = b.GAP15_COUNT||0;
        break;
      default:
        return 0;
    }
    if (vA < vB) return tableSortAsc ? -1 : 1;
    if (vA > vB) return tableSortAsc ? 1 : -1;
    return 0;
  });

  renderTable(filtered);

  // compute & render averages + chart + trend
  const individuals = computeAverages(filtered);
  const groupAvg    = computeGroupAvg(individuals);
  avgRows = [groupAvg, ...individuals];
  updateChart(avgRows);
  renderAvgTable(avgRows);
  updateEmployeeTrendChart(raw);
}

// 15. Wire up on load
const debouncedUpdate = debounce(updateView, 300);

document.addEventListener('DOMContentLoaded', async () => {
  rawData = await loadData();

  initStoreDatalist(rawData);
  initEmployeeDatalist(rawData);
  initAccountDatalist(rawData);

  initChart();
  initEmployeeTrendChart();
  setupAvgSorting();
  setupMetricsTableSorting();
  setupAutoSelect();
  // Filter & control listeners
  [
    'store-search',
    'employee-search',
    'account-search',
    'metric-select',
    'top-n',
    'timeframe-select'
  ].forEach(id => {
    const el = document.getElementById(id);
      el.addEventListener('input', () => {
    currentPage = 1;
    debouncedUpdate(rawData);
  });

  el.addEventListener('change', () => {
    currentPage = 1;
    debouncedUpdate(rawData);
  });
});

  // Toggle averages table
  document.getElementById('toggle-avg-btn')
    .addEventListener('click', () => {
      const sec  = document.getElementById('avg-section');
      const show = sec.style.display === 'none';
      sec.style.display = show ? 'block' : 'none';
      document.getElementById('toggle-avg-btn').textContent =
        show ? 'Hide All Averages' : 'Show All Averages';
    });

  // Initial render
  updateView(rawData);
});


// 1) Helper to wire up the auto‑select behavior
function setupAutoSelect() {
  // match any <input> that supports .select()
  document.querySelectorAll('input').forEach(input => {
    if (typeof input.select === 'function') {
      // select all on focus (e.g. tabbing in)
      input.addEventListener('focus', () => input.select());
      // prevent the mouseup from cancelling the selection when clicked
      input.addEventListener('mouseup', e => e.preventDefault());
    }
  });
}

// 2) Inside your existing DOMContentLoaded handler, after you do all your
//    init*() calls but _before_ your initial updateView(rawData)
document.addEventListener('DOMContentLoaded', async () => {
  rawData = await loadData();

  initStoreDatalist(rawData);
  initEmployeeDatalist(rawData);
  initAccountDatalist(rawData);
  // … any other setup you already have …

  // <— add this line:
  setupAutoSelect();

  // finally, render your dashboard
  updateView(rawData);
});

