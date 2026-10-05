---
trigger: glob
globs: src/server/retrieval/**
---

# Retrieval

This file controls how a shared record is found. It does not control what the
model does with it. That is rules/ai.md.

## What is indexed

Only chunks belonging to an approved card version whose parent card is also
approved.

Nothing private is indexed. rules/privacy.md holds the list and rules/ci.md
enforces it.

## Chunking

- A card under two hundred and fifty words is one chunk: title plus body.
- A longer card splits on blank lines into chunks of at most two hundred words,
  with the title prepended to each.
- A timetable splits into one chunk per day of the week, prefixed with the day
  name.

Reason for the title on every chunk: a chunk without its subject matches badly.
Reason for the timetable rule: a Saturday question should match a Saturday
chunk, not compete with six other days in one block of text.

## The query

A chunk is returned only when all four hold:

- Its parent card is approved.
- Its card version is approved.
- Its card version is the card's current version.
- Its tier is at or below the member's effective tier.

The version and the current version pointer are checked separately because an
older version can still be approved after a newer one replaces it. Checking only
the status would return both.

Reason for the card status condition: it is what makes retirement work.
Retirement takes effect through the query. Deleting chunks is cleanup, and
correctness must not depend on a delete succeeding.

## What comes back

Five results, at most. Each row carries the chunk text, the card title, the card
version body and the card's last confirmed date, because the answer screen shows
all four and a second query for them is wasted latency.

## Filter before ranking

The tier filter runs in the query, before ranking. Never after.

Reason: filtering afterwards ranks records the member may not see, drops them
all, and returns nothing, while the record that answers her sat one place below
the cut.

## The threshold

Results below 0.70 cosine similarity are dropped in application code before
anything else happens.

It is a starting point, not a finding. The top score is logged on every question
so it can be recalibrated against real questions after two weeks.

## When nothing survives

Return the refusal. Do not call the answer model.

Reason: a model called with no records attached has only its general knowledge to
answer from, which is the one thing this product must never do.

## Minimum corpus

The ask endpoint refuses to serve any question while fewer than thirty cards are
approved. This is a runtime check, not a launch note.

Reason: a member who gets "I do not have that" twice never opens the app again.

## Reindexing

Order matters.

1. Generate the chunks. No database writes.
2. Call the embedding API for every chunk, outside any transaction.
3. If any call fails, abort. The approval fails and nothing has changed.
4. Open a transaction. Delete the old chunks, insert the new ones, set the
   version status, set the current version pointer, set the confirmed date.
   Commit.

Never hold a database transaction open across a network call. It holds locks for
an unknown time and will time out on a pooled connection.

Reason for aborting at step 3: an approved card with no chunks is invisible to
search, so the app would say it has no record for something the gym does have.

## Reconfirming without editing

Updates the confirmed date only. No reindex, no embedding call.

## Changing a card's tier

Updates the chunk rows in place. The text did not change, so the vectors are
still valid.

## Writes

All chunk reads and writes are raw SQL in the two files named in AGENTS.md.
Parameters are always bound. No string interpolation into SQL, anywhere, ever.

## Indexes

Ship with no approximate index. At this corpus size an exact scan takes
milliseconds, and an approximate index trades exactness for a gain nobody can
perceive. Revisit above five thousand chunks.