# PA Guest Tracker — Setup & Deployment Guide

## Stack
- **Firebase** (Auth + Firestore) — backend
- **GitHub** (rahulshrm195) — source code
- **Cloudflare Pages** — hosting at `paguests.appcentrik.in`

---

## Step 1: Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project: **`pa-guest-tracker`**
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Firestore Database** → Start in **production mode**
5. Go to Project Settings → Your apps → Add web app
6. Copy the config object

---

## Step 2: Update Firebase Config

Open `firebase.js` and replace the config:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "pa-guest-tracker.firebaseapp.com",
  projectId: "pa-guest-tracker",
  storageBucket: "pa-guest-tracker.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

---

## Step 3: Deploy Firestore Security Rules

### Option A: Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
# Copy firestore.rules content
firebase deploy --only firestore:rules
```

### Option B: Firebase Console (Manual)
1. Firestore → Rules tab
2. Paste the contents of `firestore.rules`
3. Publish

---

## Step 4: Create First Super Admin User

1. Firebase Console → Authentication → Add user
   - Email: your email
   - Password: set a password
2. Copy the **UID** shown

3. Firestore → Create collection `users` → Document ID = the UID
   ```
   name: "Your Name"
   email: "your@email.com"
   role: "superAdmin"
   chapterIds: []
   createdAt: (use server timestamp or current date)
   ```

---

## Step 5: Create App Icons

You need two PNG icons:
- `/icons/icon-192.png` — 192×192px
- `/icons/icon-512.png` — 512×512px

Use any tool (Canva, Figma) to create PA-branded icons with:
- Navy background (#0B1B3A)
- Gold "PA" text (#C9A84C)
- Playfair Display font

---

## Step 6: Push to GitHub

Create a new repo on GitHub: `pa-guest-tracker`

Upload all files maintaining this structure:
```
pa-guest-tracker/
├── index.html
├── app.js
├── firebase.js
├── i18n.js
├── sw.js
├── manifest.json
├── firestore.rules
├── styles/
│   └── app.css
├── pages/
│   ├── register-guest.js
│   ├── dashboard.js
│   ├── guests.js
│   ├── guest-detail.js
│   ├── meetings.js
│   ├── attendance.js
│   ├── chapters.js
│   └── users.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Step 7: Cloudflare Pages Deployment

1. Cloudflare Dashboard → Pages → Create a project
2. Connect to GitHub → select `pa-guest-tracker` repo
3. Build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `/` (root)
4. Deploy

---

## Step 8: Custom Domain

1. In Cloudflare Pages → Custom domains → Add `paguests.appcentrik.in`
2. Add CNAME record in DNS:
   ```
   CNAME  paguests  →  pa-guest-tracker.pages.dev
   ```

---

## Step 9: Add Firebase Auth Domain

1. Firebase Console → Authentication → Settings → Authorized domains
2. Add: `paguests.appcentrik.in`

---

## First Login Flow

1. Visit `paguests.appcentrik.in`
2. Login with super admin email/password
3. Go to **Chapters** → create your first chapter (e.g., "Nashik")
4. Go to **Users** → create users in Firebase Auth, then edit their profiles to assign role + chapters
5. Go to **Meetings** → add upcoming meetings
6. Share the registration URL with members: `paguests.appcentrik.in/#register`

---

## User Roles Summary

| Role | Can Do |
|------|--------|
| Super Admin | Everything: chapters, users, all guests, all meetings |
| Chapter Admin | Manage guests, meetings, follow-ups for their chapter(s) |
| Registration Desk | Mark attendance only |

---

## Public Guest Registration

Any PA member can register a guest by visiting:
```
https://paguests.appcentrik.in/#register
```
Share this link in your WhatsApp group. No login required.

---

## Guest Status Flow

```
New → Attending (auto, on first attendance) → Interested → Converted ✅
                                                          → Not Interested ❌
                                                          → Ghosted 👻
```

---

## Guest Fee + Meeting

A guest can:
- Pay fee + select a meeting (fully confirmed)
- Pay fee + "Not decided yet" (committed financially, date TBD)
- No fee + select a meeting (coming, not paid)
- No fee + "Not decided yet" (early pipeline)

The admin can filter by "Fee paid, no meeting selected" to follow up.
