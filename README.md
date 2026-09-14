# Client Management & Revenue Dashboard — PPC Ads by Masud

A premium, responsive client/revenue management system built with **Bootstrap 5, vanilla JavaScript, and Chart.js** — now connected to your live Firebase project (`client-management-efcae`). Data is stored in Firestore and syncs in real time: open the app on your phone and laptop at once and changes appear on both automatically.

Brand colors and the circular logo mark are embedded as base64 in `logo-data.js`, so the whole app is portable as a single folder.

---

## 1. Three things you must do in the Firebase Console before this works

The app's code is already pointed at your project. Three things can only be done from the Firebase Console itself (the app can't do them for you):

### A. Create your admin login

Go to **Firebase Console → Build → Authentication → Get started → Sign-in method → Email/Password → Enable**. Then go to the **Users** tab → **Add user** and create yourself an account (any email + password). That email/password is what you'll type into this app's login screen.

*(A public "sign up" form was deliberately left out of the app — anyone who could sign themselves up would get full access to all your client and payment data. Creating the account yourself in the Console is the safe way to do it.)*

### B. Turn on Firestore and publish the security rules

Go to **Firebase Console → Build → Firestore Database → Create database** (choose a region close to you, e.g. `asia-south1` or `asia-southeast1`, production mode is fine). Then open the **Rules** tab and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This means: only someone signed in with a Firebase Auth account you created (step A) can read or write any data — everyone else is blocked, including if someone finds your website URL. This is the same rule the app was designed around from the start.

### C. Connect Google Drive (for payment-proof photos)

Photo uploads go straight into a folder on your own Google Drive — not Firebase Storage. (Firebase Storage now requires upgrading to Google's paid Blaze billing plan just to turn on, which is why proof uploads used to spin forever with no way to finish. Drive avoids that entirely and costs nothing extra.)

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)** and make sure the project selector (top left) has **`client-management-efcae`** selected — it's the same underlying project as your Firebase app, just viewed from the Google Cloud side.
2. **APIs & Services → Library** → search **"Google Drive API"** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Fill in an App name (e.g. "PPC Ads by Masud"), your email as support email and developer contact → Save and Continue.
   - On the Scopes step, you can just click Save and Continue (no need to add anything manually).
   - On the **Test users** step, click **Add users** and add your own Gmail address → Save and Continue → Back to Dashboard.
   - Leave the app in **Testing** status — you do **not** need to submit it for Google's verification review, since only you (as a listed test user) will ever sign in.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name it anything (e.g. "PPC Ads Panel").
   - Under **Authorized JavaScript origins**, click **Add URI** and add exactly: `https://masudppc.com` (matching how this app is hosted — see section 6). If you also test locally, add `http://localhost:8000` as a second origin.
   - Click **Create**. Copy the Client ID it shows you (ends in `.apps.googleusercontent.com`).
5. Open `drive-config.js` in this folder and paste that Client ID in as `MP_DRIVE_CLIENT_ID`.
6. That's it — no rules to publish for this one. The first time you add a payment-proof photo, Google will show its own consent popup ("PPC Ads by Masud wants to see, edit, create, and delete only the specific Google Drive files you use with this app") — click **Allow**, signed in with the same Gmail account you added as a test user in step 3. A folder called **"PPC Ads by Masud - Payment Proofs"** will appear in your Drive automatically, with a subfolder per client and per payment inside it.

Once all three (A, B, C) are done, open `login.html`, sign in with the account from step A, and you're live.

---

## 2. How to run the project

No build step — it's plain HTML/CSS/JS.

**Easiest:** double-click `login.html` to open it in your browser.

**Recommended** (avoids some browser file:// restrictions):
```bash
python3 -m http.server 8000
# then open http://localhost:8000/login.html
```

---

## 3. How your data is organized in Firestore

| Collection   | Document ID              | Holds |
|--------------|---------------------------|-------|
| `clients`    | the Client ID (`CL-001`…) | Full client profile |
| `services`   | the Service ID (`SV-001`…)| Services/projects per client |
| `payments`   | the Payment ID (`PMT-1001`…) | Every individual payment |
| `currencies` | the currency code (`USD`, `EUR`…) | Exchange rate table — seeded automatically with ~140 world currencies the first time the app connects |
| `activities` | auto-generated ID | Audit trail per client |
| `settings`   | single document `agency`  | Agency name, owner, base currency |

**Payment proof photos:** each payment can have one or more images attached (screenshot, bank slip photo, etc.) — tap the **+** tile in the Add/Edit Payment form to attach as many as you like. Images are auto-compressed in the browser before upload (faster, smaller), uploaded straight to a folder on your own **Google Drive** (see setup step C above) organized as `PPC Ads by Masud - Payment Proofs/{client}/{paymentId}/…`, and the resulting file IDs/links are saved on the payment's `proofs` array in Firestore. Click any thumbnail — in the Payments table, a client's Payment History, or a Client Statement report — to open a full-size gallery viewer. Deleting a payment (or its client/service) also deletes its proof images from Drive.

**Currency rule:** a payment's `exchangeRate` and `bdtValue` are calculated once, when it's recorded, and stored permanently on that payment. Editing a currency's live rate later on the Currencies page **never** rewrites historical payments.

**Payment status model:**
- **Paid** — fully received, nothing outstanding.
- **Partial** — `originalAmount` received so far; `totalDue` is the full agreed amount; the difference is tracked as still owed and shown on that client's profile as their **Outstanding Balance**, broken down by currency.
- **Pending / Unpaid** — nothing received yet; the full amount counts as outstanding.
- A payment's currency always follows the currency of the **Service** it's linked to. The exchange rate is a manual field (pre-filled from the Currencies table as a starting point, always editable).
- Every payment and service can be edited any time — amounts, status, everything recalculates automatically.
- **Follow-up payments auto-fill the real amount still due.** If a service's deal is 10 and a Partial payment records 5 received, the *next* payment you add against that same service — even as a brand-new entry with its own date and reference, not an edit of the first one — automatically fills Amount and Total Due with the 5 still owed, and shows a "Balance due" hint. The Outstanding Balance figure nets all of a service's payments against its deal total, so once the remaining 5 is recorded, the client's outstanding balance correctly drops to zero. (The original partial payment's own row in the history table still shows what *it* recorded at the time — that's normal historical detail, not an error.)

**Service end dates:** Start Date is always entered manually. End Date fills itself in with today's date the moment a service's status is changed to anything other than Active (Completed/Paused/Cancelled) — no manual step needed — and clears again if you switch it back to Active. A date you've typed in yourself is never overwritten.

**Duplicate-payment warning:** if you select a service in the Add Payment form that's already fully paid off, the Amount field turns red and a warning box lists the existing payment(s) already on file for it (with their references) — a safety check against accidentally double-entering a payment. It never blocks you from proceeding (e.g. a recurring Monthly service legitimately gets a new payment every cycle) — it's purely a heads-up before you save.

---

## 4. Everything is already wired up — how it works under the hood

`db.js` is the only file that touches storage. It runs in one of two modes depending on `MP_USE_FIREBASE` in `firebase-config.js` (currently `true`):

- **Firebase mode**: every `MPDB.getClients()`, `MPDB.addPayment()`, etc. reads/writes Firestore. The app also opens a live listener (`onSnapshot`) on every collection — so the moment data changes (from this browser tab, another device, or even someone editing directly in the Firebase Console), every open page updates itself automatically via a `mpdb:update` event, no refresh needed.
- **Local mode** (fallback if `MP_USE_FIREBASE` is set to `false`, or if the Firebase SDK fails to load): the exact same functions instead read/write `localStorage` on just that device, for offline testing.

If you ever need to temporarily go back to local-only testing, set `MP_USE_FIREBASE = false` in `firebase-config.js`.

---

## 5. Settings → Danger Zone

The Settings page has a **Clear All Data** button that permanently deletes every client, service, payment, and activity log (currencies and agency settings are kept). There's no seeded demo data anymore — the app starts empty and only ever holds what you enter.

---

## 6. Your setup: hosted at masudppc.com/panel/ via GitHub Pages

This is exactly how it's configured for you — same pattern as `verify.html` on your existing site.

**The real access control is the login screen (Firebase Auth) plus the Firestore rules from section 1B — not a secret URL.** Even if someone finds `masudppc.com/panel/`, they cannot see or touch any data without your admin login. Keeping the link unlisted (not in your site's navigation) is just an extra layer.

### Steps

1. In your existing GitHub repo (the one GitHub Pages builds masudppc.com from), create a new folder named **`panel`** at the same level as your other site folders/files.
2. Copy everything from inside this `client-management-app` folder into that `panel` folder — all the `.html`, `.js`, and `.css` files, plus `README.md`. (`firebase.json` and `.firebaserc` are only needed for the alternative Firebase Hosting path below — harmless to include, safe to leave out.)
3. Commit and push to whichever branch GitHub Pages is set to build from (usually `main` or `gh-pages`).
4. Wait a minute or two for GitHub Pages to rebuild, then visit `https://masudppc.com/panel/` — you'll land on the dashboard, which immediately redirects to the login screen if you're not signed in.
5. The Firebase project (`client-management-efcae`) is unchanged — data still lives in the same live Firestore, regardless of where the frontend files are hosted.

### Keeping it out of search engines

Every page already has `<meta name="robots" content="noindex, nofollow, noarchive">`, so search engines won't index individual pages even if they somehow find them. The `robots.txt` included in this folder only works if it ends up at your site's true root (`masudppc.com/robots.txt`) — since GitHub Pages only reads one robots.txt for the whole domain. If your repo already has a root-level `robots.txt`, just add one line to it instead:
```
Disallow: /panel/
```
If you don't have a root robots.txt yet, you can copy the one from this folder to your repo's root and add that line.

### Alternative: Firebase Hosting with its own subdomain

If you'd rather host it separately from your GitHub Pages site instead (e.g. under `panel.masudppc.com` as its own subdomain, fully separate from your main site's repo):

1. `npm install -g firebase-tools` (once)
2. From inside this folder: `firebase login` then `firebase deploy --only hosting` — `firebase.json` and `.firebaserc` here already point at your `client-management-efcae` project.
3. You'll get a live link immediately at `https://client-management-efcae.web.app`.
4. To use `panel.masudppc.com` instead: **Firebase Console → Hosting → Add custom domain** → enter it → add the TXT/A/CNAME records it shows you to masudppc.com's DNS. SSL is issued automatically within a few hours.

### Alternative: Cloudflare Pages (or any host with "clean URLs")

Connecting this repo to Cloudflare Pages works the same way as GitHub Pages — just point it at the repo and it deploys automatically on every push. One thing to know: Cloudflare Pages (like several other static hosts) serves **clean URLs** by default, showing `/login` in the address bar instead of `/login.html`. The app already accounts for this — the login/session check recognizes a page as "the login page" whether the URL is `/login`, `/login/`, or `/login.html`, at any folder depth. If you ever see the generated link reload itself over and over right after connecting a new host, it means that host rewrites URLs differently — copy the exact URL pattern it produces for the login page and it can be added to the same check in `auth.js` (`isOnLoginPage`).

---



```
client-management-app/                (flat — every file sits at the top level;
                                        no js/ or css/ subfolders, so GitHub
                                        Pages/any static host serves it with no
                                        extra path configuration)
├── firebase.json          Firebase Hosting config (public dir + noindex headers)
├── .firebaserc              Points the Firebase CLI at your project
├── robots.txt                 Blocks all search-engine crawlers
├── style.css                     Design tokens + all component styles
│
├── index.html            Dashboard
├── login.html             Login (Firebase Authentication)
├── clients.html            Clients list
├── client-details.html      Client profile (Overview / Services / Payments / Activity)
├── services.html             Services / Projects
├── payments.html               Payments
├── revenue.html                  Revenue Analytics
├── currencies.html                 Currency Management (140+ world currencies, searchable)
├── reports.html                      Reports — Client Statement (A4 print/PDF) + tabular reports
├── settings.html                       Agency profile, Firebase/Drive status, Clear All Data
│
├── logo-data.js            Base64-embedded brand logo
├── currencies-data.js        Full world currency reference list
├── db.js                       Data layer — Firestore live sync or localStorage fallback
├── components.js                 Shared sidebar / topbar / toasts / confirm modal / proof uploader
├── auth.js                         Firebase Authentication (+ local demo fallback)
├── firebase-config.js                Your live Firebase project config
├── drive-config.js                     Your Google Drive OAuth Client ID
├── drive.js                              Google Drive upload/delete for payment-proof photos
├── app.js                                  Dashboard page logic
├── clients.js                                Clients page logic
├── client-details.js                           Client profile logic
├── services.js                                   Services page logic
├── payments.js                                     Payments page logic
├── revenue.js                                        Revenue Analytics logic
├── currencies.js                                       Currency Management logic
└── reports.js                                            Reports logic
```
