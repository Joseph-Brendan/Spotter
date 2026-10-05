---
trigger: glob
globs: src/server/payments/**, src/server/api/payments/**
---

# Payments

This file controls money in and the membership extension that follows. It does
not control what a tier unlocks. That is rules/membership.md.

The gateway is Flutterwave. Any reference to another gateway in any document in
this repo is void. Do not copy fee figures or webhook shapes from those
references.

All amounts are in Nigerian naira, stored in kobo as whole numbers.

## The app never holds money

No wallet, no stored balance, no card details. Funds settle from the gateway
into the gym's own bank account.

Reason: holding other people's money pulls this into licensing it cannot afford.

## Amounts

- A renewal amount comes from the membership plan record for the member's tier.
- An arrears amount comes from the ledger sum.
- Never parse an amount out of a price card. That card is prose for humans.

Reason: a typed sentence is not a number, and the day someone rewords the card
the payment breaks.

## Re authentication

The member re enters her password before any payment starts.

Version two used a four digit PIN. The PIN no longer exists. See rules/auth.md.

Reason: the session lasts ninety days and is not bound to a device, so the
password is the only thing that confirms the person paying is the account
holder.

## Initiating

- The client generates an idempotency key and sends it with the purpose, renewal
  or arrears.
- The server generates the transaction reference. The client never supplies one.
  Reason: a client supplied reference can be made to collide with another
  member's.
- The server creates an attempt record with that reference before calling the
  gateway.
- The idempotency key is unique in the database. A repeat with the same key
  returns the existing attempt instead of creating a second charge.

## Confirming

Only a verified webhook confirms a payment. The browser redirect is a hint and
never proof.

Verification has two parts and both are required:

1. Compare the secret hash header on the incoming request against the stored
   value. Reject and log anything that does not match.
2. Call the gateway's own verify endpoint for that transaction and confirm the
   status, the amount and the currency match what was initiated.

Reason for the second part: this gateway's webhook header is a shared secret
rather than a signature over the request body, so the header alone does not
prove the body was not altered. The verify call is what makes the confirmation
trustworthy.

Confirm the exact header name, verify endpoint and field names against the
current Flutterwave documentation before implementing. Do not write them from
memory.

## What confirmation does

In one database transaction:

- Mark the attempt successful.
- Create the payment record.
- Create the ledger entry.
- If the purpose is renewal, extend the expiry date by the plan duration,
  counted from the later of today and the current expiry.
- Record the membership change with the payment reference as the reason.

All of it, or none of it.

Reason: money and access must never disagree. A member who pays at nine at night
can generate a check in code at seven the next morning with no staff action in
between. Without this, paying in the app is slower than paying cash at the desk.

## The receipt

Created on confirmation and never deleted. It shows the amount, the date, the
reference and the channel. It survives expiry and cancellation.

Reason: it is the artefact that ends the dispute in the PRD's failure scene.

## Losing the network mid payment

The attempt stays pending. On reopening, it sits at the top of her screen. The
webhook resolves it whenever it arrives.

An attempt still pending after twenty four hours is marked abandoned by the
nightly job and surfaced to the owner. It is never marked failed without gateway
confirmation, because the money may have moved.

## Cash and transfers

- Recorded by the owner with member, amount, date and channel, stamped with who
  recorded it.
- The owner marks whether it is a renewal. If it is, the extension rule above
  applies identically.
- Neither the payment nor its ledger entry can be deleted. A mistake is
  corrected with a visible offsetting entry.

Reason: a member who pays cash must be renewed by the same rule as a member who
pays in the app.

## The same day rule and the balance gate

Cash and transfer payments must be recorded on the same calendar day they are
received.

Balance answers do not go live until the desk has shown fourteen consecutive
days of same day entry, measured as the gap between the payment date and the row
creation date. Until then, the my records feature answers attendance only.

Reason: the app telling a member she owes money she already paid poisons every
other answer it has ever given, including the correct ones. This is a staffing
commitment, and the gate is how it gets honoured.

## Fees

The gym absorbs the gateway fee. The member sees a single amount with no line
items.

Reason: adding the fee at checkout makes the app the expensive way to pay, she
walks to the desk with cash, and the ledger problem returns.

## OPEN

The PRD quotes fees for a different gateway and marks them void. Get the current
Flutterwave rate for local cards, including any cap and any waiver band, before
any pricing or break even figure is used.