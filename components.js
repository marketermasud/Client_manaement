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

  /* ---------------- Image compression (payment proofs) ----------------
     Downscales to at most maxDim on the longest side and re-encodes as
     JPEG, so a phone photo (often 3-8 MB) uploads in a fraction of the
     time and cost. Resolves with a Blob ready to hand to Storage. */
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject(new Error("Please choose an image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read that image."));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (blob) resolve(blob); else reject(new Error("Image compression failed."));
          }, "image/jpeg", quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- Full-size image viewer ---------------- */
  function showLightbox(url, caption) {
    let modalEl = document.getElementById("mpLightboxModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade";
      modalEl.id = "mpLightboxModal";
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content" style="border-radius:16px; background:#0e1b33; border:none;">
            <button type="button" class="btn-close btn-close-white position-absolute" style="top:12px; right:12px; z-index:2;" data-bs-dismiss="modal"></button>
            <div class="modal-body p-0 d-flex align-items-center justify-content-center" style="min-height:200px;">
              <img id="mpLightboxImg" src="" style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:12px;">
            </div>
            <div class="text-center text-white-50 small pb-3" id="mpLightboxCaption"></div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }
    document.getElementById("mpLightboxImg").src = url;
    document.getElementById("mpLightboxCaption").textContent = caption || "";
    new bootstrap.Modal(modalEl).show();
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* ---------------- Full-size image viewer (single or gallery) ---------------- */
  function showLightbox(url, caption) {
    showLightboxGallery([{ url, name: caption }], 0);
  }

  function showLightboxGallery(images, startIndex) {
    images = (images || []).filter(Boolean);
    if (!images.length) return;
    let idx = Math.min(Math.max(startIndex || 0, 0), images.length - 1);

    let modalEl = document.getElementById("mpLightboxModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade";
      modalEl.id = "mpLightboxModal";
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content" style="border-radius:16px; background:#0e1b33; border:none;">
            <button type="button" class="btn-close btn-close-white position-absolute" style="top:12px; right:12px; z-index:3;" data-bs-dismiss="modal"></button>
            <div class="modal-body p-0 d-flex align-items-center justify-content-center position-relative" style="min-height:200px;">
              <button type="button" class="btn mp-lightbox-nav" id="mpLightboxPrev" style="left:6px;"><i class="bi bi-chevron-left"></i></button>
              <img id="mpLightboxImg" src="" style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:12px;">
              <button type="button" class="btn mp-lightbox-nav" id="mpLightboxNext" style="right:6px;"><i class="bi bi-chevron-right"></i></button>
            </div>
            <div class="text-center text-white-50 small pb-3" id="mpLightboxCaption"></div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }

    function renderFrame() {
      document.getElementById("mpLightboxImg").src = images[idx].url;
      const showNav = images.length > 1;
      document.getElementById("mpLightboxPrev").style.display = showNav ? "flex" : "none";
      document.getElementById("mpLightboxNext").style.display = showNav ? "flex" : "none";
      const name = images[idx].name || "";
      document.getElementById("mpLightboxCaption").textContent = showNav ? `${name}  ·  ${idx + 1} / ${images.length}` : name;
    }
    document.getElementById("mpLightboxPrev").onclick = () => { idx = (idx - 1 + images.length) % images.length; renderFrame(); };
    document.getElementById("mpLightboxNext").onclick = () => { idx = (idx + 1) % images.length; renderFrame(); };
    renderFrame();
    new bootstrap.Modal(modalEl).show();
  }

  function openProofGalleryFromEl(el) {
    try {
      const proofs = JSON.parse(decodeURIComponent(el.getAttribute("data-proofs")));
      showLightboxGallery(proofs, 0);
    } catch (e) { console.error("Could not open proof gallery:", e); }
  }

  /* ---------------- Payment proof uploader (used on Payments + Client Details) ----------------
     Renders a self-contained widget into containerEl: pick (one or many) →
     compress → upload with per-file progress → thumbnail grid, with a
     remove button per image and a gallery lightbox on click.
     getContext() must return { clientId, paymentId } (or null if the form
     isn't ready yet, e.g. no client/service picked). */
  function createProofUploader(containerEl, getContext) {
    let proofs = [];                    // currently staged/visible: [{url, id, name}, ...]
    let uploading = {};                 // tempId -> percent, for in-flight uploads
    let freshlyUploadedIds = new Set(); // uploaded THIS session, not yet confirmed saved
    let pendingDeleteIds = new Set();   // removed from an EXISTING record this session — the
                                         // actual Drive file is only deleted once Save is
                                         // confirmed, so cancelling leaves the saved record intact

    function render() {
      if (!MPDB.isStorageActive()) {
        containerEl.innerHTML = `<div class="small text-muted-mp"><i class="bi bi-cloud-slash me-1"></i>Google Drive isn't connected — proof upload is unavailable (see Settings).</div>`;
        return;
      }
      const thumbs = proofs.map((p, i) => `
        <div class="mp-proof-preview">
          <img src="${p.url}" data-role="thumb" data-idx="${i}">
          <button type="button" class="mp-proof-remove" data-role="remove" data-idx="${i}" title="Remove"><i class="bi bi-x"></i></button>
        </div>`).join("");
      const uploadingTiles = Object.keys(uploading).map(id => `
        <div class="mp-proof-uploading">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <div class="mp-upload-progress mt-1"><span style="width:${uploading[id]}%"></span></div>
        </div>`).join("");
      containerEl.innerHTML = `
        <label class="form-label mb-1">Payment Proof <span class="text-muted-mp fw-normal">(optional — attach one or more images)</span></label>
        <div class="d-flex flex-wrap gap-2 align-items-start">
          ${thumbs}${uploadingTiles}
          <div class="mp-proof-add-tile" data-role="add" title="Add image(s)"><i class="bi bi-plus-lg"></i></div>
        </div>
        <input type="file" accept="image/*" multiple class="d-none" data-role="input">`;
      containerEl.querySelector('[data-role="add"]').addEventListener("click", () => containerEl.querySelector('[data-role="input"]').click());
      containerEl.querySelector('[data-role="input"]').addEventListener("change", onFilesChosen);
      containerEl.querySelectorAll('[data-role="thumb"]').forEach(img => {
        img.addEventListener("click", () => showLightboxGallery(proofs, parseInt(img.getAttribute("data-idx"), 10)));
      });
      containerEl.querySelectorAll('[data-role="remove"]').forEach(btn => {
        btn.addEventListener("click", () => onRemove(parseInt(btn.getAttribute("data-idx"), 10)));
      });
    }

    function onFilesChosen(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (!files.length) return;
      const ctx = getContext();
      if (!ctx || !ctx.clientId || !ctx.paymentId) { toast("Pick a client and service first.", "danger"); return; }
      files.forEach(file => uploadOne(file, ctx));
    }

    function uploadOne(file, ctx) {
      if (file.size > 15 * 1024 * 1024) { toast(`"${file.name}" is too large (max 15MB).`, "danger"); return; }
      const tmpId = "tmp" + Math.random().toString(36).slice(2);
      uploading[tmpId] = 0;
      render();
      MPUI.compressImage(file, 1600, 0.82).then(blob => {
        return MPDB.uploadPaymentProof(ctx.clientId, ctx.paymentId, blob, file.name, pct => { uploading[tmpId] = pct; render(); });
      }).then(proof => {
        delete uploading[tmpId];
        proofs.push(proof);
        freshlyUploadedIds.add(proof.id);
        render();
      }).catch(err => {
        delete uploading[tmpId];
        console.error("Proof upload failed:", err);
        toast(err.message || `Couldn't upload "${file.name}".`, "danger");
        render();
      });
    }

    function onRemove(idx) {
      const proof = proofs[idx];
      if (!proof) return;
      confirmAction("Remove this proof image?", () => {
        proofs = proofs.filter((_, i) => i !== idx);
        if (freshlyUploadedIds.has(proof.id)) {
          // Uploaded THIS session and never saved anywhere — nothing references
          // it yet, so it's safe to delete right away.
          freshlyUploadedIds.delete(proof.id);
          MPDB.deleteStorageFile(proof.id);
        } else {
          // Belongs to the saved record — stage the deletion. It only actually
          // happens once the form is submitted (markSaved()); cancelling
          // (discardIfUnsaved()) leaves the file and the saved record untouched.
          pendingDeleteIds.add(proof.id);
        }
        render();
      });
    }

    render();

    return {
      getProofs: () => proofs.slice(),
      setProofs: list => { proofs = (list || []).slice(); freshlyUploadedIds = new Set(); pendingDeleteIds = new Set(); render(); },
      markSaved: () => {
        pendingDeleteIds.forEach(id => MPDB.deleteStorageFile(id));
        pendingDeleteIds = new Set();
        freshlyUploadedIds = new Set();
      },
      discardIfUnsaved: () => {
        if (freshlyUploadedIds.size) {
          const toDelete = Array.from(freshlyUploadedIds);
          proofs = proofs.filter(p => !freshlyUploadedIds.has(p.id));
          toDelete.forEach(id => MPDB.deleteStorageFile(id));
        }
        freshlyUploadedIds = new Set();
        pendingDeleteIds = new Set(); // staged removals never happened — nothing to undo
      }
    };
  }

  function proofThumbHtml(payment) {
    const proofs = (payment && payment.proofs) || [];
    if (!proofs.length) return `<span class="mp-proof-badge-none">—</span>`;
    const encoded = encodeURIComponent(JSON.stringify(proofs));
    const countBadge = proofs.length > 1 ? `<span class="mp-proof-count-badge">+${proofs.length - 1}</span>` : "";
    return `<span class="mp-proof-thumb-wrap">
      <img src="${proofs[0].url}" class="mp-proof-thumb-sm" data-proofs="${encoded}" onclick="MPUI.openProofGalleryFromEl(this)" title="View ${proofs.length} proof photo${proofs.length > 1 ? "s" : ""}">
      ${countBadge}
    </span>`;
  }

  document.addEventListener("DOMContentLoaded", mount);

  return { mount, toast, confirmAction, badgeHtml, badgeClass, initials, emptyState, qs, compressImage, showLightbox, showLightboxGallery, openProofGalleryFromEl, createProofUploader, proofThumbHtml };
})();
