---
trigger: glob
globs: .env, .env.example
---

# Environment variables

OPEN, read first: only the two database variables come from the PRD. The rest of
these names are proposed. Confirm them before the first deploy.

This file lists every variable and where it is set. It does not explain what the
services do.

## Rules

- Every variable is read in src/lib/env.ts and nowhere else. That module
  validates every variable at startup and exports a typed object.
  Reason: a missing variable should fail on boot with a clear message, not at
  two in the morning inside a webhook handler. rules/ci.md check 5 enforces
  this.
- No variable is ever logged, echoed in an error message, or returned in a
  response.
  Reason: error responses end up in screenshots and support threads.
- Nothing here is ever committed. rules/git.md owns that rule.
- Every variable marked secret is set only in the hosting provider's dashboard.

## The variables

Database

- DATABASE_URL          secret. Pooled connection. Used by the application.
- DIRECT_URL            secret. Unpooled connection. Used only by migrations.

Two strings exist because serverless functions exhaust connections against an
unpooled endpoint. The application never uses DIRECT_URL.

Models

- GEMINI_API_KEY        secret. Read only by the interface module in
                        src/server/ai/.

Payments

- FLUTTERWAVE_SECRET_KEY    secret. Server side API calls.
- FLUTTERWAVE_PUBLIC_KEY    not secret, but set here, never hardcoded.
- FLUTTERWAVE_WEBHOOK_HASH  secret. Compared against the incoming webhook
                            header. See rules/payments.md.

Application

- SESSION_SECRET        secret. Signs the member session cookie.
- STAFF_SESSION_SECRET  secret. Signs the staff and owner session cookie.
  Two secrets, because one compromised secret should not mint both kinds of
  session.
- APP_URL               the public base URL. Used to build gateway redirect
                        URLs. Never inferred from a request header.
  Reason: a request header is attacker controlled, and a redirect built from one
  sends the member to someone else's site.
- CRON_SECRET           secret. The job endpoint rejects any request without it.

Check in

- CHECKIN_SIMULATED     not secret. When true, the simulated verifier consumes a
                        member's active code ten seconds after it is created.
                        Defaults to false when unset or unparseable.

  This is the only variable whose default matters for correctness. Off by
  default means a misconfigured deployment produces codes that are never
  consumed, which is visibly broken. On by default would produce fake attendance,
  which is invisibly wrong.

  The validation module treats any value other than the exact string "true" as
  false. Do not accept "1", "yes" or "TRUE".

  Reason: a loose parser is how this ends up on in production.

- CHECKIN_VERIFY_SECRET secret. Required only when the real keypad verifier
                        exists. The keypad sends it in a header. Until then it
                        is unset and the verify endpoint is not deployed.

## Adding a variable

Ask first. Name it, say which module reads it, say whether it is secret, and add
it to .env.example in the same change.