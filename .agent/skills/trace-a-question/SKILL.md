---
name: trace-a-question
description: Diagnoses one logged Spotter question backwards from its recorded outcome to find why the answer was wrong, missing or refused. Use when working the owner's weekly review page, a wrong answer report, an unanswered question, or a blocked answer.
---

# Trace a question

A wrong answer has five possible causes and they live in five different
files. Start from the logged outcome, not from the prompt.

Most of these are not prompt problems. Fix the prompt last, or not at all.

## 1. Pull the log row

Find the question log row by its ID.

Read and state four values: the question text, the outcome, the top score, and
the cited card version IDs.

Checkable: all four values are in your response.

## 2. Branch on the outcome

Go to the section below that matches the outcome. Do not read the others.

## Outcome: refused on policy

The question hit the never answer list.

1. Read whether the rules layer or the router refused it. The log records
   which.
2. If the rules layer refused it, find the pattern that matched.
3. Decide in one sentence whether the refusal was correct.

If it was correct, stop. A correct refusal is not a bug.

If it was wrong, the pattern is too broad. State the pattern and the narrower
version. Follow rules/ai.md before changing anything in the pattern list.

Checkable: you have named which guard fired and whether it was right.

## Outcome: blocked as ungrounded

The answer contained a digit sequence that appears in no source record and not
in the question.

1. Read the discarded answer text and the cited chunks.
2. Find the digit sequence that did not match.
3. Decide which of two things happened. Either the model invented a figure,
   which means the check worked and there is nothing to fix. Or the figure was
   in the card in a different form, which means the card needs rewording.

Never widen the check to let the answer through.

Checkable: you have named the exact digit sequence that failed.

## Outcome: no answer

Work these four in order and stop at the first one that explains it.

1. **Does a card exist at all?** Search the approved cards for the subject. If
   none holds the answer, the fix is a new card. Stop here.
2. **Was it filtered out by tier?** Check the asking member's effective tier
   against the card's minimum tier. If the card was above her tier, the system
   behaved correctly. Stop here.
3. **Was it filtered out by card status?** Check whether the card is approved
   and whether its version is the current one. A retired or superseded card is
   invisible by design. Stop here.
4. **Did it fall below the threshold?** Read the top score. If a correct card
   scored below the threshold, the chunking or the threshold is the problem.
   Read rules/retrieval.md before changing either, and change the chunking
   first.

Checkable: you have named which of the four it was, and stated the number or
status that proves it.

## Outcome: answered, but the member reported it wrong

1. Read the cited card version and its last confirmed date.
2. Compare the card text to what is true in the gym today.

If the card is stale, the fix is a reconfirm or an edit by the owner, not a
code change. Say so and stop.

If the card is current and the answer still misread it, state the exact
sentence in the card that was misread.

Checkable: you have quoted the card sentence and the answer sentence side by
side.

## Outcome: error

The failure was mechanical, not editorial.

Read the latency and the stage budgets in rules/ai.md. State which stage
exceeded its budget, or state that the failure came from somewhere else.

Checkable: you have named the stage or ruled all of them out.

## 3. Report before you fix

Write four lines: the cause, the file that owns it, the smallest fix, and
whether the fix is code, a card, or neither.

Do not change code until those four lines exist.

Checkable: the four lines are in your response.

## Decision tree: several reports look the same

Group them by cause before fixing anything. Five reports with one cause is one
fix.

If three or more reports share a cause, say that in the report. A repeating
cause is a rules or corpus problem, not a one off.