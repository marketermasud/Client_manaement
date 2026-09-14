/* =========================================================
   revenue.js — Revenue Analytics page
   ========================================================= */

let chMonthly, chCurrency, chClient, chService;

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      populateOptions();
      renderStats();
      renderCharts();
      window.addEventListener("mpdb:update", () => { renderStats(); renderCharts(); });

      ["rFrom", "rTo", "rCurrency", "rClient", "rMethod"].forEach(id => {
        document.getElementById(id).addEventListener("change", renderCharts);
      });
      document.getElementById("rClear").addEventListener("click", () => {
        ["rFrom", "rTo"].forEach(id => document.getElementById(id).value = "");
        ["rCurrency", "rClient", "rMethod"].forEach(id => document.getElementById(id).value = "all");
        renderCharts();
      });
    });
  });
});

function populateOptions() {
  MPDB.getCurrencies().forEach(c => document.getElementById("rCurrency").insertAdjacentHTML("beforeend", `<option value="${c.code}">${c.code}</option>`));
  MPDB.getClients().forEach(c => document.getElementById("rClient").insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName}</option>`));
  ["Bank Transfer","Wise","PayPal","Payoneer","Stripe","Cash","Card","Other"].forEach(m =>
    document.getElementById("rMethod").insertAdjacentHTML("beforeend", `<option value="${m}">${m}</option>`));
}

function currentFilters() {
  return {
    from: document.getElementById("rFrom").value,
    to: document.getElementById("rTo").value,
    currency: document.getElementById("rCurrency").value,
    clientId: document.getElementById("rClient").value !== "all" ? document.getElementById("rClient").value : undefined,
    method: document.getElementById("rMethod").value
  };
}

function statCard(icon, bg, value, label) {
  return `<div class="col-6 col-lg-2">
    <div class="mp-stat-card">
      <div class="mp-stat-icon ${bg}"><i class="bi ${icon}"></i></div>
      <div class="mp-stat-value" style="font-size:18px;">${value}</div>
      <div class="mp-stat-label">${label}</div>
    </div>
  </div>`;
}

function renderStats() {
  const total = MPDB.totalRevenueBDT();
  const month = MPDB.thisMonthRevenue();
  const year = MPDB.thisYearRevenue();
  const prevMonth = MPDB.lastMonthRevenue();
  const prevYear = MPDB.prevYearRevenue();
  const series = MPDB.monthlyRevenueSeries(12);
  const nonZeroMonths = series.filter(s => s.total > 0).length || 1;
  const avg = series.reduce((s, m) => s + m.total, 0) / nonZeroMonths;

  document.getElementById("revenueStats").innerHTML = [
    statCard("bi-cash-stack", "bg-navy", MPDB.formatBDT(total), "Total Revenue"),
    statCard("bi-calendar-month", "bg-blue", MPDB.formatBDT(month), "This Month"),
    statCard("bi-calendar3", "bg-green", MPDB.formatBDT(year), "This Year"),
    statCard("bi-calendar2-minus", "bg-gold", MPDB.formatBDT(prevMonth), "Previous Month"),
    statCard("bi-calendar2-x", "bg-red", MPDB.formatBDT(prevYear), "Previous Year"),
    statCard("bi-bar-chart-line", "bg-navy", MPDB.formatBDT(avg), "Avg Monthly Revenue")
  ].join("");
}

function renderCharts() {
  const filters = currentFilters();

  const series = MPDB.monthlyRevenueSeries(12);
  if (chMonthly) chMonthly.destroy();
  chMonthly = new Chart(document.getElementById("chartMonthly"), {
    type: "line",
    data: { labels: series.map(s => s.label), datasets: [{ label: "BDT", data: series.map(s => Math.round(s.total)), borderColor: "#1a73e8", backgroundColor: "rgba(26,115,232,.12)", fill: true, tension: .35, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => MPDB.formatBDT(c.parsed.y) } } }, scales: { y: { grid: { color: "#eef1f8" } }, x: { grid: { display: false } } } }
  });

  const byCur = MPDB.revenueByCurrency(filters);
  if (chCurrency) chCurrency.destroy();
  chCurrency = new Chart(document.getElementById("chartCurrency"), {
    type: "doughnut",
    data: { labels: byCur.map(r => r.code), datasets: [{ data: byCur.map(r => Math.round(r.bdt)), backgroundColor: ["#1a73e8", "#34a853", "#fbbc05", "#ea4335", "#8e44ad", "#00acc1"] }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.label + ": " + MPDB.formatBDT(c.parsed) } } }, cutout: "62%" }
  });

  const byClient = MPDB.revenueByClient(filters).slice(0, 8);
  if (chClient) chClient.destroy();
  chClient = new Chart(document.getElementById("chartClient"), {
    type: "bar",
    data: { labels: byClient.map(r => r.client ? r.client.businessName : r.clientId), datasets: [{ data: byClient.map(r => Math.round(r.bdt)), backgroundColor: "#34a853", borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => MPDB.formatBDT(c.parsed.x) } } }, scales: { x: { grid: { color: "#eef1f8" } }, y: { grid: { display: false } } } }
  });

  const byService = MPDB.revenueByService(filters);
  if (chService) chService.destroy();
  chService = new Chart(document.getElementById("chartService"), {
    type: "bar",
    data: { labels: byService.map(r => r.type), datasets: [{ data: byService.map(r => Math.round(r.bdt)), backgroundColor: "#fbbc05", borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => MPDB.formatBDT(c.parsed.y) } } }, scales: { y: { grid: { color: "#eef1f8" } }, x: { grid: { display: false } } } }
  });
}
