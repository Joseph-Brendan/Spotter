---
trigger: always_on
---

# CI

This file holds the build time checks that block forbidden code paths. Each one
exists because a rule stated elsewhere decays without enforcement.

Every check fails the build on a match. None of them warn.

## Check 1: no database client in route handlers

Fail if the database client is referenced anywhere under src/app/.

Enforces: only files under src/server/ import the client.
Reason: a query written inline in a route handler skips the private read
wrapper, the access log and the member ID guard.

## Check 2: no client creation of chunk rows

Fail if a client create or update call against the chunk model appears anywhere.

Enforces: chunk writes are raw SQL only.
Reason: the call cannot succeed anyway. This turns a runtime failure into a
build failure.

## Check 3: no private model inside retrieval

Fail if any private model name appears in any file under src/server/retrieval/.

The list lives in rules/privacy.md. Adding a private model means adding it to
this check in the same change.

Enforces: private data never reaches the search path.
Reason: the protection is structural. Retrieval code has no reason to know
private models exist.

## Check 4: no raw SQL outside retrieval

Fail if a raw query or raw execute call appears outside the two files named in
AGENTS.md.

Reason: raw SQL is where the member ID filter gets forgotten.

## Check 5: no direct environment access

Fail if process.env is referenced outside src/lib/env.ts.

Reason: a variable read in ten places is validated in none.

## Check 6: no banned database commands in scripts

Fail if any package.json script or any file under scripts/ contains a migrate,
db push, db reset or db seed command.

Reason: rules/commands.md bans you from running them. This stops you writing a
script that runs them for you.

## Check 7: server modules carry the server guard

Fail if any file under src/server/ does not import the server-only guard.

Enforces the boundary in rules/structure.md.
Reason: the guard is what turns a bad import into a build error instead of a
leaked key.

## Check 8: attendance is written in one place

Fail if a create call against the attendance model appears anywhere except
src/server/checkin/verifier.ts and the staff manual check in module.

Enforces: a check in code is consumed in one place, and attendance is written
there.
Reason: attendance feeds the stop metric. A second write path would produce
records with no code behind them and nobody would notice until the number
stopped meaning anything.

## Check 9: no password or code value in a log call

Fail if a log call takes a variable named password, passwordHash, tempPassword,
or code.

This is a coarse check and it will catch a few false positives. Rename the
variable or restructure the log line.

Reason: a password or an active check in code in a log line is the cheapest
possible leak, and a name based check catches the common case for almost no
effort.

## Running order

These run before typecheck. A structural violation makes the type result
irrelevant.

## OPEN

The implementation is not specified. A shell script using grep covers all nine
and needs no dependency. These must exist before the first feature merges, not
after.