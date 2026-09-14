/* =========================================================
   drive-config.js
   ---------------------------------------------------------
   PASTE YOUR GOOGLE OAUTH CLIENT ID BELOW. This is what lets the
   app upload payment-proof photos straight into a folder on YOUR
   OWN Google Drive — see the README for the exact Google Cloud
   Console steps (enable the Drive API, create an OAuth Client ID,
   add yourself as a test user, add authorized origins).

   This Client ID is safe to ship in frontend code — it is NOT a
   secret. It only identifies which app is asking to connect; the
   actual sign-in and consent always happen on Google's own screen,
   and the app only ever requests the "drive.file" scope — meaning
   it can only see/manage files IT creates, never your other
   Drive files.
   ========================================================= */

const MP_DRIVE_CLIENT_ID = "778896753243-i2233fcb7akvntorakrb6pamd01e5r7g.apps.googleusercontent.com";

// The app creates (or reuses) this folder the first time you upload a
// proof photo, with a subfolder per client and per payment inside it.
const MP_DRIVE_ROOT_FOLDER_NAME = "PPC Ads by Masud - Payment Proofs";

// Flip to false to hide the proof-upload feature entirely (e.g. before
// you've set up the OAuth Client ID above).
const MP_USE_GOOGLE_DRIVE = true;
