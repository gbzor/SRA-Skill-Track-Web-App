# Security

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs. Email the
maintainer directly with steps to reproduce. We aim to acknowledge within 72
hours.

## OWASP Top 10 (2021) — how this app addresses each risk

| # | Risk | Mitigation |
|---|------|------------|
| A01 | Broken access control | `middleware.js` redirects unauthenticated browsers and 401s API requests. Every API handler re-checks `auth()` and scopes Prisma queries by `session.user.id`. `deleteMany({ id, userId })` prevents IDOR — you cannot delete another user's report even with a guessed id. |
| A02 | Cryptographic failures | Passwords hashed with `bcryptjs` (cost 12). JWT sessions signed with `AUTH_SECRET`. TLS terminated by Vercel; `Strict-Transport-Security` preload-ready. Session cookies are `httpOnly`, `Secure`, `SameSite=Lax`. No secrets in client bundle. |
| A03 | Injection | Prisma ORM uses parameterized queries exclusively — no raw SQL in this repo. All client input parsed with Zod (`lib/validation.js`); `.strict()` rejects unknown fields. React auto-escapes all rendered output. CSP forbids inline event handlers from untrusted origins. |
| A04 | Insecure design | XP is recomputed server-side from `pb * (score / 100) * 18` and the client value is ignored. Per-report fields are bounded (Zod ranges), so even with auth, a user cannot inflate values. Auth.js issues a single timing-equalized bcrypt compare per login (placeholder hash on miss) — no user enumeration. |
| A05 | Security misconfiguration | `next.config.js` sets a strict CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. `poweredByHeader: false`. API responses set `Cache-Control: no-store`. Prod build hides stack traces. |
| A06 | Vulnerable & outdated components | All deps pinned in `package.json`. CI runs `npm audit --omit=dev --audit-level=high` on every push. |
| A07 | Identification & auth failures | Credentials provider with bcrypt(12). Password policy: 12+ chars, requires upper, lower, and digit. `middleware.js` rate-limits `/api/auth/callback/credentials` (5 req / IP / min via Upstash sliding window). Registration is also rate-limited. Email enumeration mitigated: registration always runs bcrypt and returns 201, regardless of whether the email exists. |
| A08 | Software & data integrity failures | JWTs signed with `AUTH_SECRET`. Prisma schema is the single source of truth; `db push` / `migrate deploy` enforces it. All JSON bodies parsed through Zod with `.strict()` — unknown fields are rejected, not silently passed through. Same-origin enforcement: `originOk()` rejects cross-origin mutations; combined with `SameSite=Lax` cookies, CSRF is closed. |
| A09 | Logging & monitoring failures | Prisma logs errors in prod. Vercel captures all function logs by default — pipe them to your log drain (Datadog/Logtail/etc.) from project settings. |
| A10 | Server-Side Request Forgery | The server never fetches user-supplied URLs. All external resources (Google Fonts) are hard-coded and whitelisted in CSP `font-src` / `style-src`. |

## Hardening checklist before going to production

- [ ] Set `AUTH_SECRET` to a 32-byte random value (`openssl rand -base64 32`)
- [ ] Configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (without these, rate limiting silently no-ops)
- [ ] Run `npx prisma migrate deploy` against the production database
- [ ] Verify the deployed `/login` and `/register` pages get a green padlock and that `curl -I` shows the expected security headers
- [ ] Add a log drain in Vercel project settings
- [ ] Subscribe to GitHub Dependabot alerts on the repo

## Known limitations

- **CSP includes `script-src 'unsafe-inline'`** — Next.js injects inline scripts to hydrate; a nonce-based CSP would require disabling some Next.js features. The `frame-ancestors 'none'` directive still prevents framing; the trade-off is that an XSS in a third-party dependency could execute. Mitigations: tight dependency review, Dependabot, CSP report-only collection if needed.
- **No password reset flow** in this version. Users who forget a password must be reset by an operator (manual DB update). A reset flow would require an email provider (e.g. Resend).
- **No 2FA**. For a single-user tracker this is acceptable; in a multi-tenant deployment, add TOTP via `otplib` or use a provider that supports it.
