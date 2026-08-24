/* =========================================================
   components.js — shared shell (sidebar / topbar / toasts)
   Reads data-page / data-title / data-eyebrow off <body> and
   builds the sidebar + topbar once, on every page.
   ========================================================= */

const MPUI = (function () {
  const NAV = [
    { key: "dashboard", href: "index.html", icon: "bi-grid-1x2-fill", label: "Dashboard" },
    { key: "clients", href: "clients.html", icon: "bi-people-fill", label: "Clients" },
    { key: "services", href: "services.html", icon: "bi-kanban-fill", label: "Services / Projects" },
    { key: "payments", href: "payments.html", icon: "bi-credit-card-2-front-fill", label: "Payments" },
    { key: "revenue", href: "revenue.html", icon: "bi-graph-up-arrow", label: "Revenue" },
    { key: "currencies", href: "currencies.html", icon: "bi-currency-exchange", label: "Currencies" },
    { key: "reports", href: "reports.html", icon: "bi-file-earmark-bar-graph-fill", label: "Reports" },
    { key: "settings", href: "settings.html", icon: "bi-gear-fill", label: "Settings" }
  ];

  function badgeClass(status) {
    const map = {
      Active: "st-active", Paused: "st-paused", Completed: "st-completed", Lead: "st-lead", Inactive: "st-inactive",
      Paid: "st-paid", Pending: "st-pending", Unpaid: "st-unpaid", Partial: "st-partial", Cancelled: "st-cancelled"
    };
    return "mp-badge " + (map[status] || "st-inactive");
  }
  function badgeHtml(status) {
    return `<span class="${badgeClass(status)}">${status}</span>`;
  }
  function initials(name) {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }

  function sidebarHtml(activeKey) {
    const items = NAV.map(item => `
      <a href="${item.href}" class="nav-link ${item.key === activeKey ? "active" : ""}">
        <i class="bi ${item.icon}"></i><span>${item.label}</span>
      </a>`).join("");
    const settings = MPDB.getSettings();
    return `
      <div class="mp-sidebar-brand">
        <img src="${typeof MP_LOGO_BASE64 !== "undefined" ? MP_LOGO_BASE64 : ""}" class="mp-logo-mark" alt="${settings.agencyName} logo">
        <div>
          <div class="brand-name">${settings.agencyName}</div>
          <div class="brand-sub">Client &amp; Revenue Hub</div>
        </div>
      </div>
      <div class="mp-sidebar-divider"></div>
      <nav class="mp-nav">
        <div class="nav-section-label">Workspace</div>
        ${items}
      </nav>
      <div class="mp-sidebar-foot">
        <div class="d-flex align-items-center gap-2">
          <span class="mp-ring-dot"></span>
          <span>Signed in as <strong style="color:#e7ecfb">${settings.admin.name}</strong></span>
        </div>
      </div>`;
  }

  function topbarHtml(title, eyebrow) {
    return `
      <button class="btn mp-icon-btn mp-mobile-toggle" id="mpMobileToggle" type="button" aria-label="Open menu">
        <i class="bi bi-list fs-5"></i>
      </button>
      <div class="flex-grow-1">
        <div class="page-eyebrow">${eyebrow || "PPC Ads by Masud"}</div>
        <div class="page-title">${title || ""}</div>
      </div>
      <div class="mp-search-box d-none d-md-block">
        <i class="bi bi-search"></i>
        <input type="text" class="form-control" id="mpGlobalSearch" placeholder="Search clients, IDs, phone, email…">
      </div>
      <button class="btn mp-icon-btn" type="button" aria-label="Notifications">
        <i class="bi bi-bell"></i><span class="dot"></span>
      </button>
      <div class="mp-ring-avatar" role="button" title="${MPDB.getSettings().admin.name}">
        <span>${initials(MPDB.getSettings().admin.name)}</span>
      </div>`;
  }

  function mount() {
    const body = document.body;
    const page = body.getAttribute("data-page") || "";
    const title = body.getAttribute("data-title") || "";
    const eyebrow = body.getAttribute("data-eyebrow") || "";

    const sidebarEl = document.getElementById("mpSidebar");
    const topbarEl = document.getElementById("mpTopbar");
    if (sidebarEl) sidebarEl.innerHTML = sidebarHtml(page);
    if (topbarEl) topbarEl.innerHTML = topbarHtml(title, eyebrow);

    const toggle = document.getElementById("mpMobileToggle");
    const backdrop = document.getElementById("mpBackdrop");
    if (toggle && sidebarEl && backdrop) {
      toggle.addEventListener("click", () => {
        sidebarEl.classList.add("mp-sidebar-open");
        backdrop.classList.add("show");
      });
      backdrop.addEventListener("click", () => {
        sidebarEl.classList.remove("mp-sidebar-open");
        backdrop.classList.remove("show");
      });
    }

    const search = document.getElementById("mpGlobalSearch");
    if (search) {
      let t;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const q = search.value.trim();
          if (q.length >= 2) window.location.href = "clients.html?q=" + encodeURIComponent(q);
        }, 500);
      });
    }
  }

  /* ---------------- Toasts ---------------- */
  function toast(message, variant) {
    variant = variant || "success";
    const stack = document.getElementById("mpToastStack") || (function () {
      const d = document.createElement("div");
      d.className = "mp-toast-stack";
      d.id = "mpToastStack";
      document.body.appendChild(d);
      return d;
    })();
    const icon = variant === "success" ? "bi-check-circle-fill" : variant === "danger" ? "bi-x-circle-fill" : "bi-info-circle-fill";
    const bg = variant === "success" ? "text-bg-light border-success" : variant === "danger" ? "text-bg-light border-danger" : "text-bg-light border-primary";
    const el = document.createElement("div");
    el.className = `toast align-items-center border-start border-4 ${bg} show shadow-sm`;
    el.style.minWidth = "280px";
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icon} ${variant === "success" ? "text-success" : variant === "danger" ? "text-danger" : "text-primary"}"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add("fade"); el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3200);
  }

  /* ---------------- Confirm modal ---------------- */
  function confirmAction(message, onConfirm) {
    let modalEl = document.getElementById("mpConfirmModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade";
      modalEl.id = "mpConfirmModal";
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content" style="border-radius:16px; border:1px solid var(--mp-border);">
            <div class="modal-body p-4 text-center">
              <div class="mx-auto mb-3 d-flex align-items-center justify-content-center" style="width:52px;height:52px;border-radius:14px;background:rgba(234,67,53,.1);">
                <i class="bi bi-exclamation-triangle-fill text-danger fs-4"></i>
              </div>
              <p class="mb-4" id="mpConfirmText">Are you sure?</p>
              <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-mp-outline px-4" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-danger px-4" id="mpConfirmBtn">Delete</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }
    document.getElementById("mpConfirmText").textContent = message;
    const bsModal = new bootstrap.Modal(modalEl);
    const btn = document.getElementById("mpConfirmBtn");
    const handler = () => { onConfirm(); bsModal.hide(); btn.removeEventListener("click", handler); };
    btn.addEventListener("click", handler);
    bsModal.show();
  }

  function emptyState(icon, text) {
    return `<div class="mp-empty-state"><i class="bi ${icon}"></i>${text}</div>`;
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  document.addEventListener("DOMContentLoaded", mount);

  return { mount, toast, confirmAction, badgeHtml, badgeClass, initials, emptyState, qs };
})();
