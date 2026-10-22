# AMZ Prep

A minimalist interview-prep dashboard. It includes a LeetCode-style tracker for 1,086 frequency-ranked problems, curated System Design and Leadership resources, and a notepad (write / sketch / links) for every track. Accounts and data sync through Supabase.

**Stack:** vanilla JS (ES modules) + Vite · Supabase (Postgres, Auth, Row Level Security) · Vercel

## Features

- **Accounts:** email + password sign-up with email confirmation, password reset, sign out everywhere, data export and self-service account deletion.
- **Dashboard:** problems solved, solving streak, a heatmap of solves per day, difficulty split, weakest topics with a suggested next problem, topic mastery, confidence spread, and workspace usage.
- **DSA tracker:** topic filters, presets (Top 50/100, Core 75, DP, Trees & Graphs, …), search (`/`), sortable columns, status/star/notes/confidence per problem, random pick, daily pick, and JSON backup/restore.
- **Tracks:** DSA, Leadership, System Design, Backend and Internships, each with resources and its own notepad.
- **Light / dark theme.**

**Streak rule:** a day counts only if at least one problem was **marked Solved** that day. Un-solving removes it. The streak survives until the end of today.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor →** run each file in [`supabase/migrations/`](supabase/migrations/) **in filename order** (`…_init.sql`, then `…_fix_solved_at_check.sql`).
3. **Authentication → Providers → Email:** enable *Confirm email*. Set minimum password length to 8, requiring letters and digits.
4. **Authentication → URL Configuration:** set the *Site URL* to your Vercel URL. Under *Redirect URLs* add `https://<your-app>.vercel.app/**` (the `/**` is needed for the password-reset link) and `http://localhost:5173/**` for local development.
5. **Project Settings → API:** copy the *Project URL* and the *anon / publishable* key. **Never** use the `service_role` key in this app.

See [SECURITY.md](SECURITY.md#deployment-security-checklist) for the full hardening checklist.

### 2. Local development

```bash
npm ci
cp .env.example .env.local     # then fill in the two values
npm run dev                    # http://localhost:5173
```

### 3. Deploy on Vercel

1. *Add New → Project →* import this GitHub repo. The framework preset is detected as **Vite**.
2. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production (and for Preview, ideally pointing at a separate Supabase project).
3. Deploy. Security headers (CSP, HSTS, etc.) come from [`vercel.json`](vercel.json).
4. Put the deployed URL into Supabase *Site URL* (step 1.4).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Node test runner) |
| `npm run audit` | Fail on high-severity dependency vulnerabilities |
| `npm run build:data` | Regenerate `src/data/problems.js` from `data/leetcode_problems.csv` (needs Python 3) |

## Project structure

```
├── index.html               App shell markup
├── privacy.html             Privacy notice (served at /privacy)
├── public/                  Static files copied as-is (favicon, theme bootstrap)
├── styles/                  CSS split by concern (tokens, base, components, layout, feature styles)
├── src/
│   ├── main.js              Entry: wire services → restore session → mount UI
│   ├── router.js            Tiny page router
│   ├── config/              Sections & links, tracker presets
│   ├── data/problems.js     GENERATED from data/leetcode_problems.csv
│   ├── lib/                 DOM, storage, dates, validation, toasts
│   ├── services/            supabase client, session (auth), progress, notepads, repositories, theme
│   └── features/            UI: shell, auth view, account dialog, dashboard, tracker, notepad
├── supabase/migrations/     Database schema, RLS policies and functions
├── data/                    Source dataset (CSV)
├── scripts/                 Data build script
├── tests/                   Unit tests
├── vercel.json              Build settings and security headers
└── .github/                 CI (tests, audit, build) and Dependabot
```

## Design system

All colours, type sizes, spacing, radii and shadows are tokens in [`styles/tokens.css`](styles/tokens.css), with dark-mode overrides alongside. A few rules keep it consistent:

- **Colour:** spruce (`--brand`) for primary actions and progress; marigold (`--accent`) only for *today* and the streak.
- **Type:** IBM Plex Sans for text; IBM Plex Sans Condensed (`.num`) for counts, titles and anything read like a scoreboard. Fonts are self-hosted.
- **Shape:** radius `--r-sm` for controls, `--r-md` for panels, `--r-lg` for dialogs and the Today band. Shadows only on things that float.
- **Motion:** the dashboard's bars fill once on first load; everything else moves only in response to an action. `prefers-reduced-motion` disables all of it.

## Data and privacy

Each user can read and write only their own rows (Row Level Security). Users can export everything and delete their account from the **Account** dialog (click your name in the sidebar). See [`/privacy`](privacy.html) and [SECURITY.md](SECURITY.md).
