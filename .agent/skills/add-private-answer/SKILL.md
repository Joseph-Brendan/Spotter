---
name: add-private-answer
description: Adds a new question Spotter can answer from one member's own records, covering router intent, the private read, the access log, the code rendered template, copy, empty states and tests. Use when building attendance, balance or membership answers, or when adding a private question from the unanswered log.
---

# Add a private answer

A private answer reads one member's own records and renders the figures in
code. The model never sees the rows.

Eight steps in order. Step 5 is the one that gets skipped and it is the one
that matters most.

## 1. Confirm it is private, not shared

Write one sentence: whose records answer this question?

If the answer is "every member's the same", stop. It is a shared card. Use the
add-shared-card-type skill.

If the answer names one member's own data, continue.

Checkable: the sentence is in your response.

## 2. Add the router intent

Add the intent to the router's intent list. Read rules/ai.md for the existing
values and for the rule that the prompts are copied, not written.

If the new intent needs a parameter such as a date range, name it now.

Checkable: the intent parses out of the router response, and you have shown a
parsed example.

## 3. Validate the parameter in code

Any value the router returns is validated in application code before it
reaches a query.

Write the validation. State what happens when the value fails: the intent
becomes unclear.

Checkable: a deliberately out of range value from the router produces the
unclear path, not a query.

## 4. Write the read function

Create the function under src/server/private/.

The member ID is the first argument. Follow rules/privacy.md for the access
rules and rules/schema.md for the balance formula if this answer touches
money.

Checkable: the function signature takes the member ID first, and you have
pasted the signature.

## 5. Wire the access log

The access log row is written inside the read function, not by the caller.

Follow rules/privacy.md for the fields.

Checkable: calling the function once produces exactly one access log row, and
you have stated the row count before and after.

## 6. Render the figures in a code template

Write the template that turns the rows into the answer text.

The template is application code. Do not send the rows to the model and do not
ask the model to phrase the numbers.

Follow rules/copy.md for the wording and the placeholder convention.

Checkable: the answer text is produced with no model call in the path, and you
have stated that the model interface was not invoked.

## 7. Add the empty state

Decide what the answer says when the member has no rows.

Add the string to the copy module. Never return a zero when a read failed, and
never return an error when the correct answer is genuinely zero.

Checkable: the empty case returns a sentence, not a blank and not an error.

## 8. Write the four tests

Write the tests in rules/testing.md area 1 for this function.

The negative test is the one that counts. Build a request carrying another
member's ID and assert the response holds the caller's data.

Checkable: four tests exist, all four pass, and you have pasted the output.

## Decision tree: the answer needs a figure from the model

It does not. If you find yourself wanting the model to compute, round,
compare or summarise a number from a private record, you have taken the wrong
path.

Go back to step 6 and render it in code. If the code cannot produce it, the
data is missing, not the phrasing.