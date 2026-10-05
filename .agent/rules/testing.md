---
trigger: model_decision
description: Read when writing, changing, or deciding whether to write a test
---

# Testing

OPEN, read first: no test framework is chosen. Choosing one is a package
addition, so ask before writing the first test.

This file says what must be tested. rules/commands.md says how to run tests.

## The rule

Five areas need a passing test before a change to them merges. Nothing else is
mandatory.

Reason: a blanket coverage target produces tests for getters. These five are
where a silent regression costs money, exposes a member, or corrupts the one
number the product is measured on.

## 1. Private record access

For every function under src/server/private/, prove:
- It returns the calling member's rows and nothing else.
- A member ID in the request body is ignored.
- It writes an access log row.

The negative test matters most. Build a request carrying another member's ID and
assert the response holds the caller's data.

These tests need a real database. A mocked client proves only that your mock
behaves, and the rule being tested is about what the database returns. Until a
disposable test database exists, say so and do not claim this area is covered.

## 2. Tier gating

Prove:
- A Basic member never receives a Premium record.
- A member past grace is treated as Basic regardless of her stored tier.
- A retired card never appears in results, even when its chunks still exist.

Reason: all three fail silently. The app keeps answering and the answers are
wrong.

## 3. Refusals

Prove:
- Each never answer category triggers a refusal.
- The refusal happens before any model call. Assert the model interface was not
  called.
- A refusal from the rules layer and a refusal from the router both refuse.

Reason: this boundary protects against medical harm and against exposing another
member, so it cannot rest on a model behaving.

## 4. Payment confirmation

Prove:
- An unverified webhook changes nothing.
- The same idempotency key twice produces one charge.
- A confirmed renewal extends the expiry date in the same transaction that
  records the payment.
- A member with a pending payment is not treated as expired.

Reason: money and access move together, so a wrong confirmation grants
membership as well as clearing a debt.

## 5. Check in

Prove:
- Generating twice in one day produces at most one code and one attendance
  record.
- Consuming the same code twice writes one attendance record and returns
  without error the second time.
- A code older than five minutes is refused by the verifier.
- Two active codes cannot hold the same digits. Force the collision and assert
  the database constraint rejects it.
- With the simulation flag off and no real verifier configured, a generated code
  is never consumed.
- Generation is refused outside opening hours, and refused for a member past
  grace.

The double consumption test matters most. A keypad retries, and a retry that
writes a second record breaks the one per day rule from the outside.

Reason this area is mandatory: check in feeds the attendance number, the
attendance number is the stop metric, and a bug here makes a failing product
look like a passing one.

## 6. Auth, worth testing but not mandatory

Two cases are worth a test even though this area is not on the mandatory list:

- Sign up against a member number that already has an account fails and creates
  nothing.
- Changing a password revokes other sessions.

Both are cheap and both protect a member's private records.

## How to write them

- Test through the exported function or the route, not through internals.
  Reason: a test coupled to internals fails on every refactor and gets deleted.
- Mock the model calls and the gateway. Never mock the thing under test.
- Never mock the verifier when testing check in. Use the simulated
  implementation with its delay reduced, because the verifier is the thing under
  test.
- Never point a test at a live gateway or a production database.

## What not to test

- Generated client code and framework behaviour.
- Prompt output. Test the code around the model.
  Reason: asserting on model output produces a flaky test that will be muted.