/* =========================================================
   firebase-config.js
   ---------------------------------------------------------
   Connected to your live Firebase project (client-management-efcae).
   This is the public, client-side config — safe to ship in frontend
   code, it is NOT a secret. Never put an Admin SDK service-account
   key here or in any frontend file.
   ========================================================= */

const MP_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAaOFJjI3o0-RsRyOEi5wnJOTxLu9f3F_I",
  authDomain: "client-management-efcae.firebaseapp.com",
  projectId: "client-management-efcae",
  storageBucket: "client-management-efcae.firebasestorage.app",
  messagingSenderId: "26148080455",
  appId: "1:26148080455:web:3f231ddd6ea771d7c7da62"
};

// Live mode is on. If you ever need to preview the UI on local demo
// data instead (e.g. Firebase is unreachable), set this to false.
const MP_USE_FIREBASE = true;

let mpFirebaseApp = null;
let mpFirebaseAuth = null;
let mpFirestore = null;

function mpInitFirebase() {
  if (!MP_USE_FIREBASE) return;
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK scripts not loaded on this page — check the <script> tags in <head>.");
    return;
  }
  mpFirebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(MP_FIREBASE_CONFIG);
  mpFirebaseAuth = firebase.auth();
  mpFirestore = firebase.firestore();
  // Keeps the app usable for a moment if the connection drops mid-session.
  mpFirestore.enablePersistence({ synchronizeTabs: true }).catch(() => { /* unsupported browser / multiple tabs without sync — safe to ignore */ });
}

mpInitFirebase();
