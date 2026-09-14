/* =========================================================
   currencies.js — Currency Management page
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  MPAuth.ready(function () {
    MPDB.init(function () {
      document.getElementById("currencyForm").addEventListener("submit", onSubmitCurrency);
      document.getElementById("currencySearch").addEventListener("input", renderCurrencies);
      renderCurrencies();
      window.addEventListener("mpdb:update", renderCurrencies);
    });
  });
});

function renderCurrencies() {
  const q = document.getElementById("currencySearch").value.trim().toLowerCase();
  let rows = MPDB.getCurrencies();
  if (q) rows = rows.filter(c => (c.code + " " + c.name).toLowerCase().includes(q));
  rows = rows.slice().sort((a, b) => (a.isBase ? -1 : 0) - (b.isBase ? -1 : 0) || a.code.localeCompare(b.code));

  document.getElementById("currencyCount").textContent = `(${rows.length} of ${MPDB.getCurrencies().length})`;

  const body = document.getElementById("currenciesBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="7">${MPUI.emptyState("bi-currency-exchange", "No currencies match your search.")}</td></tr>`; return; }

  body.innerHTML = rows.map(c => `
    <tr>
      <td><span class="mp-currency-pill">${c.code}</span></td>
      <td class="fw-semibold">${c.name}</td>
      <td>${c.symbol}</td>
      <td>${c.isBase ? "Base currency" : "1 " + c.code + " = " + c.rate.toLocaleString() + " BDT"}</td>
      <td class="text-muted-mp">${MPDB.formatDate(c.lastUpdated)}</td>
      <td>${MPUI.badgeHtml(c.status === "Active" ? "Active" : "Inactive")}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-mp-outline" onclick="openCurrencyModal('${c.code}')" title="Edit"><i class="bi bi-pencil"></i></button>
          ${!c.isBase ? `<button class="btn btn-mp-outline" onclick="toggleCurrencyStatus('${c.code}')" title="${c.status === 'Active' ? 'Disable' : 'Enable'}"><i class="bi ${c.status === 'Active' ? 'bi-toggle-on' : 'bi-toggle-off'}"></i></button>
          <button class="btn btn-mp-outline text-danger" onclick="onDeleteCurrency('${c.code}')" title="Delete"><i class="bi bi-trash"></i></button>` : ""}
        </div>
      </td>
    </tr>`).join("");
}

function openCurrencyModal(code) {
  const form = document.getElementById("currencyForm");
  form.reset();
  document.getElementById("cu_editCode").value = "";
  document.getElementById("cu_code").disabled = false;

  if (code) {
    const c = MPDB.getCurrency(code);
    document.getElementById("currencyModalTitle").textContent = "Edit Currency — " + c.code;
    document.getElementById("cu_editCode").value = c.code;
    document.getElementById("cu_code").value = c.code;
    document.getElementById("cu_code").disabled = true;
    document.getElementById("cu_symbol").value = c.symbol;
    document.getElementById("cu_name").value = c.name;
    document.getElementById("cu_rate").value = c.rate;
    document.getElementById("cu_status").value = c.status;
  } else {
    document.getElementById("currencyModalTitle").textContent = "Add Currency";
    document.getElementById("cu_rate").value = "";
  }
  new bootstrap.Modal(document.getElementById("currencyModal")).show();
}

function onSubmitCurrency(e) {
  e.preventDefault();
  const editCode = document.getElementById("cu_editCode").value;
  const code = document.getElementById("cu_code").value.toUpperCase().trim();
  const rate = parseFloat(document.getElementById("cu_rate").value);
  if (!(rate > 0)) { MPUI.toast("Exchange rate must be greater than 0.", "danger"); return; }

  if (editCode) {
    MPDB.updateCurrency(editCode, {
      symbol: document.getElementById("cu_symbol").value,
      name: document.getElementById("cu_name").value,
      rate,
      status: document.getElementById("cu_status").value
    });
    MPUI.toast("Currency updated successfully.");
  } else {
    if (!code) { MPUI.toast("Enter a currency code.", "danger"); return; }
    if (MPDB.getCurrency(code)) { MPUI.toast("This currency code already exists.", "danger"); return; }
    MPDB.addCurrency({
      code, symbol: document.getElementById("cu_symbol").value, name: document.getElementById("cu_name").value,
      rate, status: document.getElementById("cu_status").value
    });
    MPUI.toast("Currency added successfully.");
  }
  bootstrap.Modal.getInstance(document.getElementById("currencyModal")).hide();
  renderCurrencies();
}

function toggleCurrencyStatus(code) {
  const c = MPDB.getCurrency(code);
  MPDB.updateCurrency(code, { status: c.status === "Active" ? "Disabled" : "Active" });
  MPUI.toast(`Currency ${c.status === "Active" ? "enabled" : "disabled"} successfully.`);
  renderCurrencies();
}

function onDeleteCurrency(code) {
  MPUI.confirmAction(`Delete ${code}? Past payments made in this currency keep their stored exchange rate.`, () => {
    MPDB.deleteCurrency(code);
    MPUI.toast("Currency deleted successfully.", "danger");
    renderCurrencies();
  });
}
