---
trigger: glob
globs: src/server/ai/**, src/server/router/**
---

# AI

This file controls the model calls. It does not control what is searched. That
is rules/retrieval.md.

## One interface

Every model call goes through a single module in src/server/ai/. Nothing else in
the codebase calls a model provider.

Reason: the free tier this runs on can change shape without notice. Swapping the
provider should cost an hour, not a week.

## Three calls, in this order

1. The rules layer. Deterministic, no network.
2. The router. One model call returning JSON only.
3. The answer. One model call, only if retrieval returned usable records.

## The rules layer

A deterministic check in src/server/router/rules.ts runs before any model call.
A hit refuses immediately with no network call at all.

It covers five categories: medical, another member, door access, money
decisions, staff conduct. The pattern list lives in that file. The member name
list is loaded from the database and refreshed hourly, and a member matching her
own name does not trigger the rule.

Reason: a model classifier is probabilistic. The never answer list protects
against medical harm and against exposing another member, and those boundaries
do not rest on a model behaving.

## Both guards refuse

A refusal from the rules layer or from the router refuses. They are not weighed
against each other and there is no tie break.

Reason: a false positive from the rules layer sends the member to a named person,
which is a safe failure. A false negative from the model is caught by nothing.

## The prompts

Prompt files live in src/server/ai/prompts/, one per prompt, as named in
rules/structure.md. The canonical text is in docs/spotter-prd-v2.md sections 7.4
and 7.7.

Copy them exactly. Never paraphrase, tighten or improve a prompt. To change one,
say what you want to change and why, and wait.

Reason: changing a prompt changes behaviour with no diff that looks dangerous.

## Temperature

Zero, on both calls.

## The router output

Parse as JSON. The intent is one of six values: shared question, private
attendance, private balance, private membership, refused policy, unclear. The
payload also carries an optional date range and an optional refusal reason.

If the output does not parse, reparse once after stripping any code fence. If it
still does not parse, record an error outcome and hand off. Never guess the
intent from the raw text.

Any date the router returns is validated in code against a five year window
before it reaches a query. Out of range becomes unclear.

Reason: the router is the only place a model influences a database query, so it
is the only place that needs this guard.

## Retries

One retry on the router call. No retry on the answer call.

Reason: the router is cheap and deterministic enough to repeat. Retrying the
answer doubles the member's wait for an outcome she is about to be handed off
from anyway.

## The private path

When the router returns a private intent, retrieval is skipped entirely. No
embedding is generated and the vector store is not touched. The answer model is
not called. Figures are rendered by code from a fixed template.

Reason: a model that never touches a number cannot garble one.

## The grounding check

Runs on every answer model output.

Extract every digit sequence from the answer after stripping separators and
currency symbols. Every one must appear in the source records or in the question.

Numbers written as words are not checked. Normalising every spelled form is
unreliable and the false positives would be constant. The check catches the
invented price and the invented time, which are the failures that cost most.

On a mismatch, do not repair the answer. Discard it, return the refusal, and log
the outcome as blocked.

Reason: the blocked count is visible on the owner's review page, so a check
firing too often is noticed rather than silent.

## Skipping the router

A question tapped from the suggested list carries a fixed intent and skips the
router call.

Reason: it saves a call and a second of latency on the most common path.

## Stage budgets

- Rules layer: 50 ms
- Router: 3 s
- Embedding: 2 s
- Vector query: 1 s
- Answer: 5 s
- Hard ceiling: 11 s, then the error state and a handoff

A visible working state appears after 2 seconds.

Reason: one overall timeout hides which stage is slow. The vector query budget is
generous for a query that takes milliseconds because it absorbs a database cold
start.

## Rate limits

The free tier limits requests per minute and per day. The interface module
tracks usage and fails loudly when a limit is hit. It never silently degrades to
a cached or generic answer.

## OPEN

The exact free tier limits are not in the PRD and change without notice. Read
them from the provider and record them in the interface module before launch.