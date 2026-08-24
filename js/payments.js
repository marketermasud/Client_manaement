/* =========================================================
   payments.js — Payments page
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      populateOptions();

      ["pSearch", "pFilterClient", "pFilterCurrency", "pFilterMethod", "pFilterStatus", "pFrom", "pTo"].forEach(id => {
        document.getElementById(id).addEventListener("input", renderPayments);
        document.getElementById(id).addEventListener("change", renderPayments);
      });

      document.getElementById("p_client").addEventListener("change", () => { syncServiceOptions(); });
      document.getElementById("p_service").addEventListener("change", onServiceChange);
      document.getElementById("p_amount").addEventListener("input", updatePreview);
      document.getElementById("p_rate").addEventListener("input", updatePreview);
      document.getElementById("p_status").addEventListener("change", onStatusChange);
      document.getElementById("p_totalDue").addEventListener("input", updatePreview);

      document.getElementById("addPaymentBtn").addEventListener("click", () => openPaymentModal(null));
      document.getElementById("paymentForm").addEventListener("submit", onSubmitPayment);
      document.getElementById("paymentModal").addEventListener("hidden.bs.modal", resetPaymentForm);

      renderPayments();
      window.addEventListener("mpdb:update", renderPayments);
    });
  });
});

function populateOptions() {
  const clients = MPDB.getClients();
  const clientFilter = document.getElementById("pFilterClient");
  const clientForm = document.getElementById("p_client");
  clients.forEach(c => {
    clientFilter.insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName}</option>`);
    clientForm.insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName} (${c.clientId})</option>`);
  });

  const currFilter = document.getElementById("pFilterCurrency");
  MPDB.getCurrencies().forEach(cur => currFilter.insertAdjacentHTML("beforeend", `<option value="${cur.code}">${cur.code}</option>`));

  const methodFilter = document.getElementById("pFilterMethod");
  ["Bank Transfer","Wise","PayPal","Payoneer","Stripe","bKash","Nagad","Rocket","Upay","Cash","Card","Other"].forEach(m =>
    methodFilter.insertAdjacentHTML("beforeend", `<option value="${m}">${m}</option>`));
}

function syncServiceOptions() {
  const clientId = document.getElementById("p_client").value;
  const svcSel = document.getElementById("p_service");
  const svcs = MPDB.getServices(clientId || undefined);
  svcSel.innerHTML = svcs.length
    ? svcs.map(s => `<option value="${s.serviceId}">${s.serviceId} — ${s.type}${clientId ? "" : " (" + (MPDB.getClient(s.clientId)?.businessName || s.clientId) + ")"}</option>`).join("")
    : `<option value="">No services yet — add one on the Services page first</option>`;
  onServiceChange();
}

function onServiceChange() {
  const svc = MPDB.getService(document.getElementById("p_service").value);
  const code = svc ? svc.currency : "—";
  document.getElementById("p_currencyLabel").textContent = code;
  if (svc) {
    const cur = MPDB.getCurrency(svc.currency);
    if (cur) document.getElementById("p_rate").value = cur.rate;
    if (!document.getElementById("p_paymentId").value) {
      document.getElementById("p_amount").value = svc.amount || "";
      document.getElementById("p_totalDue").value = svc.amount || "";
    }
  }
  updatePreview();
}

function onStatusChange() {
  const status = document.getElementById("p_status").value;
  const block = document.getElementById("p_partialBlock");
  block.classList.toggle("d-none", status !== "Partial");
  updatePreview();
}

function updatePreview() {
  const amt = parseFloat(document.getElementById("p_amount").value) || 0;
  const rate = parseFloat(document.getElementById("p_rate").value) || 0;
  const code = document.getElementById("p_currencyLabel").textContent;
  const bdt = code === "BDT" ? amt : amt * rate;
  document.getElementById("p_bdtPreview").textContent = "BDT Value: " + MPDB.formatBDT(bdt);

  if (document.getElementById("p_status").value === "Partial") {
    const totalDue = parseFloat(document.getElementById("p_totalDue").value) || 0;
    const remaining = Math.max(0, totalDue - amt);
    document.getElementById("p_remainingPreview").value = (code === "—" ? "" : code + " ") + remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function resetPaymentForm() {
  document.getElementById("paymentForm").reset();
  document.getElementById("p_paymentId").value = "";
  document.getElementById("paymentModalTitle").textContent = "Add Payment";
  document.getElementById("p_saveBtn").textContent = "Save Payment";
  document.getElementById("p_currencyLabel").textContent = "—";
  document.getElementById("p_partialBlock").classList.add("d-none");
  document.getElementById("p_date").value = new Date().toISOString().slice(0, 10);
  syncServiceOptions();
}

function openPaymentModal(paymentId) {
  resetPaymentForm();
  if (paymentId) {
    const p = MPDB.getPayment(paymentId);
    document.getElementById("paymentModalTitle").textContent = "Edit Payment — " + p.paymentId;
    document.getElementById("p_saveBtn").textContent = "Save Changes";
    document.getElementById("p_paymentId").value = p.paymentId;
    document.getElementById("p_client").value = p.clientId;
    syncServiceOptions();
    document.getElementById("p_service").value = p.serviceId;
    document.getElementById("p_currencyLabel").textContent = p.currency;
    document.getElementById("p_date").value = p.paymentDate;
    document.getElementById("p_amount").value = p.originalAmount;
    document.getElementById("p_rate").value = p.exchangeRate;
    document.getElementById("p_method").value = p.method;
    document.getElementById("p_status").value = p.status;
    document.getElementById("p_totalDue").value = p.totalDue || p.originalAmount;
    document.getElementById("p_reference").value = p.reference || "";
    document.getElementById("p_notes").value = p.notes || "";
    onStatusChange();
  }
  new bootstrap.Modal(document.getElementById("paymentModal")).show();
}

function renderPayments() {
  const filters = {
    clientId: document.getElementById("pFilterClient").value !== "all" ? document.getElementById("pFilterClient").value : undefined,
    currency: document.getElementById("pFilterCurrency").value,
    method: document.getElementById("pFilterMethod").value,
    status: document.getElementById("pFilterStatus").value,
    from: document.getElementById("pFrom").value,
    to: document.getElementById("pTo").value
  };
  const q = document.getElementById("pSearch").value.trim().toLowerCase();

  let rows = MPDB.getPayments(filters);
  if (q) rows = rows.filter(p => (p.paymentId + " " + (p.reference || "")).toLowerCase().includes(q));

  const body = document.getElementById("paymentsBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11">${MPUI.emptyState("bi-receipt", "No payments match your filters.")}</td></tr>`;
  } else {
    body.innerHTML = rows.map(p => {
      const client = MPDB.getClient(p.clientId);
      const svc = MPDB.getService(p.serviceId);
      const owed = MPDB.paymentOutstanding(p);
      return `<tr>
        <td class="fw-semibold">${p.paymentId}</td>
        <td>${client ? `<a href="client-details.html?id=${client.clientId}" class="text-decoration-none">${client.businessName}</a>` : p.clientId}</td>
        <td>${MPDB.formatDate(p.paymentDate)}</td>
        <td class="text-muted-mp">${svc ? svc.type : "—"}</td>
        <td>${MPDB.formatCurrency(p.originalAmount, p.currency)}</td>
        <td class="text-muted-mp">${p.exchangeRate}</td>
        <td class="fw-semibold">${MPDB.formatBDT(p.bdtValue)}</td>
        <td>${owed > 0 ? `<span class="text-danger fw-semibold">${MPDB.formatCurrency(owed, p.currency)}</span>` : "—"}</td>
        <td>${p.method}</td>
        <td>${MPUI.badgeHtml(p.status)}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-mp-outline" title="Edit" onclick="openPaymentModal('${p.paymentId}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-mp-outline text-danger" title="Delete" onclick="onDeletePayment('${p.paymentId}')"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  document.getElementById("paymentsCount").textContent = `${rows.length} payment${rows.length === 1 ? "" : "s"}`;
  const total = rows.filter(p => p.status === "Paid").reduce((s, p) => s + p.bdtValue, 0);
  document.getElementById("paymentsTotal").textContent = "Total (paid): " + MPDB.formatBDT(total);
}

function onSubmitPayment(e) {
  e.preventDefault();
  const clientId = document.getElementById("p_client").value;
  const serviceId = document.getElementById("p_service").value;
  if (!clientId || !serviceId) { MPUI.toast("Select a client and service.", "danger"); return; }
  const amount = parseFloat(document.getElementById("p_amount").value);
  const rate = parseFloat(document.getElementById("p_rate").value);
  if (!(amount > 0)) { MPUI.toast("Amount must be greater than 0.", "danger"); return; }
  if (!(rate > 0)) { MPUI.toast("Exchange rate must be greater than 0.", "danger"); return; }

  const status = document.getElementById("p_status").value;
  const payload = {
    clientId, serviceId,
    paymentDate: document.getElementById("p_date").value,
    originalAmount: amount,
    exchangeRate: rate,
    method: document.getElementById("p_method").value,
    status,
    totalDue: status === "Partial" ? (parseFloat(document.getElementById("p_totalDue").value) || amount) : undefined,
    reference: document.getElementById("p_reference").value,
    notes: document.getElementById("p_notes").value
  };

  const editId = document.getElementById("p_paymentId").value;
  if (editId) {
    MPDB.updatePayment(editId, payload);
    MPUI.toast("Payment updated successfully.");
  } else {
    MPDB.addPayment(payload);
    MPUI.toast("Payment recorded successfully.");
  }
  bootstrap.Modal.getInstance(document.getElementById("paymentModal")).hide();
  renderPayments();
}

function onDeletePayment(id) {
  MPUI.confirmAction("Delete this payment record?", () => {
    MPDB.deletePayment(id);
    MPUI.toast("Payment deleted successfully.", "danger");
    renderPayments();
  });
}
