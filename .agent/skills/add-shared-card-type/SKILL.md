---
name: add-shared-card-type
description: Adds a new category of shared record card to Spotter, from schema enum through chunking, staff draft, owner approval, reindexing and tests. Use when the gym needs a kind of record the app does not hold yet, such as a guest policy, pause terms, or a new trainer guidance type.
---

# Add a shared card type

A shared card type is a category of record the gym writes once for everyone.
Adding one touches seven places. Doing five of them leaves a category that
drafts fine and never gets retrieved.

Work in this order. Do not skip ahead.

## 1. Confirm the category does not exist

Open prisma/schema.prisma and read the card category enum.

If the category is already there, stop. You are editing an existing type, not
adding one. Say so and ask what the real task is.

Checkable: you have named every existing category value in your response.

## 2. Add the enum value

Add the new value to the card category enum in prisma/schema.prisma.

Follow rules/schema.md for the change workflow. Do not apply the migration.

Checkable: the enum contains the new value, the client has been regenerated,
and you have stopped and stated that a migration is needed.

## 3. Decide the chunking behaviour

Read rules/retrieval.md and answer one question in writing: does this category
behave like a timetable or like a normal card?

A category behaves like a timetable when one record holds several independent
entries a member would ask about separately. A category behaves like a normal
card when the whole record answers one question.

If it behaves like a timetable, add a split rule for it in
src/server/retrieval/index-card.ts and say what the split key is.
If it behaves like a normal card, no code change is needed here.

Checkable: you have stated which of the two it is and why, in one sentence.

## 4. Set the review interval and minimum tier

Set two values for the category: how often the owner must reconfirm it, and
whether a Basic member may see it.

Take both from the PRD. If the PRD does not state them for this category,
write OPEN, say what you assumed, and ask.

Checkable: both values are set and their source is named, either the PRD
section or an OPEN note.

## 5. Add it to the staff draft screen

Add the category to the draft form under src/app/staff/ so staff can write a
card of this type.

The form creates a pending version. It does not make anything live.

Checkable: a staff user can select the new category and save a draft.

## 6. Add it to the owner approve screen

Confirm the owner approval screen under src/app/owner/ lists pending versions
of the new category alongside the others.

If the screen filters by category anywhere, add the new one to that filter.

Checkable: a draft of the new category appears in the owner's pending list.

## 7. Verify the reindex path

Approve one test card of the new category and confirm chunks were written for
it.

Follow rules/retrieval.md for the reindex order. If no chunks appear, the
approval should have failed. If the approval succeeded and no chunks exist,
stop and report it. That is the failure the abort rule exists to prevent.

Checkable: the chunk count for the approved version is greater than zero, and
you have stated the number.

## 8. Test tier gating and retirement

Write two tests for the new category, per rules/testing.md area 2.

Test one: a member below the minimum tier does not receive a card of this
category.
Test two: retiring a card of this category removes it from results.

Checkable: both tests exist, both run, both pass, and you have pasted the
output.

## 9. Check the launch gate count

Read the current count of approved cards.

If it is below the minimum in rules/retrieval.md, say the number and say that
the ask endpoint is still refusing questions. Do not treat this as an error.

Checkable: you have stated the current approved card count.

## Decision tree: the category holds member specific text

If the new category would hold anything that differs per member, stop.

That is not a shared card. It is a private record, and shared cards are
searched by meaning. Use the add-private-answer skill instead.