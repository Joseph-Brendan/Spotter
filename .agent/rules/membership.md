---
trigger: glob
globs: src/server/membership/**
---

# Membership

This file controls status, tier and what each one unlocks. It does not control
how a payment is confirmed. That is rules/payments.md.

Both functions below live in src/server/membership/. Nothing else computes
either value.

## Status is computed, never stored

Status is one of: active, grace, expired, cancelled.

It is computed from the expiry date, the gym's grace days and the cancellation
timestamp, by one function. Every caller uses that function.

Reason: a stored status needs a job to maintain it, that job can fail, and a paid
up member is then locked out while her expiry date says otherwise.

## Grace

Days after the expiry date during which nothing changes for the member.

The number is a field on the gym record. It is never a constant in code.

Reason: it is a business decision the owner will change, and changing it should
not need a deploy.

## Effective tier

The tier used for every access decision.

- Active or in grace: her stored tier, Basic or Premium.
- Expired or cancelled: Basic.

Only the effective tier reaches the retrieval filter. The stored tier is never
passed to a query.

Reason: without this, a lapsed Premium member keeps seeing Premium records,
because nothing in the retrieval path knows her membership lapsed.

## What expiry changes

After grace she loses Premium records and loses the ability to check in.

She keeps her full attendance history, all her receipts, every Basic record
including the price list, the ability to ask questions against Basic records,
and the ability to pay.

Reason: locking her out of her own history helps nobody, and locking her out of
the price list is the gym arguing against its own renewal. Check in is blocked
because a check in claims a visit the gym did not sell.

Cancellation behaves the same as expiry for access. It differs only in that it
starts the retention clock in rules/privacy.md.

## Pending payments

A member with a payment attempt still awaiting confirmation is never treated as
expired. Access holds for twenty four hours from the attempt.

Reason: an angry member who actually paid costs more than one day of Premium
access.

## Recording a change

Every change to tier or expiry records the old value, the new value, the reason,
who made it and when. This applies to owner edits and automatic extensions
alike.

Reason: when a member asks why her expiry moved, somebody has to answer.