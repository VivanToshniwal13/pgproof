# PGProof

**Tagline:** *Your PG deposit, protected by proof.*

PGProof helps paying-guest (PG) hostel tenants in Bengaluru collect timestamped move-in proof, track unresolved maintenance complaints, audit move-out deposit deductions with Google Gemini (`gemini-2.5-flash`), and generate calm, factual refund notices.

---

## Architecture & Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide icons, jsPDF
- **Backend / AI:**
  - Server-side Google Gemini (`gemini-2.5-flash` via `@google/genai`) — never exposed to the browser
  - Express server (`server.ts`) for local/full-stack hosting on port `3000`
  - Deployable Firebase Cloud Functions v2 callable functions (`functions/src/index.ts`) using Firebase Functions secrets (`GEMINI_API_KEY`)
- **Database, Auth & Storage:**
  - Firebase Authentication (Google Sign-In + Email/Password)
  - Cloud Firestore (`users`, `pgs`, `moveInPhotos`, `complaints`, `deductions`, `notices`)
  - Firebase Storage (`/users/{uid}/pgs/{pgId}/...`, images only, max 5 MB)

---

## Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and set `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
   Optional `VITE_FIREBASE_*` overrides can be set in `.env` (or `firebase-applet-config.json` is used automatically).

3. **Run the full-stack dev server (port 3000)**
   ```bash
   npm run dev
   ```

4. **Build & run in production**
   ```bash
   npm run build
   npm start
   ```

---

## Firebase Setup & Deployment

1. **Enable Auth Providers in Firebase Console**
   - Go to **Authentication -> Sign-in method** in your Firebase project (`durable-groove-8lvvl` or your own project).
   - **Google** sign-in is ready out of the box.
   - Enable **Email/Password** if you want email/password registration & login.

2. **Initialize & Deploy Storage Rules**
   - Ensure Firebase Storage is initialized in **Storage -> Get started**.
   - Deploy both `firestore.rules` and `storage.rules`:
     ```bash
     firebase deploy --only firestore:rules,storage
     ```

3. **Deploy Firebase Cloud Functions (Optional for Firebase Hosting)**
   If deploying as a pure static frontend on Firebase Hosting or Vercel with Cloud Functions:
   ```bash
   cd functions && npm install && cd ..
   firebase functions:secrets:set GEMINI_API_KEY
   firebase deploy --only functions,hosting
   ```
   Set `VITE_USE_CLOUD_FUNCTIONS=true` in your frontend build environment so the app calls the `asia-south1` callable Cloud Functions (`analyzeMoveInPhoto`, `evaluateDeductions`, `generateNotices`) directly.

---

## Security Rules Summary

- **`firestore.rules`**:
  - Every `pg` and subcollection (`moveInPhotos`, `complaints`, `deductions`, `notices`) is readable and writable only when `ownerUid == request.auth.uid`.
  - Once a `moveInPhoto` has `locked == true`, updates and deletes are strictly denied at the database layer.
  - Strict field validation, string length limits, server timestamp checks (`request.time`), and `list` query enforcement.
- **`storage.rules`**:
  - Files under `/users/{uid}/...` are readable and writable only by `request.auth.uid == uid`.
  - Uploads are restricted to `image/*` MIME types and `<= 5 MB`.
