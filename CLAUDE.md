# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

TMHCC Platform (ศูนย์บัญชาการสุขภาพจิตตำบล) — a real-time incident/SOP tracking system for subdistrict-level mental health and drug incidents in Thailand. Staff open incidents from a web form or a LINE group form (LIFF); the system then walks the case through a fixed sequence of responding units, notifying each one over LINE (Flex Messages) as its turn comes up, and lets any unit confirm from either LINE or the web.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build — also runs the TypeScript check
npm run start    # run a production build locally
npm run lint      # ESLint
npx tsc --noEmit  # standalone type-check (no dedicated script for this)
```

There is no test suite/test command in this repo.

Deploy: pushing to `main` on GitHub auto-deploys via Vercel (project "pems"). The local default branch is `master`, so deploying is `git push origin master:main`, not a plain `git push`.

## Architecture

**Three distinct Firebase access patterns — pick the right one:**
- `firebase/config.js` — client SDK (`auth`, `db`). Used in every `"use client"` page/component. Pages that require login call the `useRequireAuth()` hook (`firebase/useRequireAuth.js`), which redirects to `/login` if there's no session.
- `firebase/serverAuth.js` — `ensureServerAuth()` signs in as a fixed **system account** (email/password from `SYSTEM_ACCOUNT_EMAIL`/`SYSTEM_ACCOUNT_PASSWORD`) using the *client* SDK, from server routes that need to write Firestore but have no real user session to act as (`line-webhook`, `liff-report`). This exists because `firestore.rules` requires `request.auth != null` on writes.
- `firebase/admin.js` — Firebase **Admin SDK**, bypasses Firestore rules entirely. Used by routes needing privileged operations (create/delete Auth users, cross-collection reads regardless of rules): `manage-member`, `manage-incident`, `send-liff-button`, `notify-line`, `public-status`. It deliberately loads `firebase-admin/*` via `require()` inside a `try/catch` instead of static `import` — a static import's module-resolution failure can't be caught by try/catch in the same file, so this file must degrade to `adminAuth`/`adminDb` = `null` (+ log) rather than crash the whole route at import time. Routes using it must check for `null` before use.

**`package.json`'s `overrides: { "jose": "4.15.9" }` is load-bearing — do not remove without understanding why.** `firebase-admin` → `jwks-rsa` pulls in `jose` v6, which dropped CommonJS support. Vercel's serverless runtime throws `ERR_REQUIRE_ESM` when firebase-admin's externalized bundle `require()`s it — this does *not* reproduce in local dev, only in the deployed Vercel runtime, which is what made it hard to find originally. `next.config.ts`'s `serverExternalPackages: ['firebase-admin']` is unrelated to this (and actually redundant, since Next already externalizes it by default) — the `jose` override is the actual fix.

**Firestore security is coarse, not role-based.** `firestore.rules` only checks `request.auth != null` (any signed-in user can read/write every collection except `units`, which is publicly readable). `role` (`VHV`/`HOSPITAL`/`ADMIN`) is enforced entirely at the application layer: client-side page gating (fetch `users/{uid}.role` before rendering `/users` or `/units`) and, more importantly, inside the Admin-SDK-backed API routes (`manage-member`, `manage-incident`, `send-liff-button` each verify the caller's ID token, then look up their `role` in Firestore, before doing anything). There's no Firebase CLI/`firebase.json` in this repo — `firestore.rules` is deployed by manually pasting into the Firebase Console, not automatically.

**SOP progression is a sequential chain, not a broadcast.** Opening an incident creates exactly one task (`VILLAGE_HEAD`, step 1) — see `createSopTasksForIncident` in `services/sopService.js`. Completing a task calls `advanceSopChain(incidentId, completedStepOrder)`, which creates *only the next* step's task and fires its notification. The fixed order is `AUTOMATIC_TASKS` in `sopService.js`: `VILLAGE_HEAD → VHV → HEALTH_CENTER → HOSPITAL → EMS`. `POLICE` is a separate conditional task type (`createConditionalTask`), triggered manually from the incident detail page — it never appears in the automatic chain and doesn't affect its ordering.

**`/api/notify-line` accepts two different caller identities**, checked in `verifyCaller()`: a Firebase ID token (browser-originated) *or* `internalSecret` matching the `INTERNAL_API_SECRET` env var (server-to-server, since a server-side `fetch` has no user session to attach — e.g. `line-webhook` calling `notify-line` after a postback). `services/notifyService.js`'s `sendTaskNotification(incident, task, baseUrl, internalSecret)` threads this through; `baseUrl` must be a full origin (not a relative path) whenever called from another server route, since server-side `fetch` can't resolve relative URLs.

**Real-time (`onSnapshot`) is the default, not an add-on.** Dashboard, incident detail, `TaskTable`, `/users`, `/units` all subscribe live rather than fetching once. Follow this pattern for any new Firestore-backed UI.

**`incident.id` (human code, e.g. `INC-2026-000001`) and `incident.docId` (Firestore document ID) are different and both get used.** `tasks.incidentId` stores the human code, so joining a task back to its incident is `where("id", "==", incident.id)` against the `incidents` collection, not `doc(db, "incidents", incident.id)`. Anything touching both collections together (e.g. `/api/manage-incident`'s delete) needs both values.

**`/status` is the one intentionally public page** (`app/status/page.jsx` + `app/api/public-status/route.js`, no navbar, no auth). It must only ever return numbers aggregated server-side with the Admin SDK — never case codes, patient names, or per-incident documents. Preserve this if extending it.

**LINE integration surface:** `app/api/line-webhook/route.js` (HMAC signature-verified via `LINE_CHANNEL_SECRET`, handles `postback` events only), `app/api/liff-report/route.js` (verifies the LIFF access token against LINE's `/oauth2/v2.1/verify`), `app/liff/report/page.jsx` (the in-LINE mini-app form). The LIFF form and `app/incidents/page.jsx` (web form) are kept field-for-field identical by convention, not by shared code — update both when changing incident-intake fields.

**Required env vars** (`.env.local`, not committed): `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_TARGET_USER_ID`, `SYSTEM_ACCOUNT_EMAIL`, `SYSTEM_ACCOUNT_PASSWORD`, `NEXT_PUBLIC_LIFF_ID`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `INTERNAL_API_SECRET`.

**Path alias:** `@/*` resolves to the repo root (see `tsconfig.json`), not `src/`.
