/* =========================================================
   clients.js — Clients list page
   ========================================================= */

let CL_PAGE = 1;
const CL_PAGE_SIZE = 8;

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      populateFilterOptions();

      const q = MPUI.qs("q");
      if (q) document.getElementById("clientSearch").value = q;

      ["clientSearch", "filterStatus", "filterType", "filterCountry"].forEach(id => {
        document.getElementById(id).addEventListener("input", () => { CL_PAGE = 1; renderClients(); });
        document.getElementById(id).addEventListener("change", () => { CL_PAGE = 1; renderClients(); });
      });

      document.getElementById("clientForm").addEventListener("submit", onSubmitClient);
      document.getElementById("addClientBtn").addEventListener("click", () => openClientModal(null));

      renderClients();
      window.addEventListener("mpdb:update", () => { populateFilterOptions(); renderClients(); });
    });
  });
});

function populateFilterOptions() {
  const clients = MPDB.getClients();
  const types = [...new Set(clients.map(c => c.businessType))].sort();
  const countries = [...new Set(clients.map(c => c.country))].sort();
  const typeSel = document.getElementById("filterType");
  const countrySel = document.getElementById("filterCountry");
  const prevType = typeSel.value, prevCountry = countrySel.value;
  typeSel.innerHTML = '<option value="all">All Business Types</option>';
  countrySel.innerHTML = '<option value="all">All Countries</option>';
  types.forEach(t => typeSel.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`));
  countries.forEach(c => countrySel.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`));
  if ([...typeSel.options].some(o => o.value === prevType)) typeSel.value = prevType;
  if ([...countrySel.options].some(o => o.value === prevCountry)) countrySel.value = prevCountry;
}

function filteredClients() {
  const q = document.getElementById("clientSearch").value.trim().toLowerCase();
  const status = document.getElementById("filterStatus").value;
  const type = document.getElementById("filterType").value;
  const country = document.getElementById("filterCountry").value;

  return MPDB.getClients().filter(c => {
    if (status !== "all" && c.status !== status) return false;
    if (type !== "all" && c.businessType !== type) return false;
    if (country !== "all" && c.country !== country) return false;
    if (q) {
      const hay = [c.clientId, c.fullName, c.businessName, c.phone, c.email, c.whatsapp, c.website, c.googleAdsId]
        .join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderClients() {
  const all = filteredClients();
  const totalPages = Math.max(1, Math.ceil(all.length / CL_PAGE_SIZE));
  CL_PAGE = Math.min(CL_PAGE, totalPages);
  const start = (CL_PAGE - 1) * CL_PAGE_SIZE;
  const rows = all.slice(start, start + CL_PAGE_SIZE);

  const body = document.getElementById("clientsBody");
  if (!all.length) {
    body.innerHTML = `<tr><td colspan="9">${MPUI.emptyState("bi-person-x", "No clients match your filters.")}</td></tr>`;
  } else {
    body.innerHTML = rows.map(c => {
      const stats = MPDB.clientStats(c.clientId);
      return `<tr>
        <td class="fw-semibold">${c.clientId}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="mp-avatar-sm">${MPUI.initials(c.businessName)}</div>
            <div>
              <div class="fw-semibold">${c.businessName}</div>
              <div class="text-muted-mp" style="font-size:11.5px;">${c.fullName}</div>
            </div>
          </div>
        </td>
        <td class="text-muted-mp">${c.businessType}</td>
        <td>${c.country}</td>
        <td>
          <div style="font-size:12.5px;">${c.phone}</div>
          <div class="text-muted-mp" style="font-size:11.5px;">${c.email}</div>
        </td>
        <td>${MPUI.badgeHtml(c.status)}</td>
        <td>${MPDB.formatDate(c.startDate)}</td>
        <td class="fw-semibold">${MPDB.formatBDT(stats.totalPaid)}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <a class="btn btn-mp-outline" href="client-details.html?id=${c.clientId}" title="View"><i class="bi bi-eye"></i></a>
            <button class="btn btn-mp-outline" title="Edit" onclick="openClientModal('${c.clientId}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-mp-outline text-danger" title="Delete" onclick="onDeleteClient('${c.clientId}')"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  document.getElementById("clientsCount").textContent = `Showing ${all.length ? start + 1 : 0}–${Math.min(start + CL_PAGE_SIZE, all.length)} of ${all.length} clients`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = document.getElementById("clientsPagination");
  if (totalPages <= 1) { el.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    html += `<li class="page-item ${i === CL_PAGE ? "active" : ""}"><a class="page-link" href="#" onclick="event.preventDefault(); CL_PAGE=${i}; renderClients();">${i}</a></li>`;
  }
  el.innerHTML = html;
}

function openClientModal(clientId) {
  const form = document.getElementById("clientForm");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("cf_clientId").value = "";
  document.getElementById("cf_status").value = "Lead";

  if (clientId) {
    const c = MPDB.getClient(clientId);
    document.getElementById("clientModalTitle").textContent = "Edit Client — " + c.businessName;
    document.getElementById("cf_clientId").value = c.clientId;
    document.getElementById("cf_fullName").value = c.fullName;
    document.getElementById("cf_businessName").value = c.businessName;
    document.getElementById("cf_businessType").value = c.businessType;
    document.getElementById("cf_country").value = c.country;
    document.getElementById("cf_phone").value = c.phone;
    document.getElementById("cf_email").value = c.email;
    document.getElementById("cf_whatsapp").value = c.whatsapp || "";
    document.getElementById("cf_website").value = c.website || "";
    document.getElementById("cf_facebook").value = c.facebook || "";
    document.getElementById("cf_instagram").value = c.instagram || "";
    document.getElementById("cf_linkedin").value = c.linkedin || "";
    document.getElementById("cf_other").value = c.other || "";
    document.getElementById("cf_googleAdsId").value = c.googleAdsId || "";
    document.getElementById("cf_metaAdsId").value = c.metaAdsId || "";
    document.getElementById("cf_gbpUrl").value = c.gbpUrl || "";
    document.getElementById("cf_startDate").value = c.startDate || "";
    document.getElementById("cf_endDate").value = c.endDate || "";
    document.getElementById("cf_status").value = c.status;
    document.getElementById("cf_notes").value = c.notes || "";
  } else {
    document.getElementById("clientModalTitle").textContent = "Add Client";
  }
  new bootstrap.Modal(document.getElementById("clientModal")).show();
}

function onSubmitClient(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) { form.classList.add("was-validated"); return; }

  const email = document.getElementById("cf_email").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    MPUI.toast("Enter a valid email address.", "danger"); return;
  }

  const id = document.getElementById("cf_clientId").value;
  const payload = {
    fullName: document.getElementById("cf_fullName").value.trim(),
    businessName: document.getElementById("cf_businessName").value.trim(),
    businessType: document.getElementById("cf_businessType").value,
    country: document.getElementById("cf_country").value.trim(),
    phone: document.getElementById("cf_phone").value.trim(),
    email: email.trim(),
    whatsapp: document.getElementById("cf_whatsapp").value.trim(),
    website: document.getElementById("cf_website").value.trim(),
    facebook: document.getElementById("cf_facebook").value.trim(),
    instagram: document.getElementById("cf_instagram").value.trim(),
    linkedin: document.getElementById("cf_linkedin").value.trim(),
    other: document.getElementById("cf_other").value.trim(),
    googleAdsId: document.getElementById("cf_googleAdsId").value.trim(),
    metaAdsId: document.getElementById("cf_metaAdsId").value.trim(),
    gbpUrl: document.getElementById("cf_gbpUrl").value.trim(),
    startDate: document.getElementById("cf_startDate").value,
    endDate: document.getElementById("cf_endDate").value,
    status: document.getElementById("cf_status").value,
    notes: document.getElementById("cf_notes").value.trim()
  };

  if (id) {
    MPDB.updateClient(id, payload);
    MPUI.toast("Client updated successfully.");
  } else {
    MPDB.addClient(payload);
    MPUI.toast("Client added successfully.");
  }
  bootstrap.Modal.getInstance(document.getElementById("clientModal")).hide();
  populateFilterOptions();
  renderClients();
}

function onDeleteClient(clientId) {
  const c = MPDB.getClient(clientId);
  MPUI.confirmAction(`Delete ${c.businessName}? This also removes their services and payment history.`, () => {
    MPDB.deleteClient(clientId);
    MPUI.toast("Client deleted successfully.", "danger");
    renderClients();
  });
}
