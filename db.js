/* =========================================================
   db.js — Data layer
   ---------------------------------------------------------
   Two backends behind one identical API:
     - Local mode  : localStorage (works with no setup, used when
                      MP_USE_FIREBASE is false)
     - Firebase mode: live Firestore, real-time synced across
                      devices (used when MP_USE_FIREBASE is true
                      and firebase-config.js has real credentials)

   Every page follows the same pattern:
     MPAuth.ready(function () {
       MPDB.init(function () {
         render();
         window.addEventListener('mpdb:update', render);
       });
     });

   MPDB.init() loads the data (instantly from localStorage, or via
   Firestore's first snapshot) and calls back once ready. After that,
   any change — from this tab or, in Firebase mode, from any other
   device — fires a 'mpdb:update' event on window so open pages stay
   live without a manual refresh.
   ========================================================= */

const MPDB = (function () {
  const STORAGE_KEY = "mp_db_v2";
  const COLLECTIONS = ["clients", "services", "payments", "currencies", "activities"];

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  function pad(n, len) {
    return String(n).padStart(len, "0");
  }
  function isFirebaseActive() {
    return typeof MP_USE_FIREBASE !== "undefined" && MP_USE_FIREBASE && typeof mpFirestore !== "undefined" && !!mpFirestore;
  }
  function isStorageActive() {
    return typeof MPDrive !== "undefined" && MPDrive.isConfigured();
  }
  function notifyChange() {
    try { window.dispatchEvent(new CustomEvent("mpdb:update")); } catch (e) { /* non-browser context */ }
  }

  /* ---------------- Empty starting state ---------------- */
  function emptyData() {
    // Full world currency list lives in currencies-data.js (WORLD_CURRENCIES),
    // loaded before this file. Clone it so nothing here mutates the master list.
    const currencies = (typeof WORLD_CURRENCIES !== "undefined" ? WORLD_CURRENCIES : [
      { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", rate: 1, lastUpdated: "2026-08-20", status: "Active", isBase: true },
      { code: "USD", name: "US Dollar", symbol: "$", rate: 121.8, lastUpdated: "2026-08-20", status: "Active" }
    ]).map(c => Object.assign({}, c));

    return {
      clients: [],
      services: [],
      payments: [],
      currencies,
      activities: [],
      settings: {
        agencyName: "PPC Ads by Masud",
        ownerName: "Md. Masud Rana",
        email: "masud.ppcconsultant@gmail.com",
        baseCurrency: "BDT",
        admin: { email: "admin@masudppc.com", name: "Masud Rana", role: "Admin" }
      }
    };
  }

  let DATA = emptyData();

  /* ---------------- Local (localStorage) backend ---------------- */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { DATA = JSON.parse(raw); return; }
    } catch (e) { /* corrupt/blocked storage — fall through to a fresh start */ }
    DATA = emptyData();
    saveLocal();
  }
  function saveLocal() { localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); }
  function persistLocal() { saveLocal(); notifyChange(); }

  /* ---------------- Firestore backend ---------------- */
  let unsubscribers = [];
  let readySet = new Set();
  let readyCallback = null;

  function checkAllReady() {
    const need = COLLECTIONS.concat(["settings"]);
    if (readyCallback && need.every(c => readySet.has(c))) {
      const cb = readyCallback; readyCallback = null; cb();
    }
  }

  function attachFirestoreListeners(onReady) {
    readySet = new Set();
    readyCallback = onReady;
    unsubscribers.forEach(u => { try { u(); } catch (e) {} });
    unsubscribers = [];

    COLLECTIONS.forEach(col => {
      const unsub = mpFirestore.collection(col).onSnapshot(
        snap => {
          DATA[col] = snap.docs.map(d => d.data());
          readySet.add(col);
          checkAllReady();
          notifyChange();
        },
        err => console.error("Firestore listener error on '" + col + "':", err)
      );
      unsubscribers.push(unsub);
    });

    // Currencies: seed the full world list into Firestore on first run only.
    mpFirestore.collection("currencies").limit(1).get().then(snap => {
      if (snap.empty && typeof WORLD_CURRENCIES !== "undefined") {
        const batch = mpFirestore.batch();
        WORLD_CURRENCIES.forEach(c => batch.set(mpFirestore.collection("currencies").doc(c.code), c));
        return batch.commit();
      }
    }).catch(err => console.error("Currency seed failed:", err));

    // Settings is a single document.
    const unsubSettings = mpFirestore.collection("settings").doc("agency").onSnapshot(
      snap => {
        if (snap.exists) {
          DATA.settings = snap.data();
        } else {
          const defaults = emptyData().settings;
          mpFirestore.collection("settings").doc("agency").set(defaults).catch(err => console.error("Settings seed failed:", err));
          DATA.settings = defaults;
        }
        readySet.add("settings");
        checkAllReady();
        notifyChange();
      },
      err => console.error("Firestore listener error on 'settings':", err)
    );
    unsubscribers.push(unsubSettings);
  }

  function init(onReady) {
    if (isFirebaseActive()) {
      attachFirestoreListeners(onReady);
    } else {
      loadLocal();
      if (onReady) onReady();
    }
  }

  /* ---------------- Formatting helpers ---------------- */
  function formatBDT(amount) {
    const n = Math.round(amount || 0);
    const neg = n < 0;
    const s = Math.abs(n).toString();
    let last3 = s.slice(-3);
    let other = s.slice(0, -3);
    if (other !== "") last3 = "," + last3;
    other = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return (neg ? "-" : "") + "৳" + other + last3;
  }
  function formatCurrency(amount, code) {
    const cur = DATA.currencies.find(c => c.code === code);
    const symbol = cur ? cur.symbol : code + " ";
    if (code === "BDT") return formatBDT(amount);
    return symbol + Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  }
  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return formatDate(dateStr);
  }

  /* ---------------- Payment proof images (Firebase Storage) ---------------- */
  // Uploads a (already-compressed) image blob into a client/payment-scoped
  // folder on Google Drive, reports progress 0-100 via onProgress, and
  // resolves with { id, url, viewLink, name } to store on the payment record.
  function uploadPaymentProof(clientId, paymentId, blob, fileName, onProgress) {
    if (!isStorageActive()) return Promise.reject(new Error("Google Drive isn't connected yet — see Settings."));
    const client = getClient(clientId);
    const clientLabel = client ? `${client.businessName} (${clientId})` : clientId;
    return MPDrive.uploadProof(clientLabel, paymentId, blob, fileName, onProgress);
  }
  // Best-effort cleanup — never blocks the caller if it fails (file may
  // already be gone, or Drive access was revoked).
  function deleteStorageFile(fileId) {
    if (!isStorageActive() || !fileId) return Promise.resolve();
    return MPDrive.deleteProof(fileId);
  }
  function deleteProofFiles(proofs) {
    (proofs || []).forEach(pr => { if (pr && pr.id) deleteStorageFile(pr.id); });
  }

  /* ---------------- Clients ---------------- */
  function getClients() { return DATA.clients.slice(); }
  function getClient(id) { return DATA.clients.find(c => c.clientId === id) || null; }
  function nextClientId() {
    const nums = DATA.clients.map(c => parseInt(c.clientId.split("-")[1], 10)).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return "CL-" + pad(next, 3);
  }
  function addClient(client) {
    client.clientId = client.clientId || nextClientId();
    client.createdAt = new Date().toISOString();
    client.updatedAt = client.createdAt;
    if (isFirebaseActive()) {
      mpFirestore.collection("clients").doc(client.clientId).set(client)
        .then(() => logActivity(client.clientId, "created", "Client profile created"))
        .catch(err => console.error("addClient failed:", err));
    } else {
      DATA.clients.push(client);
      logActivity(client.clientId, "created", "Client profile created");
      persistLocal();
    }
    return client;
  }
  function updateClient(id, patch) {
    const merged = Object.assign({}, patch, { updatedAt: new Date().toISOString() });
    if (isFirebaseActive()) {
      mpFirestore.collection("clients").doc(id).update(merged)
        .then(() => logActivity(id, "updated", "Client profile updated"))
        .catch(err => console.error("updateClient failed:", err));
      return getClient(id);
    }
    const c = getClient(id);
    if (!c) return null;
    Object.assign(c, merged);
    logActivity(id, "updated", "Client profile updated");
    persistLocal();
    return c;
  }
  function deleteClient(id) {
    const relatedPayments = getPayments({ clientId: id });
    relatedPayments.forEach(p => deleteProofFiles(p.proofs));
    if (isFirebaseActive()) {
      const batch = mpFirestore.batch();
      batch.delete(mpFirestore.collection("clients").doc(id));
      getServices(id).forEach(s => batch.delete(mpFirestore.collection("services").doc(s.serviceId)));
      getPayments({ clientId: id }).forEach(p => batch.delete(mpFirestore.collection("payments").doc(p.paymentId)));
      batch.commit().catch(err => console.error("deleteClient failed:", err));
    } else {
      DATA.clients = DATA.clients.filter(c => c.clientId !== id);
      DATA.services = DATA.services.filter(s => s.clientId !== id);
      DATA.payments = DATA.payments.filter(p => p.clientId !== id);
      persistLocal();
    }
  }

  /* ---------------- Services ---------------- */
  function getServices(clientId) {
    return DATA.services.filter(s => !clientId || s.clientId === clientId).slice();
  }
  function getService(id) { return DATA.services.find(s => s.serviceId === id) || null; }
  function nextServiceId() {
    const nums = DATA.services.map(s => parseInt(s.serviceId.split("-")[1], 10)).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return "SV-" + pad(next, 3);
  }
  function addService(service) {
    service.serviceId = service.serviceId || nextServiceId();
    if (isFirebaseActive()) {
      mpFirestore.collection("services").doc(service.serviceId).set(service)
        .then(() => logActivity(service.clientId, "service", `Service ${service.serviceId} (${service.type}) added`))
        .catch(err => console.error("addService failed:", err));
    } else {
      DATA.services.push(service);
      logActivity(service.clientId, "service", `Service ${service.serviceId} (${service.type}) added`);
      persistLocal();
    }
    return service;
  }
  function updateService(id, patch) {
    if (isFirebaseActive()) {
      mpFirestore.collection("services").doc(id).update(patch)
        .then(() => { const s = getService(id); if (s) logActivity(s.clientId, "service", `Service ${id} updated`); })
        .catch(err => console.error("updateService failed:", err));
      return getService(id);
    }
    const s = getService(id);
    if (!s) return null;
    Object.assign(s, patch);
    logActivity(s.clientId, "service", `Service ${id} updated`);
    persistLocal();
    return s;
  }
  function deleteService(id) {
    const s = getService(id);
    getPayments({ serviceId: id }).forEach(p => deleteProofFiles(p.proofs));
    if (isFirebaseActive()) {
      const batch = mpFirestore.batch();
      batch.delete(mpFirestore.collection("services").doc(id));
      getPayments({ serviceId: id }).forEach(p => batch.delete(mpFirestore.collection("payments").doc(p.paymentId)));
      batch.commit()
        .then(() => { if (s) logActivity(s.clientId, "service", `Service ${id} deleted`); })
        .catch(err => console.error("deleteService failed:", err));
    } else {
      DATA.services = DATA.services.filter(x => x.serviceId !== id);
      DATA.payments = DATA.payments.filter(p => p.serviceId !== id);
      if (s) logActivity(s.clientId, "service", `Service ${id} deleted`);
      persistLocal();
    }
  }

  /* ---------------- Payments ---------------- */
  function getPayments(filters) {
    filters = filters || {};
    return DATA.payments.filter(p => {
      if (filters.clientId && p.clientId !== filters.clientId) return false;
      if (filters.serviceId && filters.serviceId !== "all" && p.serviceId !== filters.serviceId) return false;
      if (filters.currency && filters.currency !== "all" && p.currency !== filters.currency) return false;
      if (filters.method && filters.method !== "all" && p.method !== filters.method) return false;
      if (filters.status && filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.from && p.paymentDate < filters.from) return false;
      if (filters.to && p.paymentDate > filters.to) return false;
      return true;
    }).slice().sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }
  function getPayment(id) { return DATA.payments.find(p => p.paymentId === id) || null; }
  function nextPaymentId() {
    const nums = DATA.payments.map(p => parseInt(p.paymentId.split("-")[1], 10)).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 1000) + 1;
    return "PMT-" + next;
  }

  // Currency always follows the linked service; status drives totalDue/remainingAmount.
  function recomputePaymentDerived(p) {
    if (!p.currency) {
      const svc = getService(p.serviceId);
      p.currency = svc ? svc.currency : "BDT";
    }
    p.exchangeRate = p.currency === "BDT" ? 1 : Number(p.exchangeRate) || 0;
    p.bdtValue = Number(p.originalAmount || 0) * Number(p.exchangeRate || (p.currency === "BDT" ? 1 : 0));

    if (p.status === "Partial") {
      p.totalDue = Number(p.totalDue || 0);
      p.remainingAmount = Math.max(0, p.totalDue - Number(p.originalAmount || 0));
    } else if (p.status === "Paid") {
      p.totalDue = Number(p.originalAmount || 0);
      p.remainingAmount = 0;
    } else {
      p.totalDue = Number(p.originalAmount || 0);
      p.remainingAmount = Number(p.originalAmount || 0);
    }
    return p;
  }

  function addPayment(payment) {
    payment.paymentId = payment.paymentId || nextPaymentId();
    recomputePaymentDerived(payment);
    if (isFirebaseActive()) {
      mpFirestore.collection("payments").doc(payment.paymentId).set(payment)
        .then(() => logActivity(payment.clientId, "payment", `Payment ${payment.paymentId} recorded (${payment.currency} ${payment.originalAmount})`))
        .catch(err => console.error("addPayment failed:", err));
    } else {
      DATA.payments.push(payment);
      logActivity(payment.clientId, "payment", `Payment ${payment.paymentId} recorded (${payment.currency} ${payment.originalAmount})`);
      persistLocal();
    }
    return payment;
  }
  function updatePayment(id, patch) {
    if (isFirebaseActive()) {
      const merged = recomputePaymentDerived(Object.assign({}, getPayment(id), patch));
      mpFirestore.collection("payments").doc(id).set(merged)
        .then(() => logActivity(merged.clientId, "payment", `Payment ${id} updated`))
        .catch(err => console.error("updatePayment failed:", err));
      return merged;
    }
    const p = getPayment(id);
    if (!p) return null;
    Object.assign(p, patch);
    recomputePaymentDerived(p);
    logActivity(p.clientId, "payment", `Payment ${id} updated`);
    persistLocal();
    return p;
  }
  function deletePayment(id) {
    const p = getPayment(id);
    if (p) deleteProofFiles(p.proofs);
    if (isFirebaseActive()) {
      mpFirestore.collection("payments").doc(id).delete()
        .then(() => { if (p) logActivity(p.clientId, "payment", `Payment ${id} deleted`); })
        .catch(err => console.error("deletePayment failed:", err));
    } else {
      DATA.payments = DATA.payments.filter(x => x.paymentId !== id);
      if (p) logActivity(p.clientId, "payment", `Payment ${id} deleted`);
      persistLocal();
    }
  }

  // Every payment that still has money owed on it (Pending, Unpaid, or Partial)
  function pendingPayments() {
    return DATA.payments.filter(p => p.status !== "Paid").slice().sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }
  // What a single payment record's own line still shows as unresolved — used
  // for the per-row "Outstanding" column in payment history tables.
  function paymentOutstanding(p) {
    if (p.status === "Paid") return 0;
    if (p.status === "Partial") return Number(p.remainingAmount || 0);
    return Number(p.originalAmount || 0);
  }

  // The service-level balance still owed, netting ALL of that service's
  // payments against each other — not just the latest one. This matters
  // because a partial balance is often settled with a brand-new payment
  // record (its own date/reference/method) rather than by editing the
  // original entry, so a naive per-row sum would double-count what's left.
  //   dealTotal     = the agreed total for the service (the highest totalDue
  //                   ever recorded against it, or the service's own Deal
  //                   Amount if no payment has set one)
  //   totalReceived = everything actually received so far (Paid + Partial
  //                   payments only — Pending/Unpaid haven't arrived yet)
  function serviceOutstanding(serviceId) {
    const svc = getService(serviceId);
    if (!svc) return 0;
    const pays = getPayments({ serviceId });
    if (!pays.length) return 0; // nothing invoiced yet — nothing to track
    const dealTotal = pays.reduce((max, p) => Math.max(max, Number(p.totalDue || 0)), Number(svc.amount || 0));
    const totalReceived = pays.filter(p => p.status === "Paid" || p.status === "Partial")
      .reduce((s, p) => s + Number(p.originalAmount || 0), 0);
    return Math.max(0, dealTotal - totalReceived);
  }
  // Same balance converted to BDT, using the most recent payment's own
  // exchange rate as the best available reference (or today's currency-table
  // rate if the service has no payments yet).
  function serviceOutstandingBDT(serviceId) {
    const owed = serviceOutstanding(serviceId);
    if (owed <= 0) return 0;
    const svc = getService(serviceId);
    const pays = getPayments({ serviceId });
    const rate = pays.length ? Number(pays[0].exchangeRate || 1) : (getCurrency(svc.currency) ? getCurrency(svc.currency).rate : 1);
    return owed * rate;
  }
  function clientOutstanding(clientId) {
    const byCode = {};
    getServices(clientId).forEach(svc => {
      const owed = serviceOutstanding(svc.serviceId);
      if (owed <= 0) return;
      byCode[svc.currency] = byCode[svc.currency] || { code: svc.currency, amount: 0, bdt: 0 };
      byCode[svc.currency].amount += owed;
      byCode[svc.currency].bdt += serviceOutstandingBDT(svc.serviceId);
    });
    const list = Object.values(byCode);
    return { byCurrency: list, totalBDT: list.reduce((s, r) => s + r.bdt, 0) };
  }
  function totalOutstandingBDT() {
    return getServices().reduce((s, svc) => s + serviceOutstandingBDT(svc.serviceId), 0);
  }

  /* ---------------- Currencies ---------------- */
  function getCurrencies() { return DATA.currencies.slice(); }
  function getCurrency(code) { return DATA.currencies.find(c => c.code === code) || null; }
  function addCurrency(cur) {
    cur.lastUpdated = new Date().toISOString().slice(0, 10);
    if (isFirebaseActive()) {
      mpFirestore.collection("currencies").doc(cur.code).set(cur).catch(err => console.error("addCurrency failed:", err));
    } else {
      DATA.currencies.push(cur);
      persistLocal();
    }
    return cur;
  }
  function updateCurrency(code, patch) {
    // Historical payments already store their own exchangeRate — updating the
    // live rate here NEVER touches past payment records.
    const merged = Object.assign({}, patch, { lastUpdated: new Date().toISOString().slice(0, 10) });
    if (isFirebaseActive()) {
      mpFirestore.collection("currencies").doc(code).update(merged).catch(err => console.error("updateCurrency failed:", err));
      return Object.assign({}, getCurrency(code), merged);
    }
    const c = getCurrency(code);
    if (!c) return null;
    Object.assign(c, merged);
    persistLocal();
    return c;
  }
  function deleteCurrency(code) {
    if (isFirebaseActive()) {
      mpFirestore.collection("currencies").doc(code).delete().catch(err => console.error("deleteCurrency failed:", err));
    } else {
      DATA.currencies = DATA.currencies.filter(c => c.code !== code);
      persistLocal();
    }
  }

  /* ---------------- Activities ---------------- */
  function logActivity(clientId, type, text) {
    const entry = { id: uid("ACT"), clientId, type, text, date: new Date().toISOString() };
    if (isFirebaseActive()) {
      mpFirestore.collection("activities").doc(entry.id).set(entry).catch(err => console.error("logActivity failed:", err));
    } else {
      DATA.activities.unshift(entry);
      if (DATA.activities.length > 500) DATA.activities.pop();
    }
  }
  function getActivities(clientId) {
    return DATA.activities
      .filter(a => !clientId || a.clientId === clientId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /* ---------------- Settings ---------------- */
  function getSettings() { return DATA.settings; }
  function updateSettings(patch) {
    if (isFirebaseActive()) {
      mpFirestore.collection("settings").doc("agency").set(Object.assign({}, DATA.settings, patch), { merge: true })
        .catch(err => console.error("updateSettings failed:", err));
      Object.assign(DATA.settings, patch);
    } else {
      Object.assign(DATA.settings, patch);
      persistLocal();
    }
  }

  /* ---------------- Aggregations ---------------- */
  function totalRevenueBDT(filters) {
    return getPayments(Object.assign({ status: "Paid" }, filters)).reduce((sum, p) => sum + p.bdtValue, 0);
  }
  function monthKey(dateStr) { return dateStr.slice(0, 7); }
  function monthlyRevenueSeries(months) {
    months = months || 12;
    const now = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: d.getFullYear() + "-" + pad(d.getMonth() + 1, 2), label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), total: 0 });
    }
    const map = {};
    buckets.forEach(b => map[b.key] = b);
    getPayments({ status: "Paid" }).forEach(p => {
      const k = monthKey(p.paymentDate);
      if (map[k]) map[k].total += p.bdtValue;
    });
    return buckets;
  }
  function revenueByCurrency(filters) {
    const pays = getPayments(Object.assign({ status: "Paid" }, filters));
    const grand = pays.reduce((s, p) => s + p.bdtValue, 0);
    const byCode = {};
    pays.forEach(p => {
      byCode[p.currency] = byCode[p.currency] || { code: p.currency, original: 0, bdt: 0 };
      byCode[p.currency].original += Number(p.originalAmount);
      byCode[p.currency].bdt += p.bdtValue;
    });
    return Object.values(byCode).map(x => ({ ...x, pct: grand ? (x.bdt / grand) * 100 : 0 })).sort((a, b) => b.bdt - a.bdt);
  }
  function revenueByClient(filters) {
    const pays = getPayments(Object.assign({ status: "Paid" }, filters));
    const byClient = {};
    pays.forEach(p => { byClient[p.clientId] = (byClient[p.clientId] || 0) + p.bdtValue; });
    return Object.entries(byClient)
      .map(([clientId, bdt]) => ({ clientId, client: getClient(clientId), bdt }))
      .sort((a, b) => b.bdt - a.bdt);
  }
  function revenueByService(filters) {
    const pays = getPayments(Object.assign({ status: "Paid" }, filters));
    const byType = {};
    pays.forEach(p => {
      const svc = getService(p.serviceId);
      const type = svc ? svc.type : "Other";
      byType[type] = (byType[type] || 0) + p.bdtValue;
    });
    return Object.entries(byType).map(([type, bdt]) => ({ type, bdt })).sort((a, b) => b.bdt - a.bdt);
  }

  function clientStats(clientId) {
    const pays = getPayments({ clientId, status: "Paid" });
    const svcs = getServices(clientId);
    const dates = pays.map(p => p.paymentDate).sort();
    return {
      totalPaid: pays.reduce((s, p) => s + p.bdtValue, 0),
      totalPayments: getPayments({ clientId }).length,
      totalServices: svcs.length,
      firstPayment: dates[0] || null,
      lastPayment: dates[dates.length - 1] || null,
      outstanding: clientOutstanding(clientId)
    };
  }

  function thisMonthRevenue() {
    const key = new Date().toISOString().slice(0, 7);
    return getPayments({ status: "Paid" }).filter(p => monthKey(p.paymentDate) === key).reduce((s, p) => s + p.bdtValue, 0);
  }
  function lastMonthRevenue() {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const key = d.getFullYear() + "-" + pad(d.getMonth() + 1, 2);
    return getPayments({ status: "Paid" }).filter(p => monthKey(p.paymentDate) === key).reduce((s, p) => s + p.bdtValue, 0);
  }
  function thisYearRevenue() {
    const y = String(new Date().getFullYear());
    return getPayments({ status: "Paid" }).filter(p => p.paymentDate.slice(0, 4) === y).reduce((s, p) => s + p.bdtValue, 0);
  }
  function prevYearRevenue() {
    const y = String(new Date().getFullYear() - 1);
    return getPayments({ status: "Paid" }).filter(p => p.paymentDate.slice(0, 4) === y).reduce((s, p) => s + p.bdtValue, 0);
  }

  // Wipes every client, service, payment, and activity (currencies + settings kept).
  // Irreversible in Firebase mode — used only from Settings behind a confirm dialog.
  function clearAllData() {
    if (isFirebaseActive()) {
      ["clients", "services", "payments", "activities"].forEach(col => {
        mpFirestore.collection(col).get().then(snap => {
          const batch = mpFirestore.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          return batch.commit();
        }).catch(err => console.error("clearAllData failed on " + col + ":", err));
      });
    } else {
      const fresh = emptyData();
      DATA.clients = fresh.clients;
      DATA.services = fresh.services;
      DATA.payments = fresh.payments;
      DATA.activities = fresh.activities;
      persistLocal();
    }
  }

  return {
    init, isFirebaseActive, isStorageActive, uploadPaymentProof, deleteStorageFile, deleteProofFiles,
    formatBDT, formatCurrency, formatDate, timeAgo,
    getClients, getClient, addClient, updateClient, deleteClient, nextClientId,
    getServices, getService, addService, updateService, deleteService, nextServiceId,
    getPayments, getPayment, addPayment, updatePayment, deletePayment, nextPaymentId,
    getCurrencies, getCurrency, addCurrency, updateCurrency, deleteCurrency,
    getActivities, logActivity,
    getSettings, updateSettings,
    totalRevenueBDT, monthlyRevenueSeries, revenueByCurrency, revenueByClient, revenueByService,
    pendingPayments, paymentOutstanding, serviceOutstanding, serviceOutstandingBDT, clientOutstanding, totalOutstandingBDT,
    clientStats, thisMonthRevenue, lastMonthRevenue, thisYearRevenue, prevYearRevenue,
    clearAllData
  };
})();
