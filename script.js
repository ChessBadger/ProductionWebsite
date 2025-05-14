// script.js (full file with sorting support for avgTable)

// 1. Load and unwrap JSON
async function loadData() {
  const res  = await fetch('EmployeeProductionExport.json');
  const json = await res.json();
  return json.EmployeeProductionExportLashaun;
}

// 2. Populate store datalist
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

// 3. Compute per-employee averages
function computeAverages(data) {
  const groups = {};
  data.forEach(i => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name]) groups[name] = { p:0, d:0, s:0, c:0 };
    groups[name].p += i.PiecesPerHr  || 0;
    groups[name].d += i.DollarPerHr  || 0;
    groups[name].s += i.SkusPerHr    || 0;
    groups[name].c++;
  });
  return Object.entries(groups).map(([name,g]) => ({
    name,
    pieces:  g.c ? g.p / g.c : 0,
    dollars: g.c ? g.d / g.c : 0,
    skus:    g.c ? g.s / g.c : 0
  }));
}

// 4. Render raw filtered table
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
    `;
    tbody.appendChild(tr);
  });
}

// 5. Init Chart.js
let chart, rawData, avgRows = [];
function initChart() {
  const ctx = document.getElementById('metricsChart').getContext('2d');
  return new Chart(ctx, {
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
          ticks: { callback: v => '$' + v.toLocaleString() }
        },
        x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// 6. Update chart view
function updateChart(rows) {
  const metric = document.getElementById('metric-select').value;
  const topN   = Math.max(1, parseInt(document.getElementById('top-n').value) || 10);

  let sorted = [...rows];
  if (metric === 'pieces')   sorted.sort((a,b)=>b.pieces-a.pieces);
  else if (metric === 'skus')sorted.sort((a,b)=>b.skus  -a.skus);
  else if (metric === 'dollars')sorted.sort((a,b)=>b.dollars-a.dollars);
  else sorted.sort((a,b)=>b.pieces-a.pieces);

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
  const tbody = document.querySelector('#avgTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.pieces.toFixed(2)}</td>
      <td>${r.dollars.toFixed(2)}</td>
      <td>${r.skus.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. Sorting support for avgTable
function setupAvgSorting() {
  document.querySelectorAll('#avgTable th.sortable').forEach(th=>{
    th.addEventListener('click',()=>{
      const key = th.dataset.key;
      const asc = !th.classList.contains('asc');
      avgRows.sort((a,b)=>{
        if (a[key]<b[key]) return asc? -1:1;
        if (a[key]>b[key]) return asc? 1:-1;
        return 0;
      });
      document.querySelectorAll('#avgTable th').forEach(x=>x.classList.remove('asc','desc'));
      th.classList.add(asc?'asc':'desc');
      renderAvgTable(avgRows);
    });
  });
}

// 9. Main update + wiring
function updateView(raw) {
  const storeTerm = document.getElementById('store-search').value.toLowerCase();
  const empTerm   = document.getElementById('employee-search').value.toLowerCase();
  const acctTerm  = document.getElementById('account-search').value.toLowerCase();
  const tf        = document.getElementById('timeframe-select').value;
  let filtered = raw.filter(i=>{
    const storeMatch = !storeTerm||i.StoreName.toLowerCase().includes(storeTerm);
    const name = `${i.FirstName} ${i.LastName}`.toLowerCase();
    const empMatch = !empTerm||name.includes(empTerm);
    const acctMatch = !acctTerm||(i.AccountName||'').toLowerCase().includes(acctTerm);
    return storeMatch&&empMatch&&acctMatch;
  });
  if(tf!=='all') {
    const cutoff=new Date();
    if(tf==='week') cutoff.setDate(cutoff.getDate()-7);
    if(tf==='month')cutoff.setMonth(cutoff.getMonth()-1);
    if(tf==='year') cutoff.setFullYear(cutoff.getFullYear()-1);
    filtered=filtered.filter(i=>new Date(i.DateOfInv)>=cutoff);
  }
  renderTable(filtered);
  avgRows = computeAverages(filtered);
  updateChart(avgRows);
  renderAvgTable(avgRows);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  rawData = await loadData();
  initStoreDatalist(rawData);
  chart = initChart();
  ['store-search','employee-search','account-search','metric-select','top-n','timeframe-select']
    .forEach(id=>{
      const el=document.getElementById(id);
      el.addEventListener('input',()=>updateView(rawData));
      el.addEventListener('change',()=>updateView(rawData));
    });
  document.getElementById('toggle-avg-btn').addEventListener('click',()=>{
    const sec=document.getElementById('avg-section');
    const show=sec.style.display==='none';
    sec.style.display= show?'block':'none';
    document.getElementById('toggle-avg-btn').textContent = show?'Hide All Averages':'Show All Averages';
  });
  setupAvgSorting();
  updateView(rawData);
});
