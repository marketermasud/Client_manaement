/* =========================================================
   client-details.js
   ========================================================= */

let CD_CLIENT_ID = null;
let CD_PAYMENT_PROOF_UPLOADER = null;
const SERVICE_TYPES_CD = ["Monthly","One Time","Setup","Audit","Optimization","Consultation","Tracking","Google Ads Management","Meta Ads Management","Shopify","Analytics","Other"];
const PAYMENT_METHODS_CD = ["Bank Transfer","Wise","PayPal","Payoneer","Stripe","bKash","Nagad","Rocket","Upay","Cash","Card","Other"];

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      CD_CLIENT_ID = MPUI.qs("id");
      const client = MPDB.getClient(CD_CLIENT_ID);
      const root = document.getElementById("detailsRoot");

      if (!client) {
        root.innerHTML = MPUI.emptyState("bi-person-x", "Client not found. It may have been deleted.") +
          `<div class="text-center"><a href="clients.html" class="btn btn-mp-outline mt-2">Back to Clients</a></div>`;
        return;
      }

      render(client);
      window.addEventListener("mpdb:update", () => {
        // Don't blow away an in-progress edit if the user has a modal open —
        // their own submit already re-renders explicitly once it's done.
        if (document.querySelector(".modal.show")) return;
        const fresh = MPDB.getClient(CD_CLIENT_ID);
        if (fresh) render(fresh);
        else {
          document.getElementById("detailsRoot").innerHTML = MPUI.emptyState("bi-person-x", "This client was deleted.") +
            `<div class="text-center"><a href="clients.html" class="btn btn-mp-outline mt-2">Back to Clients</a></div>`;
        }
      });
    });
  });
});

function render(client) {
  const stats = MPDB.clientStats(client.clientId);
  const root = document.getElementById("detailsRoot");

  root.innerHTML = `
    <nav class="small text-muted-mp mb-3">
      <a href="clients.html" class="text-muted-mp text-decoration-none"><i class="bi bi-arrow-left me-1"></i>Clients</a>
      <span class="mx-1">/</span><span>${client.businessName}</span>
    </nav>

    <div class="mp-card mb-3">
      <div class="mp-card-body d-flex flex-wrap align-items-center gap-3 justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <div class="mp-ring-avatar" style="width:56px;height:56px;"><span style="font-size:17px;">${MPUI.initials(client.businessName)}</span></div>
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h4 class="mb-0">${client.businessName}</h4>
              ${MPUI.badgeHtml(client.status)}
            </div>
            <div class="text-muted-mp small">${client.fullName} · ${client.clientId} · ${client.businessType}</div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <a href="reports.html?client=${client.clientId}" class="btn btn-mp-outline"><i class="bi bi-file-earmark-bar-graph me-1"></i>Statement</a>
          <button class="btn btn-mp-outline" onclick="openEditClient()"><i class="bi bi-pencil me-1"></i>Edit</button>
          <button class="btn btn-mp-danger-ghost btn-mp-outline" onclick="onDeleteThisClient()"><i class="bi bi-trash me-1"></i>Delete</button>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-1">
      ${statCard("bi-cash-coin", "bg-navy", MPDB.formatBDT(stats.totalPaid), "Total Paid")}
      ${statCard("bi-receipt", "bg-blue", stats.totalPayments, "Total Payments")}
      ${statCard("bi-kanban", "bg-green", stats.totalServices, "Total Services")}
      ${statCard("bi-exclamation-triangle", stats.outstanding.totalBDT > 0 ? "bg-red" : "bg-green", MPDB.formatBDT(stats.outstanding.totalBDT), "Outstanding Balance")}
      ${statCard("bi-calendar-check", "bg-gold", MPDB.formatDate(stats.firstPayment), "First Payment")}
    </div>

    ${stats.outstanding.byCurrency.length ? `
    <div class="alert border-0 d-flex flex-wrap gap-3 align-items-center mb-3" style="background:rgba(234,67,53,.08); border-radius:12px;">
      <i class="bi bi-exclamation-triangle-fill text-danger"></i>
      <span class="small fw-semibold">Outstanding by currency:</span>
      ${stats.outstanding.byCurrency.map(r => `<span class="mp-currency-pill">${MPDB.formatCurrency(r.amount, r.code)} <span class="text-muted-mp fw-normal">(≈ ${MPDB.formatBDT(r.bdt)})</span></span>`).join("")}
    </div>` : ""}

    <div class="mp-card mt-3">
      <div class="mp-card-head" style="border-bottom:none; padding-bottom:0;">
        <ul class="nav mp-tabs" role="tablist">
          <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabOverview" type="button">Overview</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabServices" type="button">Services</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabPayments" type="button">Payment History</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabActivity" type="button">Activity</button></li>
        </ul>
      </div>
      <div class="mp-card-body">
        <div class="tab-content">
          <div class="tab-pane fade show active" id="tabOverview">${overviewHtml(client)}</div>
          <div class="tab-pane fade" id="tabServices">${servicesHtml(client)}</div>
          <div class="tab-pane fade" id="tabPayments">${paymentsHtml(client)}</div>
          <div class="tab-pane fade" id="tabActivity">${activityHtml(client)}</div>
        </div>
      </div>
    </div>
  `;

  renderModals(client);
}

function statCard(icon, bg, value, label) {
  return `<div class="col-6 col-lg">
    <div class="mp-stat-card">
      <div class="mp-stat-icon ${bg}"><i class="bi ${icon}"></i></div>
      <div class="mp-stat-value" style="font-size:17px;">${value}</div>
      <div class="mp-stat-label">${label}</div>
    </div>
  </div>`;
}

function row(label, value) {
  return `<div class="mp-kv"><span class="k">${label}</span><span class="v">${value || "—"}</span></div>`;
}

function overviewHtml(c) {
  return `
    <div class="row g-4">
      <div class="col-md-6">
        <h6 class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em;">Basic Information</h6>
        ${row("Full Name", c.fullName)}${row("Business Name", c.businessName)}${row("Business Type", c.businessType)}
        ${row("Country", c.country)}${row("Phone", c.phone)}${row("Email", c.email)}${row("WhatsApp", c.whatsapp)}
      </div>
      <div class="col-md-6">
        <h6 class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em;">Online Presence</h6>
        ${row("Website", c.website)}${row("Facebook", c.facebook)}${row("Instagram", c.instagram)}${row("LinkedIn", c.linkedin)}
        <h6 class="text-muted-mp text-uppercase small fw-bold mb-2 mt-4" style="letter-spacing:.05em;">Advertising</h6>
        ${row("Google Ads Customer ID", c.googleAdsId)}${row("Meta Ads Account ID", c.metaAdsId)}${row("Google Business Profile", c.gbpUrl)}
      </div>
      <div class="col-12">
        <h6 class="text-muted-mp text-uppercase small fw-bold mb-2" style="letter-spacing:.05em;">Work Information</h6>
        <div class="row">
          <div class="col-md-4">${row("Start Date", MPDB.formatDate(c.startDate))}</div>
          <div class="col-md-4">${row("End Date", c.endDate ? MPDB.formatDate(c.endDate) : "Ongoing")}</div>
          <div class="col-md-4">${row("Status", c.status)}</div>
        </div>
        ${c.notes ? `<div class="mt-2 p-3" style="background:var(--mp-cloud); border-radius:10px; font-size:13.5px;">${c.notes}</div>` : ""}
      </div>
    </div>`;
}

function servicesHtml(c) {
  const svcs = MPDB.getServices(c.clientId);
  return `
    <div class="d-flex justify-content-end mb-2">
      <button class="btn btn-mp-primary btn-sm" onclick="openServiceModal(null)"><i class="bi bi-plus-lg me-1"></i>Add Service</button>
    </div>
    <div class="mp-scroll-x">
      <table class="table mp-table mb-0">
        <thead><tr><th>Service ID</th><th>Type</th><th>Description</th><th>Start</th><th>End</th><th>Amount</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${svcs.length ? svcs.map(s => `<tr>
            <td class="fw-semibold">${s.serviceId}</td><td>${s.type}</td><td class="text-muted-mp">${s.description || "—"}</td>
            <td>${MPDB.formatDate(s.startDate)}</td><td>${s.endDate ? MPDB.formatDate(s.endDate) : "Ongoing"}</td>
            <td>${MPDB.formatCurrency(s.amount, s.currency)}</td><td>${MPUI.badgeHtml(s.status)}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <button class="btn btn-mp-outline" title="Edit" onclick="openServiceModal('${s.serviceId}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-mp-outline text-danger" title="Delete" onclick="onDeleteService('${s.serviceId}')"><i class="bi bi-trash"></i></button>
              </div>
            </td>
          </tr>`).join("") : `<tr><td colspan="8">${MPUI.emptyState("bi-kanban", "No services yet for this client.")}</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function paymentsHtml(c) {
  const pays = MPDB.getPayments({ clientId: c.clientId });
  return `
    <div class="d-flex justify-content-end mb-2">
      <button class="btn btn-mp-primary btn-sm" onclick="openPaymentModal(null)"><i class="bi bi-plus-lg me-1"></i>Add Payment</button>
    </div>
    <div class="mp-scroll-x">
      <table class="table mp-table mb-0">
        <thead><tr><th>Payment ID</th><th>Date</th><th>Amount</th><th>Rate</th><th>BDT Value</th><th>Outstanding</th><th>Method</th><th>Service</th><th>Status</th><th>Proof</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${pays.length ? pays.map(p => {
            const svc = MPDB.getService(p.serviceId);
            const owed = MPDB.paymentOutstanding(p);
            return `<tr>
              <td class="fw-semibold">${p.paymentId}</td><td>${MPDB.formatDate(p.paymentDate)}</td>
              <td>${MPDB.formatCurrency(p.originalAmount, p.currency)}</td><td class="text-muted-mp">${p.exchangeRate}</td>
              <td class="fw-semibold">${MPDB.formatBDT(p.bdtValue)}</td>
              <td>${owed > 0 ? `<span class="text-danger fw-semibold">${MPDB.formatCurrency(owed, p.currency)}</span>` : "—"}</td>
              <td>${p.method}</td><td class="text-muted-mp">${svc ? svc.type : "—"}</td>
              <td>${MPUI.badgeHtml(p.status)}</td>
              <td>${MPUI.proofThumbHtml(p)}</td>
              <td class="text-end">
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-mp-outline" title="Edit" onclick="openPaymentModal('${p.paymentId}')"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-mp-outline text-danger" title="Delete" onclick="onDeletePayment('${p.paymentId}')"><i class="bi bi-trash"></i></button>
                </div>
              </td>
            </tr>`;
          }).join("") : `<tr><td colspan="11">${MPUI.emptyState("bi-receipt", "No payments yet for this client.")}</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function activityHtml(c) {
  const acts = MPDB.getActivities(c.clientId);
  const icon = { created: "bi-person-plus", updated: "bi-pencil", payment: "bi-cash-coin", service: "bi-kanban" };
  if (!acts.length) return MPUI.emptyState("bi-clock-history", "No activity recorded yet.");
  return `<div class="d-flex flex-column gap-3">${acts.map(a => `
    <div class="d-flex gap-3">
      <div class="mp-avatar-sm" style="border-radius:50%;"><i class="bi ${icon[a.type] || 'bi-dot'}" style="font-size:13px;"></i></div>
      <div>
        <div style="font-size:13.6px;">${a.text}</div>
        <div class="text-muted-mp" style="font-size:11.5px;">${MPDB.timeAgo(a.date)}</div>
      </div>
    </div>`).join("")}</div>`;
}

/* ---------------- Modals ---------------- */
function renderModals(c) {
  document.querySelectorAll(".mp-cd-modal").forEach(m => m.remove());
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="modal fade mp-cd-modal" id="editClientModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-header"><h5 class="modal-title">Edit Client</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form id="editClientForm">
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label">Full Name</label><input class="form-control" id="ec_fullName" value="${c.fullName}" required></div>
            <div class="col-md-6"><label class="form-label">Business Name</label><input class="form-control" id="ec_businessName" value="${c.businessName}" required></div>
            <div class="col-md-6"><label class="form-label">Phone</label><input class="form-control" id="ec_phone" value="${c.phone}"></div>
            <div class="col-md-6"><label class="form-label">Email</label><input class="form-control" id="ec_email" value="${c.email}"></div>
            <div class="col-md-6"><label class="form-label">Status</label>
              <select class="form-select" id="ec_status">
                ${["Active","Paused","Completed","Lead","Inactive"].map(s => `<option ${s===c.status?"selected":""}>${s}</option>`).join("")}
              </select>
            </div>
            <div class="col-md-6"><label class="form-label">End Date</label><input type="date" class="form-control" id="ec_endDate" value="${c.endDate||""}"></div>
            <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" id="ec_notes" rows="2">${c.notes||""}</textarea></div>
          </div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-mp-outline" data-bs-dismiss="modal">Cancel</button><button class="btn btn-mp-primary px-4">Save Changes</button></div>
        </form>
      </div></div>
    </div>

    <div class="modal fade mp-cd-modal" id="serviceModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-header"><h5 class="modal-title" id="cd_serviceModalTitle">Add Service — ${c.businessName}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form id="cd_serviceForm">
        <div class="modal-body">
          <input type="hidden" id="sv_serviceId">
          <div class="mb-3"><label class="form-label mp-required">Service Type</label>
            <select class="form-select" id="sv_type" required>${SERVICE_TYPES_CD.map(t=>`<option>${t}</option>`).join("")}</select>
          </div>
          <div class="mb-3"><label class="form-label">Description</label><input class="form-control" id="sv_description"></div>
          <div class="row g-3 mb-3">
            <div class="col-6"><label class="form-label mp-required">Start Date</label><input type="date" class="form-control" id="sv_startDate" required></div>
            <div class="col-6">
              <label class="form-label">End Date</label>
              <input type="date" class="form-control" id="sv_endDate">
              <div class="small text-muted-mp mt-1">Auto-fills when status isn't Active.</div>
            </div>
          </div>
          <div class="row g-3 mb-2">
            <div class="col-6"><label class="form-label mp-required">Deal Amount</label><input type="number" min="0" step="0.01" class="form-control" id="sv_amount" required></div>
            <div class="col-6"><label class="form-label mp-required">Currency</label><select class="form-select" id="sv_currency" required></select></div>
          </div>
          <div class="small text-muted-mp mb-3" id="sv_bdtPreview">≈ ৳0 — reference only, not counted in revenue.</div>
          <div class="mb-1"><label class="form-label">Status <span class="text-muted-mp fw-normal">(editable any time)</span></label>
            <select class="form-select" id="sv_status">${["Active","Completed","Paused","Cancelled"].map(s=>`<option>${s}</option>`).join("")}</select>
          </div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-mp-outline" data-bs-dismiss="modal">Cancel</button><button class="btn btn-mp-primary px-4" id="sv_saveBtn">Save Service</button></div>
        </form>
      </div></div>
    </div>

    <div class="modal fade mp-cd-modal" id="paymentModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-header"><h5 class="modal-title" id="cd_paymentModalTitle">Add Payment — ${c.businessName}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form id="cd_paymentForm">
        <div class="modal-body">
          <input type="hidden" id="pm_paymentId">
          <input type="hidden" id="pm_reservedId">
          <div class="mb-3">
            <label class="form-label mp-required">Service</label>
            <select class="form-select" id="pm_service" required></select>
            <div class="small text-muted-mp mt-1">Currency (from service): <span class="mp-currency-pill" id="pm_currencyLabel">—</span> <span id="pm_dueHint"></span></div>
            <div class="alert alert-danger py-2 px-3 small mt-2 mb-0 d-none" id="pm_duplicateWarning"></div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-6"><label class="form-label mp-required">Payment Date</label><input type="date" class="form-control" id="pm_date" required></div>
            <div class="col-6"><label class="form-label mp-required">Amount Received Now</label><input type="number" min="0.01" step="0.01" class="form-control" id="pm_amount" required></div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-6"><label class="form-label mp-required">Exchange Rate (to BDT)</label><input type="number" min="0.01" step="0.0001" class="form-control" id="pm_rate" required></div>
            <div class="col-6"><label class="form-label mp-required">Payment Method</label>
              <select class="form-select" id="pm_method" required>${PAYMENT_METHODS_CD.map(m=>`<option>${m}</option>`).join("")}</select>
            </div>
          </div>
          <div class="mb-3"><label class="form-label mp-required">Status</label>
            <select class="form-select" id="pm_status" required><option>Pending</option><option>Paid</option><option>Unpaid</option><option>Partial</option></select>
          </div>
          <div class="d-none" id="pm_partialBlock">
            <div class="row g-3 mb-3">
              <div class="col-6"><label class="form-label mp-required">Total Deal Amount</label><input type="number" min="0" step="0.01" class="form-control" id="pm_totalDue"></div>
              <div class="col-6"><label class="form-label">Remaining Balance</label><input type="text" class="form-control" id="pm_remainingPreview" disabled></div>
            </div>
          </div>
          <div class="mb-3"><label class="form-label">Payment Reference</label><input class="form-control" id="pm_reference"></div>
          <div class="mb-3"><label class="form-label">Notes</label><textarea class="form-control" id="pm_notes" rows="2"></textarea></div>
          <div class="mb-1" id="pm_proofContainer"></div>
          <div class="alert alert-light border small mt-2 mb-0" id="pm_bdtPreview">BDT Value: —</div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-mp-outline" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-mp-primary px-4" id="pm_saveBtn">Save Payment</button></div>
        </form>
      </div></div>
    </div>`;
  document.body.appendChild(wrap);

  document.getElementById("editClientForm").addEventListener("submit", e => {
    e.preventDefault();
    MPDB.updateClient(c.clientId, {
      fullName: document.getElementById("ec_fullName").value,
      businessName: document.getElementById("ec_businessName").value,
      phone: document.getElementById("ec_phone").value,
      email: document.getElementById("ec_email").value,
      status: document.getElementById("ec_status").value,
      endDate: document.getElementById("ec_endDate").value,
      notes: document.getElementById("ec_notes").value
    });
    bootstrap.Modal.getInstance(document.getElementById("editClientModal")).hide();
    MPUI.toast("Client updated successfully.");
    render(MPDB.getClient(c.clientId));
  });

  /* ---- Service modal wiring ---- */
  const svCurrencySel = document.getElementById("sv_currency");
  MPDB.getCurrencies().forEach(cur => svCurrencySel.insertAdjacentHTML("beforeend", `<option value="${cur.code}" data-rate="${cur.rate}">${cur.code} — ${cur.name}</option>`));

  function svUpdatePreview() {
    const amt = parseFloat(document.getElementById("sv_amount").value) || 0;
    const opt = svCurrencySel.selectedOptions[0];
    const rate = opt ? parseFloat(opt.getAttribute("data-rate")) || 0 : 0;
    const code = svCurrencySel.value;
    const bdt = code === "BDT" ? amt : amt * rate;
    document.getElementById("sv_bdtPreview").textContent = `≈ ${MPDB.formatBDT(bdt)} — reference only, not counted in revenue.`;
  }
  document.getElementById("sv_amount").addEventListener("input", svUpdatePreview);
  svCurrencySel.addEventListener("change", svUpdatePreview);
  document.getElementById("sv_status").addEventListener("change", function () {
    const status = this.value;
    const endDateEl = document.getElementById("sv_endDate");
    if (status === "Active") {
      endDateEl.value = "";
    } else if (!endDateEl.value) {
      endDateEl.value = new Date().toISOString().slice(0, 10);
    }
  });

  document.getElementById("serviceModal").addEventListener("hidden.bs.modal", () => {
    document.getElementById("cd_serviceForm").reset();
    document.getElementById("sv_serviceId").value = "";
    document.getElementById("cd_serviceModalTitle").textContent = "Add Service — " + c.businessName;
    document.getElementById("sv_saveBtn").textContent = "Save Service";
    svUpdatePreview();
  });

  document.getElementById("cd_serviceForm").addEventListener("submit", e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("sv_amount").value);
    if (!(amount >= 0)) { MPUI.toast("Amount must be 0 or greater.", "danger"); return; }
    const payload = {
      clientId: c.clientId,
      type: document.getElementById("sv_type").value,
      description: document.getElementById("sv_description").value,
      startDate: document.getElementById("sv_startDate").value,
      endDate: document.getElementById("sv_endDate").value,
      amount,
      currency: svCurrencySel.value,
      status: document.getElementById("sv_status").value
    };
    const editId = document.getElementById("sv_serviceId").value;
    if (editId) {
      MPDB.updateService(editId, payload);
      MPUI.toast("Service updated successfully.");
    } else {
      MPDB.addService(Object.assign({ notes: "" }, payload));
      MPUI.toast("Service added successfully.");
    }
    bootstrap.Modal.getInstance(document.getElementById("serviceModal")).hide();
    render(MPDB.getClient(c.clientId));
  });

  /* ---- Payment modal wiring ---- */
  const pmServiceSel = document.getElementById("pm_service");
  function refreshServiceDropdown() {
    const svcs = MPDB.getServices(c.clientId);
    pmServiceSel.innerHTML = svcs.length ? svcs.map(s => `<option value="${s.serviceId}">${s.serviceId} — ${s.type}</option>`).join("") : `<option value="">Add a service first</option>`;
  }
  refreshServiceDropdown();

  const pmProofUploader = MPUI.createProofUploader(document.getElementById("pm_proofContainer"), () => {
    const paymentId = document.getElementById("pm_paymentId").value || document.getElementById("pm_reservedId").value;
    return paymentId ? { clientId: c.clientId, paymentId } : null;
  });
  CD_PAYMENT_PROOF_UPLOADER = pmProofUploader;
  let pmFormJustSubmitted = false;

  function pmOnServiceChange() {
    const svc = MPDB.getService(pmServiceSel.value);
    document.getElementById("pm_currencyLabel").textContent = svc ? svc.currency : "—";
    const dueHint = document.getElementById("pm_dueHint");
    const warnEl = document.getElementById("pm_duplicateWarning");
    const amountEl = document.getElementById("pm_amount");
    const isNewPayment = !document.getElementById("pm_paymentId").value;

    if (svc) {
      const cur = MPDB.getCurrency(svc.currency);
      if (cur) document.getElementById("pm_rate").value = cur.rate;
      const due = MPDB.serviceOutstanding(svc.serviceId);
      dueHint.textContent = due > 0 ? `· Balance due: ${MPDB.formatCurrency(due, svc.currency)}` : "";

      const settledPayments = MPDB.getPayments({ serviceId: svc.serviceId }).filter(p => p.status === "Paid" || p.status === "Partial");
      const alreadySettled = isNewPayment && due <= 0 && settledPayments.length > 0;
      if (alreadySettled) {
        const list = settledPayments.map(p => p.paymentId + (p.reference ? ` (Ref: ${p.reference})` : "")).join(", ");
        warnEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i>This service already shows full payment. Existing payment${settledPayments.length > 1 ? "s" : ""}: ${list}`;
        warnEl.classList.remove("d-none");
        amountEl.classList.add("mp-input-danger");
      } else {
        warnEl.classList.add("d-none");
        amountEl.classList.remove("mp-input-danger");
      }

      if (isNewPayment) {
        // Default to whatever balance is still due on this service, not the
        // full original deal amount, if an earlier partial/pending payment
        // already left something owing.
        const defaultAmt = due > 0 ? due : (svc.amount || "");
        amountEl.value = defaultAmt;
        document.getElementById("pm_totalDue").value = defaultAmt;
      }
    } else {
      dueHint.textContent = "";
      warnEl.classList.add("d-none");
      amountEl.classList.remove("mp-input-danger");
    }
    pmUpdatePreview();
  }
  function pmUpdatePreview() {
    const amt = parseFloat(document.getElementById("pm_amount").value) || 0;
    const rate = parseFloat(document.getElementById("pm_rate").value) || 0;
    const code = document.getElementById("pm_currencyLabel").textContent;
    const bdt = code === "BDT" ? amt : amt * rate;
    document.getElementById("pm_bdtPreview").textContent = "BDT Value: " + MPDB.formatBDT(bdt);
    if (document.getElementById("pm_status").value === "Partial") {
      const totalDue = parseFloat(document.getElementById("pm_totalDue").value) || 0;
      const remaining = Math.max(0, totalDue - amt);
      document.getElementById("pm_remainingPreview").value = (code === "—" ? "" : code + " ") + remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  function pmOnStatusChange() {
    const status = document.getElementById("pm_status").value;
    document.getElementById("pm_partialBlock").classList.toggle("d-none", status !== "Partial");
    pmUpdatePreview();
  }

  pmServiceSel.addEventListener("change", pmOnServiceChange);
  document.getElementById("pm_amount").addEventListener("input", pmUpdatePreview);
  document.getElementById("pm_rate").addEventListener("input", pmUpdatePreview);
  document.getElementById("pm_totalDue").addEventListener("input", pmUpdatePreview);
  document.getElementById("pm_status").addEventListener("change", pmOnStatusChange);

  document.getElementById("paymentModal").addEventListener("hidden.bs.modal", () => {
    if (!pmFormJustSubmitted) pmProofUploader.discardIfUnsaved();
    pmFormJustSubmitted = false;
    document.getElementById("cd_paymentForm").reset();
    document.getElementById("pm_paymentId").value = "";
    document.getElementById("pm_reservedId").value = "";
    document.getElementById("cd_paymentModalTitle").textContent = "Add Payment — " + c.businessName;
    document.getElementById("pm_saveBtn").textContent = "Save Payment";
    document.getElementById("pm_partialBlock").classList.add("d-none");
    document.getElementById("pm_date").value = new Date().toISOString().slice(0, 10);
    pmProofUploader.setProofs([]);
    refreshServiceDropdown();
    pmOnServiceChange();
  });

  document.getElementById("cd_paymentForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!pmServiceSel.value) { MPUI.toast("Add a service for this client first.", "danger"); return; }
    const amount = parseFloat(document.getElementById("pm_amount").value);
    const rate = parseFloat(document.getElementById("pm_rate").value);
    if (!(amount > 0)) { MPUI.toast("Amount must be greater than 0.", "danger"); return; }
    if (!(rate > 0)) { MPUI.toast("Exchange rate must be greater than 0.", "danger"); return; }

    const status = document.getElementById("pm_status").value;
    const proofs = pmProofUploader.getProofs();
    const payload = {
      clientId: c.clientId,
      serviceId: pmServiceSel.value,
      paymentDate: document.getElementById("pm_date").value,
      originalAmount: amount,
      exchangeRate: rate,
      method: document.getElementById("pm_method").value,
      status,
      totalDue: status === "Partial" ? (parseFloat(document.getElementById("pm_totalDue").value) || amount) : undefined,
      reference: document.getElementById("pm_reference").value,
      notes: document.getElementById("pm_notes").value,
      proofs
    };

    const editId = document.getElementById("pm_paymentId").value;
    if (editId) {
      MPDB.updatePayment(editId, payload);
      MPUI.toast("Payment updated successfully.");
    } else {
      payload.paymentId = document.getElementById("pm_reservedId").value || undefined;
      MPDB.addPayment(payload);
      MPUI.toast("Payment recorded successfully.");
    }
    pmFormJustSubmitted = true;
    pmProofUploader.markSaved();
    bootstrap.Modal.getInstance(document.getElementById("paymentModal")).hide();
    render(MPDB.getClient(c.clientId));
  });
}

function openEditClient() { new bootstrap.Modal(document.getElementById("editClientModal")).show(); }

function openServiceModal(serviceId) {
  document.getElementById("cd_serviceForm").reset();
  document.getElementById("sv_serviceId").value = "";
  document.getElementById("cd_serviceModalTitle").textContent = "Add Service";
  document.getElementById("sv_saveBtn").textContent = "Save Service";
  if (serviceId) {
    const s = MPDB.getService(serviceId);
    document.getElementById("cd_serviceModalTitle").textContent = "Edit Service — " + s.serviceId;
    document.getElementById("sv_saveBtn").textContent = "Save Changes";
    document.getElementById("sv_serviceId").value = s.serviceId;
    document.getElementById("sv_type").value = s.type;
    document.getElementById("sv_description").value = s.description || "";
    document.getElementById("sv_startDate").value = s.startDate || "";
    document.getElementById("sv_endDate").value = s.endDate || "";
    document.getElementById("sv_amount").value = s.amount;
    document.getElementById("sv_currency").value = s.currency;
    document.getElementById("sv_status").value = s.status;
  }
  document.getElementById("sv_amount").dispatchEvent(new Event("input"));
  new bootstrap.Modal(document.getElementById("serviceModal")).show();
}

function openPaymentModal(paymentId) {
  document.getElementById("cd_paymentForm").reset();
  document.getElementById("pm_paymentId").value = "";
  document.getElementById("pm_reservedId").value = "";
  document.getElementById("cd_paymentModalTitle").textContent = "Add Payment";
  document.getElementById("pm_saveBtn").textContent = "Save Payment";
  document.getElementById("pm_date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("pm_partialBlock").classList.add("d-none");
  document.getElementById("pm_duplicateWarning").classList.add("d-none");
  document.getElementById("pm_amount").classList.remove("mp-input-danger");
  if (CD_PAYMENT_PROOF_UPLOADER) CD_PAYMENT_PROOF_UPLOADER.setProofs([]);

  if (paymentId) {
    const p = MPDB.getPayment(paymentId);
    document.getElementById("cd_paymentModalTitle").textContent = "Edit Payment — " + p.paymentId;
    document.getElementById("pm_saveBtn").textContent = "Save Changes";
    document.getElementById("pm_paymentId").value = p.paymentId;
    document.getElementById("pm_service").value = p.serviceId;
    document.getElementById("pm_currencyLabel").textContent = p.currency;
    document.getElementById("pm_date").value = p.paymentDate;
    document.getElementById("pm_amount").value = p.originalAmount;
    document.getElementById("pm_rate").value = p.exchangeRate;
    document.getElementById("pm_method").value = p.method;
    document.getElementById("pm_status").value = p.status;
    document.getElementById("pm_totalDue").value = p.totalDue || p.originalAmount;
    document.getElementById("pm_reference").value = p.reference || "";
    document.getElementById("pm_notes").value = p.notes || "";
    document.getElementById("pm_partialBlock").classList.toggle("d-none", p.status !== "Partial");
    if (CD_PAYMENT_PROOF_UPLOADER) CD_PAYMENT_PROOF_UPLOADER.setProofs(p.proofs || []);
  } else {
    document.getElementById("pm_reservedId").value = MPDB.nextPaymentId();
  }
  document.getElementById("pm_amount").dispatchEvent(new Event("input"));
  new bootstrap.Modal(document.getElementById("paymentModal")).show();
}

function onDeleteThisClient() {
  const c = MPDB.getClient(CD_CLIENT_ID);
  MPUI.confirmAction(`Delete ${c.businessName}? This also removes their services and payment history.`, () => {
    MPDB.deleteClient(CD_CLIENT_ID);
    MPUI.toast("Client deleted successfully.", "danger");
    window.location.href = "clients.html";
  });
}

function onDeleteService(id) {
  MPUI.confirmAction("Delete this service? Related payments will also be removed.", () => {
    MPDB.deleteService(id);
    MPUI.toast("Service deleted successfully.", "danger");
    render(MPDB.getClient(CD_CLIENT_ID));
  });
}

function onDeletePayment(id) {
  MPUI.confirmAction("Delete this payment record?", () => {
    MPDB.deletePayment(id);
    MPUI.toast("Payment deleted successfully.", "danger");
    render(MPDB.getClient(CD_CLIENT_ID));
  });
}
