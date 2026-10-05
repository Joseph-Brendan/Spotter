---
trigger: always_on
---

# Copy

This file holds the member facing strings that are fixed. Copy them exactly.

Every string lives in src/lib/copy.ts and is imported from there. No member
facing string is written inline in a component.

Reason: these words were chosen for legal and trust reasons, a one word change
can reverse a deliberate product decision, and a string pasted into a component
drifts the first time someone edits that component.

## Placeholders

Placeholders are written in braces and are the only thing you may substitute:
{name}, {amount}, {date}, {code}, {seconds}. Nothing else in a string changes.

## Refusals

Records refusal, when the gym has no record:
  "I do not have that in the gym's records."
Nothing is added. No apology, no suggestion, no near answer, no description of
what most gyms do.

Medical refusal:
  "I cannot answer questions about injuries or health. Please speak to {name} or
  your doctor."

Door refusal:
  "I cannot tell you whether the door will open. Please speak to {name}."

Every refusal names a specific person, never "the front desk".

Reason: a named person gets messaged. A department does not.

## Money

Balance answers report, they never rule.

Correct:
  "Our records show {amount} outstanding for {date}."
Forbidden:
  "You owe {amount}."

Every balance answer ends with:
  "Correct as of {date}, based on payments recorded here."

Reason: the first can be corrected without anyone losing face. The second starts
an argument at the front desk. Same data, different cost.

## Stale figures

When a cached balance is more than twenty four hours old, hide the figure and
show:
  "Open to refresh"

## Empty states

  "No check ins recorded for {date}."
  "No payments recorded yet. Ask the front desk if you paid in cash."
  "0 days this month"
The last one is a number, not an error.

## Sign up

  "Enter the member number on your gym card."
  "We could not find that member number. Check it with the front desk."
  "That member number already has an account. Ask the front desk for help."
  "That email is already registered."
  "Use at least eight characters."

The member number messages distinguish not found from already claimed, because
both send her to the desk and the desk needs to know which one it is.

Reason: this is the one place where a specific error is safer than a vague one.
A member number is not a secret, and a vague message here produces a phone call
the desk cannot resolve.

## Login

  "That email and password do not match."

One message covers a wrong email and a wrong password alike. It never says which
one was wrong and never says whether the email is registered.

  "Too many attempts. Try again in fifteen minutes."

## Temporary password

  "Set a new password to continue."
  "That temporary password has expired. Ask the front desk for a new one."
  "Ask the front desk for a temporary password to reset your account."
  "Password changed. You can now log in."

## Check in

  "Type this code at the door"
  "Expires in {seconds} seconds"
  "Checking you in"
  "Checked in"
  "That code expired. Tap to get a new one."
  "You are already checked in today"
  "The gym is closed right now. Check in when it opens."
  "Renew to check in"
  "Still confirming. Keep this screen open."

The last one is shown when polling fails. It never says the check in failed,
because the code may already have been consumed.

Reason: telling her it failed when it succeeded makes her try again, and the one
per day rule then refuses her, and she believes the app lost her visit.

## Payments

  "We are confirming a payment of {amount} from {date}."
  "Nothing due."
  "Payment could not start. Try again or pay at the desk."
  "Enter your password to continue."

## Errors

Model or retrieval unreachable:
  "I cannot reach the gym's records right now"
Private records unreachable:
  "I cannot read your records right now"

Never return a zero when a read failed. A zero is an answer. An error is not.

## Card age

When a card is past its review date the answer carries:
  "This was last confirmed on {date}."

Reason: the age of a record is never hidden from the member.

## Metadata

  "Official gym member portal"

## Navigation

  "Get Started"
  "Get Started for Free"

## Marketing

  "Check in, view your records and balance,"
  "and get verified gym answers."

Stored as heroSubtitleLead and heroSubtitleTail. The tail renders on its own
line.

## Tone for anything not listed

Plain English. Short sentences. Active voice. No em dashes. No apology. No
follow up question. No offer of further help.

If you need a string that is not here, write it in that tone, flag it in your
response, and add it to this file and to src/lib/copy.ts in the same change.

## OPEN

The PRD assumes English. Whether any other language is needed is not stated. Ask
before adding any translation machinery.