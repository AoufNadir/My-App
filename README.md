<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ProDigital — v44.0.0 (Final Release · 2026-08-25)

> A web application to track USDT buy/sell transactions, calculate profits, and view statistics. Real-time data sync via Firebase (Firestore + Auth + Storage). Production-ready, security-hardened, Vite 6 + React 19 + TypeScript.

- **Release tag:** [`v1.0-final-2026-08-25`](https://github.com/AoufNadir/My-App/releases/tag/v1.0-final-2026-08-25)
- **Branch:** [`final-2026-08-25`](https://github.com/AoufNadir/My-App/tree/final-2026-08-25)
- **AI Studio preview:** https://ai.studio/apps/drive/1e07JIlR0J-2LNdSG2tnMDQFRqx-Q1ZAW

## ✨ Highlights

- **Accounting** — Core ledger, treasury shadow, portfolio shadow, client shadow, investor shadow, service shadow, lifecycle v2
- **Read models** — Dashboard, initial snapshot, production summary, writer coverage, read-model activation, atomicity blockers, legacy operation index backfill
- **Smart pricing engine** — Dynamic service pricing with pricing-matrix utilities
- **Translations** — Bilingual (FR/AR) with full test coverage
- **Firebase** — Firestore rules, storage rules, Data Connect schema
- **Security** — HSTS, X-Frame-Options DENY, CSP (tight, with Firebase allow-list), Permissions-Policy, Referrer-Policy

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
# Optional: copy your Gemini key into .env.local
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run dev
```

## 🧪 Tests, typecheck, and production build

```bash
npm run typecheck     # TypeScript no-emit check
npm test              # 25+ Node test files (accounting, read models, utils, hooks, services, translations)
npm run build         # Vite production build → dist/
npm run preview       # Preview the production build locally
npm run ci            # typecheck + test + build (used in CI)
```

## ☁️ Deploy to Vercel

The repo ships with a `vercel.json` that declares the **Vite** framework preset, sets `outputDirectory` to `dist`, applies SPA rewrites, and adds security headers.

### Option A — Auto-deploy from GitHub (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and **import** the `AoufNadir/My-App` repository.
2. When prompted for the project name, pick `prodigital-final` (or any slug you like).
3. Vercel will detect `vercel.json` and use:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm install`
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` (if you use Gemini)
   - Any Firebase config your app reads at build time
5. Click **Deploy**. Vercel will build and deploy every push to `final-2026-08-25` automatically.

### Option B — Deploy from the CLI

```bash
npm i -g vercel
vercel login
vercel link                # link to the imported project
vercel deploy --prod       # production deploy from the final-2026-08-25 branch
```

## 📦 Release artifacts

- **GitHub Release:** https://github.com/AoufNadir/My-App/releases/tag/v1.0-final-2026-08-25
- **Tagged commit:** see `v1.0-final-2026-08-25`
- **License:** see repository

