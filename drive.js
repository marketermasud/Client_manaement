/* =========================================================
   drive.js — Google Drive integration for payment-proof photos
   ---------------------------------------------------------
   Uses Google Identity Services (GIS) for a browser-only OAuth
   flow (no backend/server needed) with the narrow "drive.file"
   scope — the app can only see and manage files it creates
   itself, never the rest of your Drive.

   Public API (all return Promises):
     MPDrive.isConfigured()                 -> bool (sync)
     MPDrive.uploadProof(clientLabel, paymentId, blob, fileName, onProgress)
                                             -> { id, url, viewLink, name }
     MPDrive.deleteProof(fileId)            -> void (best-effort)
   ========================================================= */

const MPDrive = (function () {
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FOLDER_CACHE_KEY = "mp_drive_folders_v1";

  let tokenClient = null;
  let cachedToken = null;   // { access_token, expiresAt }
  let gisReadyPromise = null;

  function isConfigured() {
    return typeof MP_USE_GOOGLE_DRIVE !== "undefined" && MP_USE_GOOGLE_DRIVE
      && typeof MP_DRIVE_CLIENT_ID !== "undefined"
      && !!MP_DRIVE_CLIENT_ID
      && MP_DRIVE_CLIENT_ID.indexOf("YOUR_OAUTH_CLIENT_ID") === -1;
  }

  // Waits for the Google Identity Services <script> (loaded in <head>) to
  // finish loading — it's async/defer, so it may not be ready the instant
  // this file runs.
  function waitForGis() {
    if (gisReadyPromise) return gisReadyPromise;
    gisReadyPromise = new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      (function poll() {
        if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
          resolve();
        } else if (Date.now() > deadline) {
          reject(new Error("Couldn't load Google's sign-in script — check your internet connection and try again."));
        } else {
          setTimeout(poll, 100);
        }
      })();
    });
    return gisReadyPromise;
  }

  // Resolves with a valid access token, reusing a cached one until it's
  // close to expiring. The very first call (or once a token expires) shows
  // Google's own consent popup; after that it renews silently in the
  // background as long as the browser tab stays open.
  function ensureToken() {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
      return Promise.resolve(cachedToken.access_token);
    }
    if (!isConfigured()) {
      return Promise.reject(new Error("Google Drive isn't set up yet — add your OAuth Client ID in drive-config.js (see README)."));
    }
    return waitForGis().then(() => new Promise((resolve, reject) => {
      try {
        tokenClient = tokenClient || google.accounts.oauth2.initTokenClient({
          client_id: MP_DRIVE_CLIENT_ID,
          scope: SCOPE,
          callback: () => {} // overridden per-request below
        });
        tokenClient.callback = (resp) => {
          if (resp && resp.access_token) {
            cachedToken = { access_token: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in || 3600) * 1000) };
            resolve(resp.access_token);
          } else {
            reject(new Error((resp && resp.error_description) || "Google sign-in was cancelled or failed."));
          }
        };
        tokenClient.error_callback = (err) => {
          reject(new Error((err && err.message) || "Google sign-in was cancelled or failed."));
        };
        tokenClient.requestAccessToken({ prompt: cachedToken ? "" : "consent" });
      } catch (err) {
        reject(err);
      }
    }));
  }

  function apiFetch(token, url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: "Bearer " + token });
    return fetch(url, options).then(res => {
      if (!res.ok) {
        return res.json().catch(() => null).then(body => {
          const msg = (body && body.error && body.error.message) || (res.status + " " + res.statusText);
          throw new Error("Google Drive: " + msg);
        });
      }
      if (res.status === 204) return {}; // e.g. DELETE has no response body
      return res.text().then(text => text ? JSON.parse(text) : {});
    });
  }

  function loadFolderCache() {
    try { return JSON.parse(localStorage.getItem(FOLDER_CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveFolderCache(cache) {
    try { localStorage.setItem(FOLDER_CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* ignore quota errors */ }
  }

  // Finds (or creates) a folder by name under an optional parent, caching
  // the resulting ID in localStorage so repeat uploads skip the lookup.
  function ensureFolder(token, name, parentId, cacheKey) {
    const cache = loadFolderCache();
    if (cache[cacheKey]) return Promise.resolve(cache[cacheKey]);

    const parentClause = parentId ? ` and '${parentId}' in parents` : "";
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`);
    return apiFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`)
      .then(data => {
        if (data.files && data.files.length) return data.files[0].id;
        const metadata = { name, mimeType: "application/vnd.google-apps.folder" };
        if (parentId) metadata.parents = [parentId];
        return apiFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata)
        }).then(created => created.id);
      })
      .then(id => {
        cache[cacheKey] = id;
        saveFolderCache(cache);
        return id;
      });
  }

  function ensurePaymentFolder(token, clientLabel, paymentId) {
    return ensureFolder(token, MP_DRIVE_ROOT_FOLDER_NAME, null, "root")
      .then(rootId => ensureFolder(token, clientLabel, rootId, "root/" + clientLabel))
      .then(clientFolderId => ensureFolder(token, paymentId, clientFolderId, "root/" + clientLabel + "/" + paymentId));
  }

  function makePublic(token, fileId) {
    return apiFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    });
  }

  // Multipart upload via XHR (not fetch) so we can report real upload
  // progress to the caller, matching the existing uploader's progress bar.
  function multipartUpload(token, folderId, blob, fileName, onProgress) {
    const boundary = "mpboundary" + Math.random().toString(36).slice(2);
    const metadata = { name: fileName, parents: [folderId] };
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const filePartHeader = `--${boundary}\r\nContent-Type: ${blob.type || "image/jpeg"}\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read the compressed image before upload."));
      reader.onload = () => {
        const body = new Blob([metaPart, filePartHeader, reader.result, closing]);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink");
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Content-Type", "multipart/related; boundary=" + boundary);
        xhr.upload.onprogress = (e) => {
          if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (e) { reject(new Error("Unexpected response from Google Drive.")); }
          } else {
            let msg = xhr.status + " " + xhr.statusText;
            try { msg = JSON.parse(xhr.responseText).error.message; } catch (e) {}
            reject(new Error("Google Drive upload failed: " + msg));
          }
        };
        xhr.onerror = () => reject(new Error("Network error while uploading to Google Drive."));
        xhr.send(body);
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  function uploadProof(clientLabel, paymentId, blob, fileName, onProgress) {
    if (!isConfigured()) return Promise.reject(new Error("Google Drive isn't set up yet — add your OAuth Client ID in drive-config.js (see README)."));
    const safeClientLabel = (clientLabel || "client").replace(/[\\/:*?"<>|]/g, "_");
    const safeName = (fileName || "proof.jpg").replace(/[^a-zA-Z0-9.\-_]/g, "_");

    return ensureToken().then(token =>
      ensurePaymentFolder(token, safeClientLabel, paymentId).then(folderId =>
        multipartUpload(token, folderId, blob, safeName, onProgress).then(file =>
          makePublic(token, file.id).then(() => ({
            id: file.id,
            name: file.name || safeName,
            url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`,
            viewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`
          }))
        )
      )
    );
  }

  function deleteProof(fileId) {
    if (!fileId) return Promise.resolve();
    return ensureToken()
      .then(token => apiFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE" }))
      .catch(err => console.warn("Drive proof delete failed (non-fatal):", err));
  }

  return { isConfigured, uploadProof, deleteProof };
})();
