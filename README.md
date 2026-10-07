# Spotter

Spotter is the web app a gym gives to its own members. A member signs up with the member number the gym registered for her, then logs in to ask questions answered only from the gym's approved records, generate a single use check in code, view her own attendance and balance, and pay her subscription so a confirmed payment extends her membership immediately.

## Features (MVP scope)

1. **Ask about the gym** — answers from approved shared cards the member's effective tier allows, with the source card and last confirmed date.
2. **My records** — attendance and balance from the member's own private records only. Money is reported, never ruled on.
3. **Check in** — a six digit single use code generated in the app. One check in per member per calendar day.
4. **Pay** — renewal or arrears through Flutterwave. Only a verified gateway webhook confirms a payment.
5. **Ask the desk** — names the officer on duty and opens WhatsApp with the question pre-typed.

Sign up and login are how a member reaches the app; they are not features. Owner and staff screens are input, not features.

## Status

Early MVP. What exists today:

- Member sign up, login, logout and temporary password reset (`src/app/api/auth/`, `src/server/auth/`)
- Marketing home page, member portal shell, and Privacy Policy / Terms of Service views
- Design token pipeline (`design-tokens.tokens.json` → `src/styles/tokens.css` via `scripts/convert-tokens.js`)

Auth currently uses an in-memory member store pending the database schema; it resets on every server restart. The Prisma schema has no models yet. Owner and staff routes and the remaining server modules are scaffolded but not implemented.

## Tech stack

- Next.js (App Router) + React + TypeScript
- Prisma + PostgreSQL
- pgvector for shared record similarity search (planned)
- Gemini free tier for the router, embedding and answer models, behind one interface module (planned)
- Flutterwave for payments (planned)

## Getting started

### Prerequisites

- Node.js 20.9 or later
- npm
- PostgreSQL with the pgvector extension (needed once the schema has models)

### Install

```bash
npm install
npx prisma generate
```

### Environment variables

Create `.env.local` in the repo root. Nothing in `.env*` is ever committed. The full list and its rules live in `rules/env.md`; the ones needed now or soon:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled connection used by the application |
| `DIRECT_URL` | Unpooled connection used only by migrations |
| `GEMINI_API_KEY` | Gemini models, read only by `src/server/ai/` |
| `FLUTTERWAVE_SECRET_KEY` | Server side Flutterwave API calls |
| `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave public key |
| `FLUTTERWAVE_WEBHOOK_HASH` | Compared against the incoming webhook header |
| `SESSION_SECRET` | Signs the member session cookie |
| `STAFF_SESSION_SECRET` | Signs the staff and owner session cookie |
| `APP_URL` | Public base URL, used to build gateway redirect URLs |
| `CRON_SECRET` | Authenticates the scheduled job endpoint |
| `CHECKIN_SIMULATED` | When exactly `"true"`, the simulated verifier consumes a code ten seconds after creation |

### Database

The Prisma schema is `prisma/schema.prisma`. Migrations are proposed and reviewed, never run by an agent or a script against any environment. Do not run `prisma migrate`, `prisma db push`, `prisma db seed`, `prisma db execute`, `psql`, `pg_dump` or `pg_restore`.

### Run

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npx prisma generate` | Regenerate the Prisma client after schema changes |

Before calling a change done: `npm run typecheck`, `npm run lint`, then `npm run build` all pass.

## Project structure

```
src/app/               member routes and API route handlers
src/app/owner/         owner routes (separate login, separate session cookie)
src/app/staff/         staff routes (separate login, separate session cookie)
src/components/        shared UI components
src/lib/copy.ts        the only module that holds member facing strings
src/server/auth/       sign up, login, sessions, passwords
src/server/retrieval/  vector query and chunk writes (raw SQL lives here only)
src/server/private/    every private record read
src/server/checkin/    code generation and eligibility
src/server/router/     deterministic never answer checks
src/server/payments/   gateway calls and webhook handling
src/server/jobs/       the one scheduled job
prisma/                schema and migrations
rules/                 detailed engineering rules (symlink to .agent/rules/)
docs/                  the PRD
tests/                 tests, mirroring the source path of the file tested
```

## Privacy invariants

These are load bearing and must not be weakened:

- A private record is read by the exact member ID from the server session, never from a request body.
- Private records are never searched across members and never embedded.
- Every private read writes an access log row in the same function.
- No private model name may appear in any file under `src/server/retrieval/`.

## Documentation

- `docs/spotter-prd-v3.md` — the product requirements
- `AGENTS.md` — scope, invariants and how to work in the repo
- `rules/` — commands, structure, schema, auth, retrieval, AI, check in, payments, privacy, client, jobs, copy, env, CI
