// growth.js

document.addEventListener("DOMContentLoaded", () => {
  // Check for authentication
  const allowedUsers = [
    "jswanson@badgerinventory.com",
    "hkraemer@badgerinventory.com",
    "jfalck@badgerinventory.com",
    "spalmer@badgerinventory.com",
    "nbrock@badgerinventory.com",
    "lclark@badgerinventory.com",
    "kgrohall@badgerinventory.com",
  ];
  firebase.auth().onAuthStateChanged((user) => {
    if (!user || !allowedUsers.includes(user.email.toLowerCase())) {
      alert("Unauthorized access. Redirecting...");
      firebase
        .auth()
        .signOut()
        .then(() => {
          window.location.href = "login.html";
        });
    }
  });

  const calculateBtn = document.getElementById("calculate-growth-btn");
  calculateBtn.addEventListener("click", calculateAndDisplayGrowth);
});

async function loadData() {
  const res = await fetch("EmployeeProductionExport.json");
  const json = await res.json();
  return json.EmployeeProductionExportLashaun;
}

async function calculateAndDisplayGrowth() {
  const startDateFilter = document.getElementById("start-date-filter").value;
  if (!startDateFilter) {
    alert("Please select a start date.");
    return;
  }

  const rawData = await loadData();
  const startDate = new Date(startDateFilter);
  const today = new Date();

  const growthPeriodDays = Math.round(
    (today - startDate) / (1000 * 60 * 60 * 24)
  );
  const baselineEndDate = new Date(startDate);
  baselineEndDate.setDate(baselineEndDate.getDate() - 1);
  const baselineStartDate = new Date(baselineEndDate);
  baselineStartDate.setDate(baselineStartDate.getDate() - growthPeriodDays);

  const baselineData = filterDataByDate(
    rawData,
    baselineStartDate,
    baselineEndDate
  );
  const growthData = filterDataByDate(rawData, startDate, today);

  const baselineAvgs = calculateAverages(baselineData);
  const growthAvgs = calculateAverages(growthData);

  const growthResult = [];
  for (const employee in growthAvgs) {
    if (baselineAvgs[employee] && baselineAvgs[employee].pieces > 0) {
      const growth =
        growthAvgs[employee].pieces - baselineAvgs[employee].pieces;
      const growthPercentage = (growth / baselineAvgs[employee].pieces) * 100;
      if (isFinite(growth) && isFinite(growthPercentage)) {
        growthResult.push({
          name: employee,
          baseline: baselineAvgs[employee].pieces,
          current: growthAvgs[employee].pieces,
          growth,
          growthPercentage,
        });
      }
    }
  }

  // Calculate and render overall growth if data exists
  if (growthResult.length > 0) {
    const overall = calculateOverallGrowth(growthResult);
    renderOverallGrowth(overall);

    growthResult.sort((a, b) => b.growth - a.growth);
  } else {
    // Hide the overall summary if no data
    document.getElementById("overall-growth-summary").style.display = "none";
  }

  renderGrowthTable(growthResult);
}

function calculateOverallGrowth(growthData) {
  const totalBaseline = growthData.reduce(
    (sum, item) => sum + item.baseline,
    0
  );
  const totalCurrent = growthData.reduce((sum, item) => sum + item.current, 0);
  const count = growthData.length;

  const avgBaseline = totalBaseline / count;
  const avgCurrent = totalCurrent / count;
  const avgGrowth = avgCurrent - avgBaseline;
  const avgGrowthPercentage = (avgGrowth / avgBaseline) * 100;

  return {
    baseline: avgBaseline,
    current: avgCurrent,
    growth: avgGrowth,
    growthPercentage: avgGrowthPercentage,
  };
}

function renderOverallGrowth(data) {
  document.getElementById("overall-growth-summary").style.display = "block";
  document.getElementById("overall-baseline").textContent =
    data.baseline.toFixed(2);
  document.getElementById("overall-current").textContent =
    data.current.toFixed(2);
  document.getElementById("overall-growth").textContent =
    data.growth.toFixed(2);
  document.getElementById(
    "overall-growth-percentage"
  ).textContent = `${data.growthPercentage.toFixed(2)}%`;
}

function filterDataByDate(data, start, end) {
  return data.filter((item) => {
    const itemDate = new Date(item.DateOfInv);
    return itemDate >= start && itemDate <= end;
  });
}

function calculateAverages(data) {
  const groups = {};
  data.forEach((i) => {
    const name = `${i.FirstName} ${i.LastName}`;
    if (!groups[name])
      groups[name] = {
        p: 0,
        c: 0,
      };
    groups[name].p += i.PiecesPerHr || 0;
    groups[name].c++;
  });

  const averages = {};
  for (const name in groups) {
    if (groups[name].c > 0) {
      averages[name] = {
        pieces: groups[name].p / groups[name].c,
      };
    }
  }
  return averages;
}

function renderGrowthTable(data) {
  const tbody = document.querySelector("#growthTable tbody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent =
      "No growth data to display for the selected period. Try an earlier start date.";
    cell.style.textAlign = "center";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  data.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="Employee">${item.name}</td>
      <td data-label="Baseline Pieces/hr">${item.baseline.toFixed(2)}</td>
      <td data-label="Current Pieces/hr">${item.current.toFixed(2)}</td>
      <td data-label="Growth (Pieces/hr)">${item.growth.toFixed(2)}</td>
      <td data-label="Growth %">${item.growthPercentage.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });
}
