---
trigger: always_on
description: Whenever the agents need to run commands in the codebase
---

# Commands

The package manager is npm. Script names below are confirmed against package.json.

This file holds every command you may run. It holds nothing else.
If a command you need is not here, ask. Do not invent a script name.

## Setup

- Install dependencies: npm install
- Generate the database client: npx prisma generate

Run both after any pull that changes package.json or prisma/schema.prisma.
The client is generated code and it goes stale silently.

## Daily work

- Start the dev server: npm run dev
- Typecheck: npm run typecheck
- Lint: npm run lint
- Format: npm run format
- Run tests: npm run test
- Run one test file: npm run test -- <path>

## Before you claim a change works

Run these three, in this order, and paste the output:

1. npm run typecheck
2. npm run lint
3. npm run test

All three must pass. A change that typechecks but fails lint is not done.
Pasting the output is the requirement. A summary of the output is not.

## Build

- Production build: npm run build

Run this before any pull request. The dev server tolerates errors the
production build rejects, so a green dev server proves nothing.

## When a command fails

Report the failure and stop. Paste the error verbatim.

Do not work around a failing command, do not skip it, and do not change a
script in package.json to make it pass. Ask before editing any script.

Reason: a command edited to go green removes the only signal you had.

## Commands you may never run

- Any database migration or write command: prisma migrate dev, prisma migrate
  deploy, prisma migrate reset, prisma db push, prisma db seed, prisma db
  execute.
- Any direct database client: psql, pg_dump, pg_restore.
- Any script that opens a database connection and writes.

Reason: a migration against the wrong connection string destroys real member
records and there is no undo.

This list is the authoritative ban. Other rules files point here rather than
repeating it. rules/schema.md says what to do instead.