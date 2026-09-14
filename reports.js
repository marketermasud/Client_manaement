/* =========================================================
   reports.js — Reports page
   ========================================================= */

let CURRENT_REPORT = { headers: [], rows: [], title: "" };

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      MPDB.getClients().forEach(c => document.getElementById("repClient").insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName} (${c.clientId})</option>`));

      const preselect = MPUI.qs("client");
      if (preselect) {
        document.getElementById("reportType").value = "clientStatement";
        document.getElementById("repClient").value = preselect;
      }

      document.getElementById("reportType").addEventListener("change", buildReport);
      document.getElementById("repClient").addEventListener("change", buildReport);
      document.getElementById("repFrom").addEventListener("change", buildReport);
      document.getElementById("repTo").addEventListener("change", buildReport);
      document.getElementById("repExport").addEventListener("click", exportCsv);
      document.getElementById("repPrint").addEventListener("click", () => window.print());

      buildReport();
      window.addEventListener("mpdb:update", buildReport);
    });
  });
});

function dateFilter() {
  return { from: document.getElementById("repFrom").value, to: document.getElementById("repTo").value };
}

function toggleControls(type) {
  const isStatement = type === "clientStatement";
  document.getElementById("repClientWrap").classList.toggle("d-none", !isStatement);
  document.getElementById("repFromWrap").classList.toggle("d-none", isStatement);
  document.getElementById("repToWrap").classList.toggle("d-none", isStatement);
  document.getElementById("repExportWrap").classList.toggle("d-none", isStatement);
}

function buildReport() {
  const type = document.getElementById("reportType").value;
  toggleControls(type);

  if (type === "clientStatement") {
    renderClientStatement();
    return;
  }

  const f = dateFilter();
  let headers = [], rows = [], title = "", subtitle = "";

  if (type === "byMonth") {
    title = "Revenue by Month"; subtitle = "Last 12 months, BDT (paid only)";
    headers = ["Month", "Revenue (BDT)"];
    rows = MPDB.monthlyRevenueSeries(12).map(m => [m.label, MPDB.formatBDT(m.total)]);

  } else if (type === "byClient") {
    title = "Revenue by Client"; subtitle = "Paid payments only";
    headers = ["Client ID", "Business", "Total Paid (BDT)"];
    rows = MPDB.revenueByClient(f).map(r => [r.clientId, r.client ? r.client.businessName : r.clientId, MPDB.formatBDT(r.bdt)]);

  } else if (type === "byCurrency") {
    title = "Revenue by Currency"; subtitle = "Each row uses its own stored exchange rate";
    headers = ["Currency", "Original Amount", "BDT Equivalent", "% of Total"];
    rows = MPDB.revenueByCurrency(f).map(r => [r.code, MPDB.formatCurrency(r.original, r.code), MPDB.formatBDT(r.bdt), r.pct.toFixed(1) + "%"]);

  } else if (type === "byService") {
    title = "Revenue by Service Type"; subtitle = "Paid payments only";
    headers = ["Service Type", "Revenue (BDT)"];
    rows = MPDB.revenueByService(f).map(r => [r.type, MPDB.formatBDT(r.bdt)]);

  } else if (type === "paymentHistory") {
    title = "Payment History"; subtitle = "All recorded payments";
    headers = ["Payment ID", "Client", "Date", "Amount", "BDT Value", "Method", "Status"];
    rows = MPDB.getPayments(f).map(p => {
      const c = MPDB.getClient(p.clientId);
      return [p.paymentId, c ? c.businessName : p.clientId, MPDB.formatDate(p.paymentDate), MPDB.formatCurrency(p.originalAmount, p.currency), MPDB.formatBDT(p.bdtValue), p.method, p.status];
    });

  } else if (type === "outstanding") {
    title = "Outstanding Payments"; subtitle = "Pending, Unpaid, and Partial balances";
    headers = ["Payment ID", "Client", "Date", "Status", "Outstanding Amount", "Outstanding (BDT)"];
    rows = MPDB.pendingPayments().map(p => {
      const c = MPDB.getClient(p.clientId);
      const owed = MPDB.paymentOutstanding(p);
      return [p.paymentId, c ? c.businessName : p.clientId, MPDB.formatDate(p.paymentDate), p.status, MPDB.formatCurrency(owed, p.currency), MPDB.formatBDT(owed * p.exchangeRate)];
    });

  } else if (type === "activeClients") {
    title = "Active Clients"; subtitle = "";
    headers = ["Client ID", "Business", "Business Type", "Country", "Start Date"];
    rows = MPDB.getClients().filter(c => c.status === "Active").map(c => [c.clientId, c.businessName, c.businessType, c.country, MPDB.formatDate(c.startDate)]);

  } else if (type === "completedClients") {
    title = "Completed Clients"; subtitle = "";
    headers = ["Client ID", "Business", "Business Type", "Country", "Start Date", "End Date"];
    rows = MPDB.getClients().filter(c => c.status === "Completed").map(c => [c.clientId, c.businessName, c.businessType, c.country, MPDB.formatDate(c.startDate), MPDB.formatDate(c.endDate)]);
  }

  CURRENT_REPORT = { headers, rows, title };

  document.getElementById("reportOutput").innerHTML = `
    <div class="mp-card">
      <div class="mp-card-head">
        <div>
          <div class="mp-card-title">${title}</div>
          <div class="text-muted-mp small">${subtitle}</div>
        </div>
      </div>
      <div class="mp-scroll-x">
        <table class="table mp-table mb-0">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.length ? rows.map(r => "<tr>" + r.map(cell => `<td>${cell}</td>`).join("") + "</tr>").join("") : `<tr><td colspan="${headers.length}">${MPUI.emptyState("bi-file-earmark-bar-graph", "No data for this report yet.")}</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function exportCsv() {
  if (!CURRENT_REPORT.rows.length) { MPUI.toast("Nothing to export for this report.", "danger"); return; }
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [CURRENT_REPORT.headers.map(esc).join(",")]
    .concat(CURRENT_REPORT.rows.map(r => r.map(esc).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = CURRENT_REPORT.title.replace(/\s+/g, "_").toLowerCase() + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  MPUI.toast("Report exported as CSV.");
}

/* ---------------- Client Statement (A4 printable) ---------------- */
function renderClientStatement() {
  const clientId = document.getElementById("repClient").value;
  const out = document.getElementById("reportOutput");
  const client = MPDB.getClient(clientId);

  if (!client) {
    out.innerHTML = `<div class="mp-card"><div class="mp-card-body">${MPUI.emptyState("bi-person", "Select a client to generate their statement.")}</div></div>`;
    return;
  }

  const settings = MPDB.getSettings();
  const stats = MPDB.clientStats(client.clientId);
  const services = MPDB.getServices(client.clientId);
  const payments = MPDB.getPayments({ clientId: client.clientId }).slice().sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const today = MPDB.formatDate(new Date().toISOString().slice(0, 10));

  out.innerHTML = `
    <div class="mp-card mp-statement">
      <div class="mp-card-body p-4 p-md-5">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4 pb-3" style="border-bottom:2px solid var(--mp-navy);">
          <div class="d-flex align-items-center gap-3">
            <img src="${typeof MP_LOGO_BASE64 !== "undefined" ? MP_LOGO_BASE64 : ""}" class="mp-statement-logo" alt="logo">
            <div>
              <div class="fw-bold" style="font-family:'Poppins',sans-serif; font-size:16px; color:var(--mp-navy);">${settings.agencyName}</div>
              <div class="text-muted-mp" style="font-size:11.5px;">${settings.ownerName} · ${settings.email}</div>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold" style="font-family:'Poppins',sans-serif; font-size:15px; color:var(--mp-navy);">CLIENT STATEMENT</div>
            <div class="text-muted-mp" style="font-size:11.5px;">Generated ${today}</div>
          </div>
        </div>

        <div class="row g-4 mb-4">
          <div class="col-md-6">
            <div class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em; font-size:11px;">Bill To</div>
            <div class="fw-bold" style="font-size:15px;">${client.businessName}</div>
            <div style="font-size:13px;">${client.fullName}</div>
            <div class="text-muted-mp" style="font-size:12.5px;">${client.country} · ${client.businessType}</div>
            <div class="text-muted-mp" style="font-size:12.5px;">${client.email} · ${client.phone}</div>
          </div>
          <div class="col-md-6">
            <div class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em; font-size:11px;">Account Summary</div>
            <div class="mp-kv"><span class="k">Client ID</span><span class="v">${client.clientId}</span></div>
            <div class="mp-kv"><span class="k">Status</span><span class="v">${client.status}</span></div>
            <div class="mp-kv"><span class="k">Working Since</span><span class="v">${MPDB.formatDate(client.startDate)}</span></div>
            <div class="mp-kv"><span class="k">Total Payments</span><span class="v">${stats.totalPayments}</span></div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-4">
            <div class="p-3 text-center" style="background:var(--mp-cloud); border-radius:12px;">
              <div class="text-muted-mp small">Total Paid</div>
              <div class="fw-bold" style="font-size:17px; color:var(--mp-navy);">${MPDB.formatBDT(stats.totalPaid)}</div>
            </div>
          </div>
          <div class="col-4">
            <div class="p-3 text-center" style="background:var(--mp-cloud); border-radius:12px;">
              <div class="text-muted-mp small">Outstanding</div>
              <div class="fw-bold" style="font-size:17px; color:${stats.outstanding.totalBDT > 0 ? "var(--mp-red)" : "var(--mp-green)"};">${MPDB.formatBDT(stats.outstanding.totalBDT)}</div>
            </div>
          </div>
          <div class="col-4">
            <div class="p-3 text-center" style="background:var(--mp-cloud); border-radius:12px;">
              <div class="text-muted-mp small">Total Services</div>
              <div class="fw-bold" style="font-size:17px; color:var(--mp-navy);">${stats.totalServices}</div>
            </div>
          </div>
        </div>

        <div class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em; font-size:11px;">Services on File</div>
        <table class="table mp-table mb-4" style="font-size:12.5px;">
          <thead><tr><th>Service</th><th>Type</th><th>Period</th><th>Deal Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${services.length ? services.map(s => `<tr>
              <td class="fw-semibold">${s.serviceId}</td><td>${s.type}</td>
              <td>${MPDB.formatDate(s.startDate)} – ${s.endDate ? MPDB.formatDate(s.endDate) : "Ongoing"}</td>
              <td>${MPDB.formatCurrency(s.amount, s.currency)}</td><td>${s.status}</td>
            </tr>`).join("") : `<tr><td colspan="5" class="text-muted-mp">No services on file.</td></tr>`}
          </tbody>
        </table>

        <div class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em; font-size:11px;">Payment History</div>
        <table class="table mp-table mb-2" style="font-size:12.5px;">
          <thead><tr><th>Date</th><th>Payment ID</th><th>Amount</th><th>Rate</th><th>BDT Value</th><th>Method</th><th>Status</th><th>Outstanding</th><th>Proof</th></tr></thead>
          <tbody>
            ${payments.length ? payments.map(p => {
              const owed = MPDB.paymentOutstanding(p);
              return `<tr>
                <td>${MPDB.formatDate(p.paymentDate)}</td><td class="fw-semibold">${p.paymentId}</td>
                <td>${MPDB.formatCurrency(p.originalAmount, p.currency)}</td><td>${p.exchangeRate}</td>
                <td class="fw-semibold">${MPDB.formatBDT(p.bdtValue)}</td><td>${p.method}</td><td>${p.status}</td>
                <td>${owed > 0 ? MPDB.formatCurrency(owed, p.currency) : "—"}</td>
                <td>${MPUI.proofThumbHtml(p)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="9" class="text-muted-mp">No payments recorded yet.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--mp-navy);">
              <td colspan="4" class="text-end fw-bold">Total Received (BDT)</td>
              <td class="fw-bold">${MPDB.formatBDT(stats.totalPaid)}</td>
              <td colspan="4"></td>
            </tr>
            ${stats.outstanding.totalBDT > 0 ? `
            <tr>
              <td colspan="4" class="text-end fw-bold text-danger">Outstanding Balance (BDT)</td>
              <td class="fw-bold text-danger">${MPDB.formatBDT(stats.outstanding.totalBDT)}</td>
              <td colspan="4"></td>
            </tr>` : ""}
          </tfoot>
        </table>

        <div class="mt-5 pt-3 text-center text-muted-mp" style="font-size:11px; border-top:1px solid var(--mp-border);">
          ${settings.agencyName} · ${settings.email} · This statement reflects the exchange rate on record for each individual payment.
        </div>
      </div>
    </div>`;
}
