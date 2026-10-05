---
trigger: model_decision
description: Read this only when working on check-ins : the daily code, attendance records, opening hour.
---

# Check in

This file controls how a visit is recorded.

## What this design does and does not do

The member generates the code herself, inside the app. She could generate it
from her sofa.

So version one records a claimed arrival, not a proven one. State this plainly
in any work you do here. Never build anything that treats a check in as proof
that a member was in the building, and never describe the number as verified
attendance.

Three things make it acceptable for version one:

1. It is the member's own record about herself, and nothing in version one
   rewards attendance, so she gains nothing real by inflating it.
2. It needs no hardware, so the rest of the product can ship.
3. The code and its journey are recorded exactly as a real keypad would record
   them, so switching to a real keypad changes one module and no data.

## The flow

1. The member taps check in.
2. The server checks eligibility.
3. The server creates a code row. No attendance record yet.
4. The screen shows six digits and a countdown.
5. She types the code at the door keypad.
6. The verifier consumes the code.
7. Consumption writes one attendance record.
8. The screen polls and shows the confirmation.

The attendance record is written at step 7, never at step 3.

Reason: a code that is generated and abandoned is not a visit. Writing at
generation would count every abandoned code as attendance and make the number
worse than useless.

## The code

- Six digits.
- Bound to one member.
- Single use.
- Expires five minutes after it is created.

Reason for six digits: several members hold an active code at the same moment
during a peak evening. Four digits gives ten thousand combinations, and with
thirty active codes two will collide often enough to credit one member's entry
to another. Six digits makes that vanishingly unlikely.

Reason for five minutes: long enough to walk from wherever she generated it to
the door, short enough that a screenshot is not a reusable pass.

## Codes are unique while active

No two unconsumed, unexpired codes may hold the same digits.

Enforce this in the database with a partial unique index, not only in
application code. On a collision, regenerate.

Reason: a keypad receives digits and nothing else. If two active codes match,
the entry is ambiguous and the wrong member gets the attendance. Application
code alone cannot prevent two simultaneous requests generating the same digits.

## The verifier is the seam

All code consumption happens in src/server/checkin/verifier.ts. Nothing else in
the codebase consumes a code or writes a code sourced attendance record.

It exposes one function. The function takes six digits and either consumes a
matching active code or refuses.

Two implementations:

- Simulated. Ships in version one. Consumes the member's active code ten
  seconds after it was created.
- Real. Added when a keypad exists. An authenticated endpoint the keypad calls
  with the digits it received.

Either way the same row is consumed, the same attendance record is written, and
the same screen updates.

Reason: the seam is the whole point of this design. One file swaps, no data
migrates, no screen changes, no schema changes.

## The simulation is explicit and visible

The simulated verifier runs only when its configuration flag is on. The flag
defaults to off.

Reason: an unconfigured deployment must not silently simulate check ins. Off by
default means a missing flag produces codes that are never consumed, which is
visibly broken, rather than fake attendance, which is invisibly wrong.

While the flag is on, the owner review page shows a banner saying check in
verification is simulated.

Reason: the one unacceptable outcome is a gym believing its attendance data is
verified when it is not.

## Consumption is one transaction

Marking the code consumed and writing the attendance record happen in one
database transaction.

Reason: a consumed code with no attendance record is a lost visit the member
cannot redo, because the code is spent.

Consuming an already consumed code writes nothing and is not an error. It
returns the existing result.

Reason: a keypad will retry, and a retry must not create a second record.

## Eligibility

Checked at generation, not at consumption. All four must hold:

- Her status is not past grace.
- The current time is inside the gym's opening and closing times.
- She has no attendance record for today.
- She has no unexpired unconsumed code from a previous tap.

Reason for checking at generation: a member who generates a code at 9:59 and
types it at 10:01 arrived before closing. Refusing her at the keypad for the
length of the walk is wrong.

## One per day

One member produces at most one attendance record per calendar day.

A second generation attempt on the same day returns the already checked in
message and creates no code.

## Expiry

An unconsumed code expires five minutes after creation and can never be
consumed afterwards. The screen shows the expired state and offers to generate
a replacement.

A replacement is allowed and does not count as a second check in, because no
attendance was written.

## Blocked past grace

A member past grace cannot generate a code. The screen shows the renewal amount
and the pay button instead.

Reason: a check in claims a visit the gym did not sell.

## Which clock

Opening hours, the calendar day and every expiry are evaluated in the gym
record's timezone, never the server's and never the browser's.

Reason: the server runs in UTC. A member checking in at nine at night local time
would otherwise be recorded on the following day, and her month's count would be
wrong at both ends.

## Manual check in

Staff may record a check in for a named member, marked manual and stamped with
the staff member who recorded it. This exists for dead phones.

Manual and code check ins must be distinguishable in the data.

Reason: if manual entries ever dominate, the number means something different
and you need to be able to see that.

## Anomaly flags

Two flags appear on the owner review page:

- Any day where check ins exceed one hundred and fifty percent of that day of
  week's trailing four week average.
- Any member whose check ins in a week exceed the number of days in that week.

The second is impossible under the one per day rule, so it is a bug detector,
not a cheating detector. Treat any occurrence as a defect.

## Speed

Generation is one tap with no confirmation dialog. It must complete on a slow
connection in under three seconds.

Reason: it happens sixteen times a month, so every second is paid sixteen times.

## Polling

The client polls the code status every two seconds while the screen is open, and
stops when the code is consumed or expired.

A polling failure keeps the code on screen and says the app is still confirming.
It never tells her the check in failed, because the code may already have been
consumed.

See rules/client.md for the screen states and rules/copy.md for the wording.

## OPEN

The gym's real opening and closing times are not in the PRD. Get them before
launch and do not rely on any default.

Whether a real keypad will ever exist is Gate A in the PRD. Version one assumes
one will and simulates it. If the answer is no, attendance stays self reported
permanently and the metric in rules/metrics.md must say so.