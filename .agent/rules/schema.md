---
trigger: glob
globs: prisma/**
---

# Schema

This file holds the rules the schema file cannot express, and the workflow for
changing it. It does not list every field.

Source of truth for field names: docs/spotter-prd-v3.md section 8.5 for what
version three changed, and the version 2.0 schema block for everything else,
until prisma/schema.prisma exists. After that, the schema file is the source of
truth. Never copy field names from any other file, including this one.

## Workflow for a schema change

1. Edit prisma/schema.prisma.
2. Run the client generation command and the typecheck from rules/commands.md.
3. Stop. Say: schema changed, migration needed, and describe what it does.

You may edit the schema. You may never apply it. rules/commands.md holds the
banned command list.

One migration per logical change. Never bundle an unrelated field into a
migration about something else.

Reason: a migration is the one action here with no undo, so the diff must be
readable in one sitting.

## Columns that must not exist

No status column
- Membership status has no column and no maintaining job.
- rules/membership.md owns the computation and the reason.

No balance column
- Balance has no column on any model.
- It is the sum of one member's ledger rows, computed by a single function in
  src/server/private/.
- Reason: a stored total and a list of entries will disagree, and you will not
  know which one is lying.

No PIN column and no device column
- Version three removed both. Identity is email and password.
- Reason: leaving a dead column invites code that reads it.

## Rules the schema cannot enforce

Ledger sign convention
- Positive increases what the member owes. Negative reduces it.
- Every amount is stored in the smallest currency unit, as a whole number.
- Reason: two developers reading "amount" will pick opposite signs, and
  fractional money in a float loses a unit every few thousand rows.

Money fields are plain integers, not big integers
- Reason: a big integer does not serialise to JSON in a route handler and throws
  at runtime. These amounts never approach the integer limit.

The embedding column
- Declared as an unsupported type. A database check constraint requires it to be
  present.
- That constraint lives in a hand written migration. It is never dropped and
  never made optional.
- The ORM client cannot set the column, so a client create call always fails.
  All writes go through raw SQL. See rules/retrieval.md.
- Reason: the constraint makes the failure loud instead of leaving rows with no
  vector, which would make cards silently unsearchable.

Email is unique and stored lowercase
- The uniqueness is a database constraint, not an application check.
- Reason: two simultaneous sign ups with the same email will both pass an
  application check and both insert.

Member number is unique per gym
- Also a database constraint.
- Sign up looks a member up by this number, so a duplicate would attach an
  account to the wrong record.

One account per member record
- A member record holds at most one set of account fields. Sign up against a
  record that already has them fails.
- Reason: two accounts on one record means two people reading one member's
  private data.

Active check in codes are unique
- No two unconsumed, unexpired codes may hold the same digits.
- This cannot be expressed as a plain unique constraint, because it applies only
  to rows that are unconsumed. It goes in a hand written migration as a partial
  unique index on the code column where the consumed timestamp is null.
- Reason: a keypad receives digits and nothing else. Two matching active codes
  means an ambiguous entry and the wrong member credited.

One attendance record per member per day
- A unique constraint on the member and the date.
- Reason: the one per day rule in rules/checkin.md must survive a double tap and
  a keypad retry arriving at the same moment.

Records that cannot be edited or deleted
- A gateway payment, and any ledger entry, is never edited or deleted by anyone.
- A mistake is corrected with a new offsetting entry that stays visible.
- Reason: an editable money record is worth nothing in a dispute, and ending
  disputes is why this product exists.

Every change to tier or expiry is recorded
- Old value, new value, reason, who, when.
- Reason: when a member asks why her expiry moved, somebody has to answer.

## Indexes

Add an index only for a query that exists in the code. Do not index a two value
column on a small table.

Reason: the planner will ignore it, so it is a write cost pretending to be an
optimisation.

The check in code table needs one index the others do not: a lookup by digits
filtered to unconsumed and unexpired rows. The verifier runs it on every
consumption attempt and it must not scan.

## Adding a model

Ask first. If it holds data belonging to one member, mark it private in a schema
comment and add it to the list in rules/privacy.md in the same change.