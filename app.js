/* =========================================================
   app.js — Dashboard page logic
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      renderDashboard();
      window.addEventListener("mpdb:update", renderDashboard);
    });
  });
});

function renderDashboard() {
  renderStatCards();
  renderRevenueChart();
  renderCurrencyBreakdown();
  renderRecentPayments();
  renderRecentClients();
}

function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? { pct: 100, dir: "up" } : { pct: 0, dir: "flat" };
  const pct = ((curr - prev) / prev) * 100;
  return { pct: Math.abs(pct).toFixed(1), dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat" };
}

function renderStatCards() {
  const clients = MPDB.getClients();
  const active = clients.filter(c => c.status === "Active").length;
  const totalRevenue = MPDB.totalRevenueBDT();
  const thisMonth = MPDB.thisMonthRevenue();
  const lastMonth = MPDB.lastMonthRevenue();
  const pending = MPDB.pendingPayments();
  const outstandingBDT = MPDB.totalOutstandingBDT();
  const totalProjects = MPDB.getServices().length;
  const change = pctChange(thisMonth, lastMonth);

  const cards = [
    { icon: "bi-people-fill", bg: "bg-blue", label: "Total Clients", value: clients.length, sub: `${active} active` , subClass: "flat"},
    { icon: "bi-person-check-fill", bg: "bg-green", label: "Active Clients", value: active, sub: `${clients.length ? Math.round((active/clients.length)*100) : 0}% of roster`, subClass: "flat" },
    { icon: "bi-cash-stack", bg: "bg-navy", label: "Total Revenue", value: MPDB.formatBDT(totalRevenue), sub: "All-time, paid only", subClass: "flat" },
    { icon: "bi-calendar-month-fill", bg: "bg-gold", label: "This Month", value: MPDB.formatBDT(thisMonth), sub: `${change.pct}% vs last month`, subClass: change.dir },
    { icon: "bi-hourglass-split", bg: "bg-red", label: "Outstanding", value: pending.length, sub: MPDB.formatBDT(outstandingBDT) + " owed (BDT)", subClass: "down" },
    { icon: "bi-kanban-fill", bg: "bg-blue", label: "Total Projects", value: totalProjects, sub: `${MPDB.getServices().filter(s=>s.status==='Active').length} active`, subClass: "flat" }
  ];

  const arrow = { up: "bi-arrow-up-short", down: "bi-arrow-down-short", flat: "bi-dash" };

  document.getElementById("statCards").innerHTML = cards.map(c => `
    <div class="col-6 col-lg-4 col-xl-2">
      <div class="mp-stat-card">
        <div class="mp-stat-icon ${c.bg}"><i class="bi ${c.icon}"></i></div>
        <div class="mp-stat-value">${c.value}</div>
        <div class="mp-stat-label">${c.label}</div>
        <div class="mp-stat-sub ${c.subClass}"><i class="bi ${arrow[c.subClass] || 'bi-dot'}"></i>${c.sub}</div>
      </div>
    </div>`).join("");
}

let dashboardChart = null;
function renderRevenueChart() {
  const series = MPDB.monthlyRevenueSeries(12);
  const ctx = document.getElementById("revenueChart");
  if (dashboardChart) dashboardChart.destroy();
  dashboardChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.map(s => s.label),
      datasets: [{
        label: "Revenue (BDT)",
        data: series.map(s => Math.round(s.total)),
        backgroundColor: "rgba(26,115,232,.85)",
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => MPDB.formatBDT(ctx.parsed.y) } } },
      scales: {
        y: { ticks: { callback: v => "৳" + (v >= 1000 ? (v / 1000) + "k" : v) }, grid: { color: "#eef1f8" } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCurrencyBreakdown() {
  const rows = MPDB.revenueByCurrency();
  const colors = ["var(--mp-blue)", "var(--mp-green)", "var(--mp-gold)", "var(--mp-red)", "#8e44ad", "#00acc1"];
  const el = document.getElementById("currencyBreakdown");
  if (!rows.length) { el.innerHTML = MPUI.emptyState("bi-cash-coin", "No revenue recorded yet."); return; }
  el.innerHTML = rows.map((r, i) => `
    <div class="mp-currency-row">
      <span class="mp-currency-pill">${r.code}</span>
      <div class="flex-grow-1">
        <div class="d-flex justify-content-between small mb-1">
          <span class="fw-semibold">${MPDB.formatCurrency(r.original, r.code)}</span>
          <span class="text-muted-mp">${r.pct.toFixed(1)}%</span>
        </div>
        <div class="bar"><span style="width:${r.pct}%; background:${colors[i % colors.length]}"></span></div>
      </div>
    </div>
    <div class="text-end text-muted-mp" style="font-size:11.5px; margin-top:-6px;">≈ ${MPDB.formatBDT(r.bdt)}</div>
  `).join("");
}

function renderRecentPayments() {
  const rows = MPDB.getPayments().slice(0, 6);
  const body = document.getElementById("recentPaymentsBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="7">${MPUI.emptyState("bi-receipt", "No payments yet.")}</td></tr>`; return; }
  body.innerHTML = rows.map(p => {
    const client = MPDB.getClient(p.clientId);
    const svc = MPDB.getService(p.serviceId);
    return `<tr>
      <td class="fw-semibold">${p.paymentId}</td>
      <td>${client ? client.businessName : p.clientId}</td>
      <td>${MPDB.formatDate(p.paymentDate)}</td>
      <td>${MPDB.formatCurrency(p.originalAmount, p.currency)}</td>
      <td class="fw-semibold">${MPDB.formatBDT(p.bdtValue)}</td>
      <td>${p.method}</td>
      <td class="text-muted-mp">${svc ? svc.type : "—"}</td>
    </tr>`;
  }).join("");
}

function renderRecentClients() {
  const rows = MPDB.getClients().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const body = document.getElementById("recentClientsBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="4">${MPUI.emptyState("bi-person-plus", "No clients yet.")}</td></tr>`; return; }
  body.innerHTML = rows.map(c => {
    const svcs = MPDB.getServices(c.clientId);
    return `<tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="mp-avatar-sm">${MPUI.initials(c.businessName)}</div>
          <div>
            <div class="fw-semibold">${c.businessName}</div>
            <div class="text-muted-mp" style="font-size:11.5px;">${c.clientId}</div>
          </div>
        </div>
      </td>
      <td class="text-muted-mp">${svcs[0] ? svcs[0].type : "—"}</td>
      <td>${MPUI.badgeHtml(c.status)}</td>
      <td>${MPDB.formatDate(c.startDate)}</td>
    </tr>`;
  }).join("");
}
