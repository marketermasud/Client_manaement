/* =========================================================
   auth.js
   ---------------------------------------------------------
   Firebase mode (MP_USE_FIREBASE = true): real Firebase
   Authentication (email/password). The admin account must
   already exist — create it once in the Firebase Console
   under Authentication → Users → Add user (see README).

   Local mode (MP_USE_FIREBASE = false): a lightweight local
   "session" so the UI can still be tested with no backend.

   Every page calls MPAuth.ready(callback) exactly once. It
   resolves with the current user once Firebase has confirmed
   the auth state (or immediately in local mode), or redirects
   to login.html if nobody is signed in.
   ========================================================= */

const MPAuth = (function () {
  const SESSION_KEY = "mp_session_v1";

  function isFirebaseActive() {
    return typeof MP_USE_FIREBASE !== "undefined" && MP_USE_FIREBASE && typeof mpFirebaseAuth !== "undefined" && !!mpFirebaseAuth;
  }

  function currentUser() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function isLoggedIn() { return !!currentUser(); }

  function persistSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: user.email,
      name: user.displayName || (user.email ? user.email.split("@")[0] : "Admin"),
      role: "Admin"
    }));
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function login(email, password, remember) {
    if (isFirebaseActive()) {
      const persistence = remember === false
        ? firebase.auth.Auth.Persistence.SESSION
        : firebase.auth.Auth.Persistence.LOCAL;
      return mpFirebaseAuth.setPersistence(persistence).then(() =>
        mpFirebaseAuth.signInWithEmailAndPassword(email, password)
      ).then(cred => {
        persistSession(cred.user);
        return cred.user;
      });
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!email || !password) return reject(new Error("Email and password are required."));
        if (password.length < 4) return reject(new Error("Incorrect email or password."));
        const user = { email, displayName: "Admin" };
        persistSession(user);
        resolve(user);
      }, 400);
    });
  }

  function logout() {
    if (isFirebaseActive()) {
      return mpFirebaseAuth.signOut().then(() => clearSession());
    }
    return new Promise(resolve => { clearSession(); resolve(); });
  }

  function resetPassword(email) {
    if (isFirebaseActive()) {
      return mpFirebaseAuth.sendPasswordResetEmail(email);
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!email) return reject(new Error("Enter your account email first."));
        resolve();
      }, 300);
    });
  }

  // Identifies the login page reliably even when a host (e.g. Cloudflare
  // Pages, GitHub Pages) rewrites clean URLs — "/login", "/login/", and
  // "/login.html" (at any folder depth) all count. A naive
  // pathname.endsWith("login.html") check misses the clean-URL cases and
  // causes an infinite redirect-reload loop on hosts that strip ".html".
  function isOnLoginPage() {
    const lastSegment = window.location.pathname.split("/").filter(Boolean).pop() || "";
    return lastSegment.replace(/\.html$/i, "") === "login";
  }

  // Every protected page calls this once. Resolves with the user once we're
  // sure they're signed in; otherwise redirects to login.html.
  function ready(callback) {
    const onLoginPage = isOnLoginPage();
    if (isFirebaseActive()) {
      mpFirebaseAuth.onAuthStateChanged(user => {
        if (user) {
          persistSession(user);
          if (callback) callback(user);
        } else {
          clearSession();
          if (!onLoginPage) window.location.href = "login.html";
        }
      });
    } else {
      if (isLoggedIn()) {
        if (callback) callback(currentUser());
      } else if (!onLoginPage) {
        window.location.href = "login.html";
      }
    }
  }

  return { currentUser, isLoggedIn, login, logout, resetPassword, ready, isFirebaseActive, isOnLoginPage };
})();
