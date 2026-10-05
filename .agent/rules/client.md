---
trigger: glob
globs: public/sw.js, src/app/**/*.tsx
---

# Client

This file controls the browser side: caching, offline behaviour, the check in
screen states, and the data cost of using the app.

## The constraint

The member uses a low end Android phone with little free storage, buys data in
small bundles, and has unreliable power. Every decision here follows from that.

## Data budget

The home screen makes at most one network request on open.

A warm open transfers under fifty kilobytes. At typical bundle pricing that
keeps eighteen opens a month under one naira of data.

Measure it, do not estimate it. Open the browser network panel, tick disable
cache off, reload a warm session, and read the transferred total at the bottom.
Report that number. If it is over budget, say so before shipping.

## What is cached

The service worker at public/sw.js caches the app shell, the eight suggested
questions, and the member's last status payload.

Status renders from cache first and revalidates in the background.

## What is never cached

Answers. Not shared answers, not private answers, not for a minute.

Reason: a stale answer about a price is the exact failure this product exists to
prevent. The freshness of an answer is the product.

Check in codes. A code is single use and expires in five minutes, so a cached
one is always wrong.

## The stale status rule

A cached balance older than twenty four hours does not display a figure. See
rules/copy.md for what shows instead.

A cached status carries the same date framing as any other money display.

Reason: the home screen is where the member sees a money figure most often, so
it must not be the place with the weakest framing.

## The check in screen

Five states. Each one has exactly one thing on it.

1. Ready. One button. Nothing else competes with it.
2. Showing the code. The six digits, as large as the screen allows, with a
   countdown underneath. Nothing else on the screen.
3. Confirming. Shown once the countdown is running and the app is polling.
4. Checked in. The confirmation and the new days trained number.
5. Expired. The expired message and one button to generate a new code.

The digits in state 2 are the only thing that matters on that screen. She is
reading them off a cracked phone in a badly lit corridor and typing them into a
keypad. Make them very large, high contrast, and grouped in threes.

Reason: every design decision on this screen is about reading six digits
correctly on the first try. A misread digit is a failed check in and a member
who believes the app is broken.

## Polling

Poll the code status every two seconds while the screen is open. Stop when the
code is consumed or expires.

Stop polling when the screen is hidden. Resume when it is shown again.

Reason: a phone in a pocket polling every two seconds costs data and battery for
nothing.

On a polling failure, keep the code on screen and show the still confirming
message. Never tell her the check in failed.

Reason: the code may already have been consumed. Telling her it failed makes her
try again, the one per day rule refuses her, and she believes the app lost her
visit.

## The first open

On the very first open there is no cache. Render the shell immediately and show
the status area in a loading state, not a blank page and not an error.

Reason: the empty cache path is the one every new member sees, and it is the one
most likely to be left untested.

## Offline

The home screen renders with no network at all, from cache.

Check in requires network, at generation and while polling, and says so plainly.
Do not queue a check in for later.

Reason: a queued check in that fires from her living room the next morning is a
false attendance record.

## The first screen

Not an empty box waiting for typing.

Her own status at the top: effective tier, expiry, days trained this month,
balance. Eight tappable questions below. Typing available underneath and never
required.

Reason: an empty box is intimidating and expensive on a metered connection. The
tapped questions also skip a model call. See rules/ai.md.

## Sign up and login

Sign up is one screen with four fields, not a wizard. Login is one screen with
two.

The password field has a show password control.

Reason: she is typing a password she chose once, months ago, on a small keyboard.
Hiding it guarantees failed attempts, and failed attempts hit the lockout.

## Delivery

A web app the member saves to her home screen. Not a store app.

Reason: a store app costs her storage she does not have and costs her data on
every update.

## Loading

No blocking spinner on the home screen. Cached content renders immediately and
updates in place.

A working state appears after two seconds on an answer, because an answer takes
real time and silence looks broken.