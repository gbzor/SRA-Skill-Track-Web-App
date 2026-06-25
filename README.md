# SRA Tracker

Mobile-first Next.js 14 app for tracking SRA color-level reading progress. Email/password auth, Postgres-backed per-user reports, deployable to Vercel's free tier.

See [SECURITY.md](SECURITY.md) for the full OWASP Top 10 mapping and hardening checklist.

## Stack

| | |
|---|---|
| Framework | Next.js 14 App Router (JavaScript, no TS) |
| Auth | Auth.js v5 — Credentials provider, JWT sessions, bcrypt(12) |
| Database | Postgres via Prisma (works with Vercel Postgres / Neon / Supabase) |
| Validation | Zod with `.strict()` on all body schemas |
| Rate limiting | Upstash Redis sliding window (free tier) |
| Headers | Strict CSP, HSTS, XFO=DENY, COOP, CORP, Permissions-Policy |
| Hosting | Vercel (free tier) |

## Local setup

```bash
git clone <your-repo>
cd <your-repo>
npm install
cp .env.example .env
# Fill in DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npx prisma migrate dev --name init   # creates tables + a migration file
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial SRA Tracker"
git branch -M main
git remote add origin <your-github-repo>
git push -u origin main
```

`.env` is gitignored — verify with `git status` that no `.env*` files are staged.

### 2. Import in Vercel

- vercel.com → **Add New → Project** → pick your GitHub repo
- Framework preset auto-detects as Next.js

### 3. Provision the database

In the Vercel dashboard for this project: **Storage → Create Database → Postgres**. Vercel automatically attaches `DATABASE_URL` (and a few other Postgres-prefixed vars) to your project.

### 4. Set environment variables

In **Project Settings → Environment Variables**, add:

| Name | Value | Required |
|------|-------|----------|
| `AUTH_SECRET` | `openssl rand -base64 32` output | ✅ |
| `UPSTASH_REDIS_REST_URL` | from upstash.com Redis dashboard | ⚠️ recommended |
| `UPSTASH_REDIS_REST_TOKEN` | from upstash.com Redis dashboard | ⚠️ recommended |
| `DATABASE_URL` | set automatically by Vercel Postgres integration | ✅ |

Without the Upstash vars, rate limiting silently becomes a no-op. **Set them before opening the app to real users.**

### 5. Run database migrations (one-time)

Vercel won't run migrations for you. From your local machine, with the production `DATABASE_URL` exported:

```bash
# Get the URL from the Vercel Postgres dashboard → Settings → ".env.local"
DATABASE_URL="<prod-postgres-url>" npx prisma migrate deploy
```

Re-run this command whenever you add a new migration.

### 6. Deploy

Vercel builds + deploys automatically on every push to `main`. Visit `https://<your-project>.vercel.app/register` to create your first account.

## Commands

| | |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:migrate` | Create a new migration (dev) |
| `npm run db:deploy` | Apply pending migrations (prod) |
| `npm run db:push` | Push schema without a migration (early dev only) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run audit` | `npm audit` against prod deps only |

## What changes if you fork this

- `LICENSE` is MIT — update the copyright line if you publish
- The hardcoded SRA color ladder and guide content live in `app/page.js`
- The XP formula `pb * (score / 100) * 18` lives in `lib/validation.js` (`computeReportXp`)
