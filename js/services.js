/* =========================================================
   services.js — Services / Projects page
   ========================================================= */

const SERVICE_TYPES = ["Monthly","One Time","Setup","Audit","Optimization","Consultation","Tracking","Google Ads Management","Meta Ads Management","Shopify","Analytics","Other"];

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      populateOptions();
      ["svcSearch", "svcFilterClient", "svcFilterType", "svcFilterStatus"].forEach(id => {
        document.getElementById(id).addEventListener("input", renderServices);
        document.getElementById(id).addEventListener("change", renderServices);
      });
      document.getElementById("serviceForm").addEventListener("submit", onSubmitService);
      document.getElementById("s_amount").addEventListener("input", updateBdtPreview);
      document.getElementById("s_currency").addEventListener("change", updateBdtPreview);
      document.getElementById("serviceModal").addEventListener("hidden.bs.modal", resetServiceForm);
      document.getElementById("addServiceBtn").addEventListener("click", () => openServiceModal(null));

      renderServices();
      window.addEventListener("mpdb:update", renderServices);
    });
  });
});

function populateOptions() {
  const clients = MPDB.getClients();
  const clientSel = document.getElementById("svcFilterClient");
  const formClientSel = document.getElementById("s_client");
  clients.forEach(c => {
    clientSel.insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName}</option>`);
    formClientSel.insertAdjacentHTML("beforeend", `<option value="${c.clientId}">${c.businessName} (${c.clientId})</option>`);
  });

  const typeSel = document.getElementById("svcFilterType");
  const formTypeSel = document.getElementById("s_type");
  SERVICE_TYPES.forEach(t => {
    typeSel.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`);
    formTypeSel.insertAdjacentHTML("beforeend", `<option>${t}</option>`);
  });

  const currSel = document.getElementById("s_currency");
  MPDB.getCurrencies().forEach(cur => currSel.insertAdjacentHTML("beforeend", `<option value="${cur.code}" data-rate="${cur.rate}">${cur.code} — ${cur.name}</option>`));
}

function updateBdtPreview() {
  const amt = parseFloat(document.getElementById("s_amount").value) || 0;
  const sel = document.getElementById("s_currency");
  const opt = sel.selectedOptions[0];
  const rate = opt ? parseFloat(opt.getAttribute("data-rate")) || 0 : 0;
  const code = sel.value;
  const bdt = code === "BDT" ? amt : amt * rate;
  document.getElementById("s_bdtPreview").textContent = `≈ ${MPDB.formatBDT(bdt)} — reference only, not counted in revenue. Actual revenue is tracked from the Payments page.`;
}

function renderServices() {
  const q = document.getElementById("svcSearch").value.trim().toLowerCase();
  const client = document.getElementById("svcFilterClient").value;
  const type = document.getElementById("svcFilterType").value;
  const status = document.getElementById("svcFilterStatus").value;

  let rows = MPDB.getServices().filter(s => {
    if (client !== "all" && s.clientId !== client) return false;
    if (type !== "all" && s.type !== type) return false;
    if (status !== "all" && s.status !== status) return false;
    if (q) {
      const c = MPDB.getClient(s.clientId);
      const hay = (s.description + " " + (c ? c.businessName : "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

  const body = document.getElementById("servicesBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="9">${MPUI.emptyState("bi-kanban", "No services match your filters.")}</td></tr>`; return; }

  body.innerHTML = rows.map(s => {
    const c = MPDB.getClient(s.clientId);
    return `<tr>
      <td class="fw-semibold">${s.serviceId}</td>
      <td>${c ? `<a href="client-details.html?id=${c.clientId}" class="text-decoration-none">${c.businessName}</a>` : s.clientId}</td>
      <td>${s.type}</td>
      <td class="text-muted-mp">${s.description || "—"}</td>
      <td>${MPDB.formatDate(s.startDate)}</td>
      <td>${s.endDate ? MPDB.formatDate(s.endDate) : "Ongoing"}</td>
      <td>${MPDB.formatCurrency(s.amount, s.currency)}</td>
      <td>${MPUI.badgeHtml(s.status)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-mp-outline" title="Edit" onclick="openServiceModal('${s.serviceId}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-mp-outline text-danger" title="Delete" onclick="onDeleteService('${s.serviceId}')"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function resetServiceForm() {
  document.getElementById("serviceForm").reset();
  document.getElementById("s_serviceId").value = "";
  document.getElementById("serviceModalTitle").textContent = "Add Service";
  document.getElementById("s_saveBtn").textContent = "Save Service";
  updateBdtPreview();
}

function openServiceModal(serviceId) {
  resetServiceForm();
  if (serviceId) {
    const s = MPDB.getService(serviceId);
    document.getElementById("serviceModalTitle").textContent = "Edit Service — " + s.serviceId;
    document.getElementById("s_saveBtn").textContent = "Save Changes";
    document.getElementById("s_serviceId").value = s.serviceId;
    document.getElementById("s_client").value = s.clientId;
    document.getElementById("s_type").value = s.type;
    document.getElementById("s_description").value = s.description || "";
    document.getElementById("s_startDate").value = s.startDate || "";
    document.getElementById("s_endDate").value = s.endDate || "";
    document.getElementById("s_amount").value = s.amount;
    document.getElementById("s_currency").value = s.currency;
    document.getElementById("s_status").value = s.status;
    updateBdtPreview();
  }
  new bootstrap.Modal(document.getElementById("serviceModal")).show();
}

function onSubmitService(e) {
  e.preventDefault();
  const clientId = document.getElementById("s_client").value;
  if (!clientId) { MPUI.toast("Select a client.", "danger"); return; }
  const amount = parseFloat(document.getElementById("s_amount").value);
  if (!(amount >= 0)) { MPUI.toast("Amount must be 0 or greater.", "danger"); return; }

  const editId = document.getElementById("s_serviceId").value;
  const payload = {
    clientId,
    type: document.getElementById("s_type").value,
    description: document.getElementById("s_description").value,
    startDate: document.getElementById("s_startDate").value,
    endDate: document.getElementById("s_endDate").value,
    amount,
    currency: document.getElementById("s_currency").value,
    status: document.getElementById("s_status").value
  };

  if (editId) {
    MPDB.updateService(editId, payload);
    MPUI.toast("Service updated successfully.");
  } else {
    MPDB.addService(Object.assign({ notes: "" }, payload));
    MPUI.toast("Service added successfully.");
  }
  bootstrap.Modal.getInstance(document.getElementById("serviceModal")).hide();
  renderServices();
}

function onDeleteService(id) {
  MPUI.confirmAction("Delete this service? Related payments will also be removed.", () => {
    MPDB.deleteService(id);
    MPUI.toast("Service deleted successfully.", "danger");
    renderServices();
  });
}
