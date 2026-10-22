# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's private reporting instead: *Security → Report a vulnerability* on this repository. Expect an initial reply within 7 days.

## Architecture (what there is to protect)

AMZ Prep is a static single-page app (HTML/CSS/JS built with Vite, served by Vercel) that talks directly to **Supabase** (Postgres + Auth) using the public *anon* key.

- **There is no custom server code.** Every data access rule is enforced in the database by **Row Level Security (RLS)**: a signed-in user can read and write only rows where `user_id = auth.uid()`.
- **What's stored:** email, display name, password hash (held by Supabase Auth), per-problem progress, and notepads (text, a PNG sketch, links).
- **What isn't stored:** payment data, files, or third-party tokens.

That shapes which controls matter. The checklist below records, for every item, how it's handled.

**Legend**
- ✅ Implemented in this repo
- ☁️ Provided by the platform (Supabase / Vercel / GitHub)
- ⚙️ **Requires a one-time setting.** See [Deployment security checklist](#deployment-security-checklist).
- ➖ Not applicable to this architecture (reason given)
- 🔜 Recommended when the project grows

## Deployment security checklist

Do these once per Supabase project / Vercel project:

1. **Run every migration** in `supabase/migrations/` in filename order, then confirm RLS shows *Enabled* on `profiles`, `problem_progress` and `notepads` (Table Editor).
2. **Auth → Providers → Email:** enable *Confirm email*. Set *Minimum password length* to **8**, and *Password requirements* to **letters and digits**. Enable *Leaked password protection* if your plan has it.
3. **Auth → URL Configuration:** set *Site URL* to your production URL (e.g. `https://amzprep.vercel.app`). Add only your own domains to *Redirect URLs*: `https://amzprep.vercel.app/**`, plus `http://localhost:5173/**` for development. Never add a bare `*` or another domain.
4. **Auth → Rate Limits:** review the defaults (sign-ups, sign-ins, OTP/email sends per hour). Lower them if you see abuse.
5. **Auth → Sessions (if available on your plan):** set an inactivity timeout and a maximum session lifetime.
6. **Auth → Attack protection:** enable CAPTCHA (Cloudflare Turnstile) if bot sign-ups appear. This needs a small client change; see item 115.
7. **Auth → SMTP:** configure a custom SMTP provider for production email. The built-in sender is heavily rate-limited.
8. **Never expose the `service_role` key.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` go into Vercel environment variables.
9. **Vercel:** add the two env vars for Production and Preview. Preview deployments should point at a *separate* Supabase project.
10. **GitHub:** enable *Dependabot alerts*, *Secret scanning + push protection*, *Code scanning (CodeQL default setup)*, and *Private vulnerability reporting*. Protect `main` (require CI to pass).
11. **Database backups:** check your Supabase plan's backup schedule. Users can also export their own data from the Account dialog.

## Checklist

### Design principles

| # | Item | Status | How |
|---|---|---|---|
| 1 | Least Privilege | ✅ | `anon` has no table access; `authenticated` gets only the needed verbs; RLS limits rows to the owner; `profiles` only allows updating `display_name`. The browser only holds the anon key. |
| 2 | Defense in Depth | ✅ | Client validation → DB `CHECK` constraints → RLS → CSP and security headers → output encoding. |
| 3 | Secure by Design | ✅ | No custom backend; authorization lives in the DB, next to the data. |
| 4 | Secure by Default | ✅ ⚙️ | Tables are deny-by-default (RLS on, grants revoked). Email confirmation must be on (checklist 2). |
| 5 | Zero Trust | ✅ | Every request is authorized by RLS using the JWT. The client is never trusted, and data read back is re-validated before rendering. |
| 6 | Fail-Safe Defaults | ✅ | Missing config shows a locked screen; unknown routes fall back to the dashboard; invalid links render as `#`. |
| 7 | Separation of Duties | ☁️ 🔜 | Single maintainer today. Use branch protection and required reviews once there are collaborators. |
| 8 | Minimize Attack Surface | ✅ | No server functions, file uploads, admin pages, third-party scripts or analytics. One external origin (Supabase). |
| 9 | Keep Security Simple | ✅ | One auth provider, one policy per table, no custom crypto. |
| 10 | Complete Mediation | ✅ | RLS is checked on every query; `FOR ALL` policies cover select, insert, update and delete. |
| 11 | Open Design | ✅ | Security relies on RLS and auth, not on hiding code; the repo can be public. |
| 12 | Economy of Mechanism | ✅ | Same as #9. |
| 13 | Least Common Mechanism | ✅ | Per-user rows; no shared mutable resources between users. |
| 14 | Psychological Acceptability | ✅ | Plain-language errors, password rules shown inline, typed confirmation for account deletion. |
| 15 | Privacy by Design | ✅ | No tracking or analytics; only data needed for the features is stored. |
| 16 | Data Minimization | ✅ | Email plus optional name only. No IPs, devices or analytics stored by the app. |

### Input, output and injection

| # | Item | Status | How |
|---|---|---|---|
| 17 | Input Validation | ✅ | `src/lib/validate.js` (client) and `CHECK` constraints on every column (server). Backup imports are schema-checked (`sanitizeBackup`). |
| 18 | Output Encoding | ✅ | All dynamic text goes through `esc()` before entering HTML; `textContent` is used where possible. |
| 19 | Parameterized Queries | ☁️ | supabase-js → PostgREST builds parameterized SQL. The app never concatenates SQL. |
| 27 | SQL Injection | ☁️ ✅ | See #19. DB functions use a fixed `search_path = ''`. |
| 28 | XSS | ✅ | #18, plus a strict CSP (`script-src 'self'`, no inline scripts), and links limited to http(s) (`safeUrl`, enforced again when loaded). |
| 38 | Injection (general) | ✅ | No `eval`, `new Function` or HTML from untrusted sources without escaping; no shell or OS access. |
| 54 | API Input Validation | ✅ | DB constraints: status enum, confidence 1–4, problem id range, text lengths, PNG-only sketches ≤2 MB, ≤200 links. |
| 37 | Insecure Deserialization | ✅ | Only `JSON.parse` on user-chosen backup files, followed by strict whitelisting; files over 5 MB are rejected. |
| 32 | Remote Code Execution | ➖ | No server-side code to execute. |
| 30 | SSRF | ➖ | No server fetches user-supplied URLs. |
| 34 / 35 | Directory / Path Traversal | ➖ | No filesystem access; Vercel serves only the built `dist/`. |
| 36 / 97 / 96 | File Uploads / Malware Scanning / File Storage | ➖ | No file uploads. Sketches are validated PNG data URLs stored as size-limited text. |
| 39 | Open Redirects | ✅ ⚙️ | Auth redirects always use `window.location.origin`; Supabase accepts only allow-listed redirect URLs (checklist 3). |

### Authentication and sessions

| # | Item | Status | How |
|---|---|---|---|
| 20 | Strong Authentication | ☁️ ✅ | Supabase Auth (bcrypt, JWT). |
| 25 | Password Security | ✅ ⚙️ | Min 8 characters with a letter and a digit (client) and the same rule in Supabase settings; 72-byte max (bcrypt limit); leaked-password check (checklist 2). |
| 23 | MFA | 🔜 | Supabase supports TOTP MFA. Add an enroll/verify step if the app ever holds more sensitive data. |
| 24 | Secure Session Management | ☁️ ✅ | Short-lived JWT plus rotating refresh token; PKCE flow; the session is verified with the server on load (`getUser`). |
| 95 | Session Expiration & Invalidation | ✅ ⚙️ | Logout revokes the session; *Sign out everywhere* revokes all of them; timeouts are set per checklist 5. |
| 94 | Session Fixation | ☁️ | New tokens are issued at every sign-in; PKCE code exchange. |
| 26 | Brute Force | ☁️ ⚙️ | Supabase Auth rate limits (checklist 4). |
| 93 | Credential Stuffing | ☁️ ⚙️ | Rate limits, leaked-password protection, optional CAPTCHA. |
| 90 | Account Enumeration | ✅ | Identical messages for wrong email or wrong password; password reset always says "if an account exists"; sign-up with confirmation enabled doesn't reveal existing emails. |
| 91 | Secure Account Recovery | ✅ | Email reset link → PKCE → "choose a new password" screen; links are single-use and expire. |
| 92 | Email Verification | ⚙️ | Enable *Confirm email* (checklist 2). The app shows "check your inbox" after sign-up. |
| 46 | Secure Cookies | ➖ | No cookies are set. The Supabase session is kept in `localStorage`, which is why XSS defenses (#28, #47) matter. |
| 102 | Replay Attacks | ☁️ | Short JWT lifetime; refresh tokens rotate and are single-use. |

### Authorization and data access

| # | Item | Status | How |
|---|---|---|---|
| 21 | Secure Authorization | ✅ | RLS on every table. |
| 22 | RBAC | ➖ 🔜 | Single role (end user). Add roles only if an admin feature is ever built. |
| 31 | Broken Access Control | ✅ | Owner-only policies (`USING` and `WITH CHECK`); `user_id` defaults to `auth.uid()`. |
| 53 | API AuthN/AuthZ | ☁️ ✅ | PostgREST requires the JWT; RLS authorizes each row. |
| 56 / 57 | DB Access Restrictions / Least Privilege | ✅ | Explicit `REVOKE`/`GRANT`; `SECURITY DEFINER` functions are limited to `authenticated` with a fixed `search_path`. |
| 58 | Secure DB Configuration | ☁️ ⚙️ | Managed Postgres; keep the `service_role` key out of the client (checklist 8). |
| 89 | Admin Interface Protection | ➖ ⚙️ | No admin UI in the app. Protect the Supabase and Vercel dashboards with MFA on your own accounts. |
| 98 | Business Logic Security | ✅ | A DB constraint enforces "solved ⇔ has solve date", so the streak can't be faked through inconsistent rows. |
| 99 / 101 | Race Conditions / Transaction Integrity | ✅ | Per-problem rows (no whole-document overwrites across tabs); writes are coalesced per problem; upserts are atomic. |
| 100 | Idempotency | ✅ | All writes are upserts or deletes keyed by `(user_id, problem_id)` / `(user_id, section)`, so retries are safe. |

### Transport, headers and browser hardening

| # | Item | Status | How |
|---|---|---|---|
| 41 / 42 | HTTPS Everywhere / Encryption in Transit | ☁️ ✅ | Vercel and Supabase are HTTPS-only; CSP `upgrade-insecure-requests`. |
| 48 | HSTS | ✅ | `Strict-Transport-Security: max-age=63072000; includeSubDomains` (`vercel.json`). |
| 47 | CSP | ✅ | `default-src 'self'; script-src 'self'; connect-src` limited to Supabase; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri` and `form-action` set to `'self'`. Inline *styles* are allowed (used for dynamic widths); inline *scripts* are not. |
| 49 | Security Headers | ✅ | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. |
| 33 / 103 | Clickjacking / UI Redressing | ✅ | `X-Frame-Options: DENY` and `frame-ancestors 'none'`. |
| 29 | CSRF | ✅ | No cookie-based auth; requests carry a bearer token that other sites can't attach. |
| 50 | CORS | ☁️ | The site makes no cross-origin API of its own; Supabase handles its own CORS. |
| 110 | Secure Cross-Origin Communication | ✅ | No `postMessage` or iframes; `COOP: same-origin`; external links use `rel="noopener noreferrer"`. |
| 43 | Encryption at Rest | ☁️ | Supabase encrypts storage at rest. |

### Secrets, dependencies and supply chain

| # | Item | Status | How |
|---|---|---|---|
| 44 / 45 | Key & Secrets Management | ✅ ⚙️ | `.env*` is git-ignored; only `.env.example` is committed; values live in Vercel env vars; the anon key is public by design. |
| 73 / 74 / 75 | Dependency Security / Patching / SCA | ✅ | Two runtime/dev dependencies, pinned exactly with a lockfile; `npm audit` runs in CI; Dependabot opens weekly update PRs. |
| 84 | Supply Chain Attacks | ✅ | `npm ci` from the lockfile; no CDN scripts at runtime (everything is bundled and served from our own origin). |
| 79 | SAST | ⚙️ | Enable GitHub CodeQL default setup (checklist 10). |
| 78 | Security Code Review | ⚙️ 🔜 | Require PR review on `main` once there are contributors. |
| 83 | Security Regression Tests | ✅ | `tests/db.test.js` applies every migration to an in-memory Postgres and verifies RLS isolation, anon lockout, constraints and account-deletion cascade. Other tests cover URL sanitization, backup validation, input limits and streak integrity. All run in CI. |
| 80 / 81 / 82 | DAST / Pen Testing / Vulnerability Scanning | 🔜 | Run OWASP ZAP baseline against a preview URL before major releases. Use the Supabase *Security Advisor* (Database → Advisors). |
| 120 | Continuous Security Assessment | ✅ ⚙️ | CI, Dependabot and CodeQL on every push; review the Supabase advisors periodically. |
| 76 / 77 | SSDLC / Threat Modeling | ✅ | This document is the threat model (architecture, assets, controls). Update it when adding features. |

### Errors, logging and monitoring

| # | Item | Status | How |
|---|---|---|---|
| 62 / 63 | Secure Error Handling / No Internal Details | ✅ | Users see friendly messages only; raw Supabase errors are never displayed. Production builds ship without source maps. |
| 59 / 60 | Data Leakage / Masking | ✅ | No sensitive data in URLs or logs; one-time auth parameters are removed from the address bar; `Referrer-Policy` set. |
| 64 / 65 | Logging / Audit Trails | ☁️ | Supabase Auth audit logs (sign-ins, resets) and API logs; Vercel request logs. |
| 66 / 67 / 68 | Threat Detection / IDS / Alerting | ☁️ 🔜 | Rely on platform protections. Configure Supabase and Vercel usage alerts once there is real traffic. |
| 69 | Incident Response | ✅ | See [Incident response](#incident-response) below. |

### Availability and resilience

| # | Item | Status | How |
|---|---|---|---|
| 51 / 52 | Rate Limiting / Request Size Limits | ☁️ ✅ | Supabase Auth and API rate limits; DB caps field sizes; the client debounces writes and caps backup size. |
| 113 / 114 / 115 | DoS / WAF / Bot Abuse | ☁️ ⚙️ | Vercel's edge network and Firewall; Supabase rate limits; optional Turnstile CAPTCHA on auth (checklist 6). |
| 70 | Backup & Recovery | ☁️ ✅ | Supabase daily backups (per plan); users can export and restore their own progress. |
| 71 / 72 | DR / Business Continuity | ☁️ | Static site redeploys from git in minutes; the database is restored from Supabase backups. |
| 118 / 119 | Fail Securely / Graceful Degradation | ✅ | Failed loads and saves show a notice without exposing data; without config the app stays locked; optimistic UI keeps working and reports failed saves. |

### Privacy and compliance

| # | Item | Status | How |
|---|---|---|---|
| 61 | Personal Data Protection | ✅ | RLS isolation, encryption in transit and at rest, minimal fields. |
| 107 | Privacy Law Compliance | ✅ | `/privacy` notice; self-service data export (access and portability) and account deletion (erasure). |
| 108 | Data Retention & Deletion | ✅ | `delete_my_account()` deletes the auth user and cascades to every table. |
| 109 | Consent & Transparency | ✅ | The privacy notice is linked on the sign-in screen; no tracking, so no cookie banner is needed. |

### Infrastructure and operations

| # | Item | Status | How |
|---|---|---|---|
| 40 / 116 | Server Misconfiguration / Config Management | ✅ | All config is in git (`vercel.json`, migration SQL); no hand-edited servers. |
| 85 / 117 | Container / IaC Security | ➖ | No containers. `vercel.json` and the SQL migration are the only infrastructure-as-code, and they're reviewed in git. |
| 86 | Secure Cloud Configuration | ⚙️ | Follow the deployment checklist above. |
| 87 / 88 | Network Segmentation / Environment Isolation | ☁️ ⚙️ | Managed platforms; use separate Supabase projects for preview and production (checklist 9). |
| 111 / 112 | DNS / Domain & Certificates | ☁️ | Vercel manages TLS certificates automatically. If you add a custom domain, enable registrar lock and DNSSEC. |
| 55 | API Versioning | ➖ | No public API of our own; schema changes go through numbered migrations. |
| 104 | Third-Party Integration Security | ✅ | Only Supabase; anon key only. |
| 105 / 106 | Webhook Signatures / Payments | ➖ | No webhooks or payments. |

## Incident response

1. **Contain:** if a key or account is suspected compromised, rotate the Supabase anon key (and the JWT secret if needed) in the dashboard, update the Vercel env vars and redeploy. Use *Sign out everywhere* or revoke sessions from Supabase Auth.
2. **Assess:** check the Supabase Auth audit logs and API logs, and the Vercel logs.
3. **Fix:** patch, add a regression test, and deploy through CI.
4. **Notify:** inform affected users, and authorities where privacy law requires it.
5. **Review:** update this document.
