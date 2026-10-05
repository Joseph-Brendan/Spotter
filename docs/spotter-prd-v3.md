# Spotter Product Requirements Document

Version 3.0. Single gym. Member facing web app.

Version 3.0 changes sign up, login and check in. Everything else carries over from version 2.0 unchanged. Appendix B lists every change and the section it landed in.

---

## 1. Product Summary

Spotter is a web app a gym gives to its four hundred members. A member signs up with her name, email, password and the member number the gym gave her, then logs in with her email and password. The app answers questions using only the gym's own records, lets her generate a check in code when she arrives, shows her own attendance and balance, and lets her pay her subscription. A confirmed payment extends her membership immediately, with no staff action required. When the records hold no answer, or the question is on the never answer list, it says so in one sentence and hands her to the front desk officer by name.

The member is the only user of the app. Staff and the owner supply records through separate screens and never open the member app.

A general chatbot can tell a member what most gyms do on a Saturday. Spotter tells her what this gym does, and it tells her how many days she personally trained in July. That second answer exists nowhere on the internet.

---

## 2. Problem

The gym has four hundred members and one front desk. Two staff share it, one at a time, and the desk closes at eight. There is one paper timetable taped to the wall.

The same five questions arrive all day. What time is the Saturday class. Can I bring my sister. Why is my card not working before six. How many days have I trained this month. Do I still owe for July.

The officer on duty knows some answers and guesses at others. She cannot answer the last two at all without opening a ledger that is not in front of her. After eight, nobody answers anything.

Nobody has ever counted these questions. Section 5.4 fixes that before launch, because every quality target in section 12 needs a baseline.

### The failure scene

Chioma pays fifteen thousand naira in cash at the desk on a Tuesday evening in July. The officer takes it and means to write it in the ledger, then three members walk in at once. No receipt is issued because the receipt book is finished.

In September a different officer is on the desk. Chioma is told she owes for July. She says she paid. The officer opens the ledger and finds nothing. Neither of them can settle it. Chioma is embarrassed in front of two other members. The owner hears about it the next day and waives the fifteen thousand naira to end the argument.

The gym lost fifteen thousand naira. It also lost the member's belief that any number the gym gives her is real. She tells two friends from the same office. When her renewal comes up in October, she thinks about the argument first and the gym second.

---

## 3. Goals

**G-1. Answer the gym's recurring questions without a person.** At least seventy percent of member questions in a rolling week are answered from an approved record, measured against the baseline from section 5.4.

**G-2. Give attendance a record where there is none today.** At least sixty percent of real gym entries produce a check in record by the end of month two, measured by the method fixed in M-2. Version one records a member's own claim that she arrived. It does not prove she was in the building. See FR-19.

**G-3. Cover the hours the desk cannot.** At least eighty questions answered from records between eight in the evening and six in the morning during month two. This is a count, not a share, because a share improves when daytime use falls.

**G-4. Move renewals into the app.** At least forty percent of renewals in month three are paid through the app, each extending membership automatically and producing a receipt.

**G-5. Never state a private number the gym cannot defend.** Zero rows in `PrivateAccessLog` where the session member ID differs from the queried member ID. Zero money answers displayed without a source record and a last confirmed date. This goal is detected, not just prevented. See FR-16b.

### Non goals

Spotter will not manage class bookings or capacity. It will not replace the gym's accounting. It will not do door access control, and it does not open the door. It will not give training, medical, diet or injury advice. It will not message a member first about anything, for any reason, in version one. It will not serve more than one gym in version one.

---

## 4. Users and Personas

### The member, the only user

**Chioma Adeyemi, twenty nine.** She works at a bank in Wuse and trains four evenings a week, usually arriving around seven. Her phone is a forty five thousand naira Android with a cracked corner and eleven gigabytes of storage, most of it full. She buys five hundred naira data bundles two or three times a week and watches the balance. Power at her flat is unreliable, so her phone is often at nineteen percent by evening. She has never asked anyone for technical help in her life and would not start now.

She signs up once, using the member number printed on the card the gym gave her. After that she logs in with her email and her password, and the app keeps her logged in.

She opens Spotter about eighteen times a month. Sixteen are check ins that take about fifteen seconds: tap, read the code, type it at the door, watch it confirm. The check in is the habit, and the habit makes the rest of the product possible. She also opens it with no question at all, because the counter on her home screen moves from nine days to ten days when she checks in.

Her other two opens are real questions at bad times. A Sunday afternoon, about whether her sister can come on Saturday. Nine at night, after the desk has closed, about whether she paid for July.

### The member who forgot her password

This path is common and must be designed for, because Chioma sets a password once and then relies on staying logged in for months.

Version one has no email sending, so there is no self service reset link. She tells the desk. The owner sets a temporary password on the owner screen and gives it to her. She logs in with it and the app forces her to set a new one before anything else loads. See FR-6b.

### The owner, a record supplier

He approves every shared card before a member can see it. He maintains the member list and the membership plans. He records cash and transfer payments the same day they arrive. He issues temporary passwords when members are locked out. He opens a weekly review page and runs the weekly answer audit.

He does not open the member app. He has his own screens on a separate route behind a separate login.

### The staff, record suppliers and the named fallback

Two front desk officers. They draft cards for approval and record manual check ins for members whose phones are dead.

They do not open the member app. They appear inside it only as a name and a WhatsApp link when Spotter cannot answer.

---

## 5. Scope

### 5.1 In scope for version one

| # | Feature | One line |
|---|---------|----------|
| F-1 | Ask about the gym | Answers from approved shared cards the member's effective tier allows, with a report control on every answer |
| F-2 | My records | Answers from her own private records, fetched by exact member ID, with a report control on every answer |
| F-3 | Check in | The member generates a single use code in the app, enters it at the door keypad, and the app confirms |
| F-4 | Pay | Renewal or arrears through Flutterwave, settling into the gym's account, extending membership on confirmation |
| F-5 | Ask the desk | Names the officer on duty and opens WhatsApp with the question pre typed |

Five features. Sign up and login are how a member reaches the app at all. They are not a feature and are not counted. The "this is wrong" report control is part of the answer screen in F-1 and F-2, not a sixth feature.

Owner and staff screens are input, not features.

### 5.2 Out of scope

| Cut | Why |
|-----|-----|
| Class booking and capacity | Four hundred members and one studio turns booking into queue management |
| Push notifications, reminders, nudges | Version one sends nothing, and each message costs the member data |
| Email sending of any kind, including password reset links | An email service is another dependency and another cost. Owner issued temporary passwords cover the only case version one has |
| Trainer chat or member to staff messaging in the app | Puts staff back inside the app, which this design removed |
| Progress tracking, weight logs, body metrics | Health data, and it drags the app onto the never answer list |
| Referrals, streaks, leaderboards | Nothing works until check in works |
| Door access control | The app records a claimed arrival. It does not open the door and never will |
| Building the door keypad itself | Out of scope by decision. See section 6.5 and Gate A |
| Multi gym support | One gym; the schema keeps a gym ID so this stays possible |
| Native Android app | Storage and update data cost the member money |
| Automatic monthly billing | Charges are posted manually by the owner |

### 5.3 Deferred to version two

| Version two feature | Data version one must hold | Unlock trigger |
|---------------------|----------------------------|----------------|
| Renewal reminders | Every expiry date and change, plus payment history | M-4 above forty percent for two consecutive months |
| Attendance nudges | Every check in with timestamp | M-2 above sixty percent, sustained ninety days |
| New card suggestions | Every unanswered question with full text | Fifty or more unanswered questions logged |
| Failed payment recovery | Every payment attempt with failure reason | Twenty or more failed attempts logged |
| Answer quality tuning | Every question with outcome, card and score | One thousand questions logged |
| Real door keypad verification | Every generated code with its issue, expiry and consumption times | A keypad exists and can call an endpoint. See Gate A |
| Self service password reset by email | Nothing extra | The gym accepts the cost of an email service |

### 5.4 Pre launch gates

No member account is activated until both gates pass.

**Gate one. Fourteen day desk tally.** Staff record every member question asked at the desk for fourteen consecutive days, as question text and a count. This is the M-1 baseline and the source of the eight suggested questions in FR-9.

**Gate two. Thirty approved cards.** At least thirty cards with status APPROVED, covering the top questions from gate one, before the first member signs up. An empty retrieval system is worse than no app, because a member who gets "I do not have that" twice never opens it again.

**Pilot.** Twenty members for thirty days before the remaining three hundred and eighty are invited.

---

## 6. Functional Requirements

### 6.1 Sign up, login and identity

**FR-1. Sign up fields.** The sign up screen takes four fields: full name, email, password, and member number. All four are required.

**FR-2. The member number links the account to a record.** The member number must match an existing member record that has no account attached to it. If it does not match, or the record already has an account, sign up fails.

ASSUMPTION: sign up requires the member number. Reason: without it, anyone with an email address can create an account, and the app has no way to know which member record the account belongs to. The gym already prints a member number on the membership card, so this adds no work for staff. The alternative, letting anyone sign up and having the owner link accounts afterwards, creates a second account state to build and a queue for the owner to clear. Confirm in Gate E that every member has a number she can read off something.

**FR-3. Email is unique and is the login identifier.** One email, one account. Email is stored lowercase and trimmed. Comparison is case insensitive.

**FR-4. Password rules.** Minimum eight characters. No maximum below 128. No composition rules, no forced symbols, no forced digits.

Reason: composition rules push people toward one predictable pattern and toward writing the password down. Length is the control that matters.

The password is hashed with Argon2id. It is never stored in plain form, never logged, never returned in any response or error, and never emailed.

**FR-5. Login.** Email and password. Nothing else. No code, no PIN, no device check.

**FR-6. Lockout.** Five consecutive failed logins for one email lock that account for fifteen minutes. Twenty failed logins from one IP address in one hour are refused for one hour.

Reason: the email plus password pair is now the only thing standing in front of a member's records, so the brute force limit is the whole defence.

**FR-6b. Password reset.** There is no self service reset in version one, because version one sends no email.

The owner sets a temporary password on the owner screen. The temporary password expires in twenty four hours and is single use. On logging in with it, the member is sent straight to a change password screen and nothing else loads until she sets a new one.

The owner screen shows the temporary password once and never again.

**FR-7. Sessions.** A session lasts ninety days from last use and refreshes on each request. It is not bound to a device. The member may be logged in on more than one device at once.

Changing the password revokes every session for that account except the one that changed it.

Reason for dropping the one device rule: sign up is now self service and there is no desk step to re link a device, so a device rule would lock members out with no path back that does not involve the desk. The compensating controls are the access log detector in FR-16b, which catches any read of another member's records, and revoke on password change.

**FR-7b. Session listing and revoke.** The owner screen can list active sessions for one member and revoke them all.

Reason: it is the only lever the gym has when a member says someone else is using her account.

**Empty state.** A visitor with no session sees the login screen with a link to sign up.

**Error state.** A failed login returns one message and never says whether the email exists. See `rules/copy.md`.

Reason: a message that distinguishes wrong email from wrong password tells an attacker which emails are registered.

**Acceptance criteria.**
- Sign up with a member number that does not exist fails, and no account row is created.
- Sign up with a member number already attached to an account fails.
- The same email cannot be registered twice, in any letter case.
- The password never appears in any server log, response body, or error message.
- Six wrong passwords in a row produce a lockout, and the sixth attempt with the correct password also fails.
- Setting a new password logs out every other session.

### 6.2 Home screen

**FR-8.** The home screen renders cached status first and revalidates in the background. Status is effective tier, expiry date, days trained this month, and balance.

**FR-8b.** The cached balance carries the same framing as any other money answer: the figure, then "Correct as of DATE, based on payments recorded here." If the cached balance is more than twenty four hours old, the figure is hidden and replaced with "Open to refresh".

Reason: a stale money figure with no date is the exact failure this product exists to prevent, and the home screen is where it would be seen most often.

**FR-9.** Below status sit eight tappable questions, configured by the owner from the section 5.4 gate one tally. Free typing sits underneath and is never required. Each tapped question carries a fixed intent and skips the router model call.

**FR-10.** The home screen makes at most one network request on open. ASSUMPTION: a warm open transfers under fifty kilobytes. Reason: at typical Nigerian bundle pricing this keeps eighteen opens a month under one naira of data.

**Empty state.** A new member with no check ins sees "0 days this month" and no error.

### 6.3 F-1: Ask about the gym

Unchanged from version 2.0.

**User story.** As a member, I want to ask a question in my own words and get this gym's actual answer, so I do not have to wait for the desk to open.

**Trigger.** She taps a suggested question or types one.

**Flow.**
1. The client posts to `POST /api/ask`.
2. The server reads the member ID and effective tier from the session. It never reads a member ID from the request body.
3. The deterministic rules layer runs first (section 7.3). A never answer pattern hit refuses immediately with no model call.
4. If the rules pass, the router model classifies the question. A tapped suggestion skips this step.
5. If the intent is a shared question, the server embeds it and runs the query in section 10.5, filtered to effective tier.
6. Chunks below the similarity threshold are dropped. If none remain, the language model is never called.
7. The answer step produces one or two lines grounded only in the surviving chunks.
8. The grounding check (section 7.7) runs on the output.
9. The response returns the answer, the source card, and the card's last confirmed date.
10. The server writes a QuestionLog row before returning.

**FR-11.** Only cards with `Card.status` APPROVED, whose current version is APPROVED, and whose chunk minimum tier is at or below the member's effective tier, may enter the search. The filter runs inside the SQL WHERE clause, before ranking, never after.

**FR-11b.** The app refuses to serve any member question while fewer than thirty cards hold status APPROVED. This is a runtime check, not a launch note.

**FR-12.** Every shared answer displays the source card body and its last confirmed date. An answer with no source card is never displayed.

**FR-13.** If the top similarity is below threshold, the app returns the no answer response and the handoff.

**FR-14.** A card past its review interval still answers, and the answer shows "This was last confirmed on DATE."

**FR-37.** Every answer carries a "this is wrong" control. Tapping it writes a `WrongAnswerReport` linked to the `QuestionLog`, opens a one line note field, and thanks the member. It sends nothing to anyone.

**Acceptance criteria.**
- A Basic member asking about training plans gets the no answer response.
- A member past grace with a stored tier of PREMIUM gets Basic results only.
- A retired card never appears in results, whether or not its chunks were deleted.
- Turning off the language model produces the error state, not a generic answer.

### 6.4 F-2: My records

Unchanged from version 2.0.

**Flow for attendance.**
1. The router returns PRIVATE_ATTENDANCE with a date range, validated in code against a five year window.
2. The server queries `CheckIn` filtered by the session member ID and the range.
3. The server renders the answer from a code template. The language model never sees the rows.
4. The response lists the count and every date.

**Flow for balance.**
1. The router returns PRIVATE_BALANCE.
2. The server computes the canonical balance in FR-17b.
3. The server renders from a code template, listing every entry with date, amount, channel and who recorded it.
4. The answer ends with "Correct as of DATE, based on payments recorded here."

**FR-15.** Every private query filters by the member ID from the server session. A member ID supplied by the client is ignored.

**FR-16.** Private records are never embedded, never written to the vector index, and never searched by meaning.

**FR-16b.** Every private query writes a `PrivateAccessLog` row holding the session member ID, the queried member ID and the calling function. A daily job asserts the two IDs match on every row and surfaces any mismatch on the owner review page.

Reason: prevention without detection is a hope. With the one device rule gone, this log is now the primary detector of a cross member read.

**FR-17.** Numbers in private answers are rendered by application code, not by the language model.

**FR-17b. Canonical balance.** `balance_kobo = SUM(LedgerEntry.amountKobo) WHERE memberId = :id`. Positive means she owes. Payments, credits and refunds are stored as negative amounts.

**FR-18.** Money is reported, never ruled on. The app renders "Our records show 15,000 naira outstanding for July." It never renders "You owe 15,000 naira."

**FR-37b.** Private answers carry the same "this is wrong" control as shared answers.

**Acceptance criteria.**
- A crafted request containing another member's ID returns the caller's own records.
- The attendance count equals the number of `CheckIn` rows for that member and range, exactly.
- The balance equals the FR-17b formula, computed in SQL, with no stored balance field anywhere.
- Every private query produces a `PrivateAccessLog` row.

### 6.5 F-3: Check in

This section is rewritten in version 3.0.

**User story.** As a member, I want to record my visit by generating a code in the app and entering it at the door, so my days trained number is real.

**Trigger.** She arrives at the gym and opens the app.

#### What this design does and does not do

The member generates the code herself. She could generate it from her sofa.

So version one records a claimed arrival, not a proven one. It is weaker than a code posted on a wall, because a wall code at least requires being in the building to read it. State this plainly in any work on this feature and never build anything that treats a check in as proof of presence.

Three things make it acceptable for version one:

1. It is the member's own record about herself. She gains nothing real by inflating it, since nothing in version one rewards attendance.
2. It costs nothing to build and needs no hardware, so the rest of the product can ship.
3. The code and its journey are recorded exactly as a real keypad would record them, so switching to a real keypad changes one module and no data.

Attendance in version one is a measure of app habit as much as gym attendance. Read M-2 with that in mind.

#### The flow

1. She taps "Check in".
2. The client posts to `POST /api/checkin/generate`.
3. The server checks eligibility: her status is not past grace, the current time is inside the gym's opening hours, and she has no check in recorded for today.
4. The server creates a `CheckInCode` row: six digits, bound to her member ID, single use, expiring five minutes from creation, with no attendance record yet.
5. The screen shows the six digits, large, with a countdown.
6. She types the code on the keypad by the door.
7. The keypad verifier consumes the code. In version one there is no keypad, so the simulated verifier consumes it after a delay. See FR-19c.
8. Consumption writes one `CheckIn` row inside the same database transaction that marks the code used.
9. The client polls `GET /api/checkin/status` every two seconds while the screen is open. When the code is consumed, the screen shows "Checked in" and the days trained counter increases.

#### The requirements

**FR-19. The code.** Six digits. Bound to one member. Single use. Expires five minutes after it is created.

Reason for six digits: several members can hold an active code at the same moment during a peak evening. Four digits gives ten thousand combinations, and with thirty active codes the chance of two matching is high enough to credit one member's entry to another. Six digits makes that vanishingly unlikely.

**FR-19b. Codes are unique while active.** No two unconsumed, unexpired codes may hold the same digits. Enforce it in the database, not only in code, and regenerate on a collision.

Reason: a keypad receives digits and nothing else. If two active codes match, the entry is ambiguous and the wrong member gets the attendance.

**FR-19c. The verifier is one module with two implementations.**

All code consumption happens in `src/server/checkin/verifier.ts`. It exposes one function that takes six digits and either consumes a matching active code or refuses.

Version one ships the simulated implementation, which consumes the member's active code after a fixed delay of ten seconds from generation.

The real implementation, added when a keypad exists, is an authenticated endpoint the keypad calls with the digits it received. Nothing else changes: the same row is consumed, the same attendance record is written, the same screen updates.

Reason: the seam is the whole point of this design. One file swaps, no data migrates, no screen changes.

**FR-19d. The simulation is explicit and visible.** The simulated verifier runs only when a configuration flag is on. The flag defaults to off, so an unconfigured deployment cannot silently simulate check ins.

While the flag is on, the owner review page shows a banner saying check in verification is simulated.

Reason: the one unacceptable outcome is a gym believing its attendance data is verified when it is not.

**FR-20. One check in per member per calendar day.** A second generation attempt on the same day returns the already checked in message and creates no code.

**FR-21. Eligibility is checked at generation, not at consumption.** A code that was valid when generated is honoured when consumed, even if the closing time passed in between.

Reason: a member who generates a code at 9:59 and types it at 10:01 arrived before closing. Punishing her for the walk is wrong.

**FR-22. Expiry.** An unconsumed code expires five minutes after creation and can never be consumed afterwards. The screen shows the expired state and offers to generate a new one.

Generating a replacement is allowed and does not count as a second check in, because no attendance was written.

**FR-23. Opening hours.** Generation is refused outside the gym's opening and closing times, taken from the gym record and evaluated in the gym's timezone.

This is the only presence related control version one has. It is weak. It is still worth keeping, because it rules out a check in at three in the morning.

**FR-23b. Blocked for expired members.** A member past grace cannot generate a code. The screen shows the renewal amount and the pay button instead.

Reason: a check in claims a visit the gym did not sell.

**FR-23c. Manual check in.** Staff may record a check in for a named member, marked manual and stamped with the staff member who recorded it. This exists for dead phones. Manual and code check ins must be distinguishable in the data.

**FR-23d. Anomaly flags.** Two flags appear on the owner review page:

- Any day where check ins exceed one hundred and fifty percent of that day of week's trailing four week average.
- Any member whose check ins in a week exceed the number of days in that week.

The second is impossible under FR-20 and so is a bug detector, not a cheating detector.

**Empty state.** A member who has not generated a code today sees the check in button in its normal state.

**Error state.** Generation failure shows the reason in one line and does not create a code. Polling failure keeps the code on screen and says the app is still confirming.

**Acceptance criteria.**
- Generating twice in one day produces one code and one attendance record at most.
- A code consumed twice writes one attendance record.
- A code older than five minutes is refused by the verifier.
- Two active codes never hold the same digits, proven by a unique constraint violation test.
- With the simulation flag off and no real verifier configured, a generated code is never consumed and the screen stays in the waiting state.
- The owner review page shows the simulation banner while the flag is on.
- Generation is refused at three in the morning.

### 6.6 F-4: Pay

Unchanged from version 2.0.

**Flow.**
1. She chooses renewal or arrears. Renewal amount comes from `MembershipPlan` for her tier. Arrears comes from FR-17b.
2. She re enters her password before the payment starts.
3. The client posts to `POST /api/payments/initiate` with a client generated idempotency key and the purpose.
4. The server creates a `PaymentAttempt` with status PENDING, a unique server generated reference and the purpose, then initialises the gateway transaction.
5. She completes payment on the gateway page.
6. The gateway calls `POST /api/payments/webhook`. The server verifies it, then in one transaction marks the attempt SUCCESS, creates a `Payment`, creates a `LedgerEntry`, and for a RENEWAL applies FR-24b.
7. Her screen polls the attempt for up to ninety seconds, then tells her the gym is confirming.

Note: version 2.0 required a PIN re entry here. Version 3.0 requires the password instead, because the PIN no longer exists.

**FR-24.** The webhook is the only thing that marks a payment successful. The browser redirect is a hint, never proof.

**FR-24b. Renewal extends membership.** On a confirmed RENEWAL payment, `expiryDate` is extended by the plan's `durationDays`, counted from the later of today and the current `expiryDate`, inside the same transaction. A `MembershipChange` row records it.

**FR-24c.** Amounts come from `MembershipPlan`, never from parsing the prices card.

**FR-25.** Every webhook is verified. Verification has two parts and both are required: the secret hash header comparison, and a call to the gateway's own verify endpoint confirming status, amount and currency.

**FR-26.** The idempotency key is unique in the database. A repeated tap returns the existing attempt instead of charging twice.

**FR-27.** A member with a PENDING attempt is never treated as expired. Access holds for twenty four hours.

**FR-28.** If the member loses network mid payment, the attempt stays PENDING and sits at the top of her screen when she reopens.

**FR-29.** An attempt still PENDING after twenty four hours is marked ABANDONED by the nightly sweep. It is never marked FAILED without gateway confirmation.

**FR-30.** The app never holds money, never stores card details, never stores a wallet balance.

**FR-31.** Every successful payment produces a receipt showing amount, date, reference and channel. Receipts survive expiry and cancellation.

**Acceptance criteria.**
- Two rapid taps produce one gateway transaction.
- Killing the browser after the debit still results in a paid record once the webhook arrives.
- A wrong signature changes nothing in the database.
- A member expired by one day who pays a renewal at nine at night can check in at seven the next morning, with no staff action in between.

### 6.7 F-5: Ask the desk

Unchanged from version 2.0.

**FR-32.** The records refusal sentence is fixed: "I do not have that in the gym's records."

**FR-33.** Outside desk hours the app names the officer on the next shift and says when the desk opens. It still opens WhatsApp.

**FR-34.** The never answer list is enforced by the deterministic rules layer in section 7.3, before any model call.

**FR-35.** The never answer list is: anything about another member; anything medical, including injury, pain, diet, supplements and whether to train through something; whether the door will open right now; refunds, waivers, discounts and cancellation decisions; staff conduct.

**FR-36.** A medical refusal uses different wording: "I cannot answer questions about injuries or health. Please speak to NAME or your doctor."

### 6.8 Staff screens

Separate route, separate login, separate session cookie. Never reachable from the member app.

**FR-39. Draft a card.** Title, category, body, minimum tier. Saving creates a `CardVersion` with status PENDING_APPROVAL.

**FR-42. Record a manual check in.** Search by name or member number, record one check in for today.

**FR-43.** Staff cannot see any member's balance or payment history. They see attendance, effective tier and expiry.

Version 3.0 removes two staff screens. Staff no longer set a daily check in code, because codes are generated per member. Staff no longer issue activation codes, because members sign up themselves.

### 6.9 Owner screens

**FR-44. Approve cards.** Pending versions shown beside the live version. Approving triggers reindexing per section 9.6.

**FR-45. Reconfirm cards.** Cards past their review interval appear in a list. Confirming without edits updates `lastConfirmedAt` only.

**FR-46. Member list.** Create and edit members: name, member number, phone, tier, expiry date, opening balance. The owner creates the member record before the member can sign up, because FR-2 requires a matching record.

**FR-46b. Membership plans.** Create and edit plans: tier, price, duration days.

**FR-46c. Issue a temporary password.** Per FR-6b. Shown once, expires in twenty four hours, single use.

**FR-46d. Revoke sessions.** List active sessions for one member and revoke them all. Per FR-7b.

**FR-47. Record a cash or transfer payment.** Member, amount, date, channel, stamped with who recorded it. Cannot be deleted. Mistakes are corrected with a visible offsetting entry.

**FR-47b. Same day entry rule.** Cash and transfer payments must be recorded on the same calendar day they are received. Balance answers do not go live until the desk demonstrates fourteen consecutive days of same day entry. Until then F-2 answers attendance only.

**FR-47c. Renewal by cash.** The owner marks whether a cash payment is a renewal. If it is, FR-24b applies identically.

**FR-48. Post a charge.** Manual in version one.

**FR-49. Weekly review.** One page listing: wrong answer reports, unanswered questions, blocked ungrounded answers, abandoned payment attempts, cards past their review interval, check in anomalies from FR-23d, any `PrivateAccessLog` mismatch, and the simulation banner from FR-19d while it applies.

**FR-49b. Weekly answer audit.** The owner reads twenty randomly sampled answered questions each week and marks each correct or wrong.

**FR-50.** In app payments cannot be edited or deleted by anyone.

### 6.10 Tier and status rules

**FR-51. Derived status.** Status is never stored. It is computed from `expiryDate`, `graceDays` and `cancelledAt` by one function.

**FR-52. Effective tier.** Her stored tier while ACTIVE or GRACE, BASIC once EXPIRED or CANCELLED. Only the effective tier reaches retrieval.

| What | Basic | Premium | Expired or cancelled |
|------|-------|---------|----------------------|
| Timetable | Yes | Yes | Yes |
| Prices | Yes | Yes | Yes |
| Rules and access hours | Yes | Yes | Yes |
| Guest policy | Yes | Yes | Yes |
| Pause and cancellation terms | Yes | Yes | Yes |
| Written training plans | No | Yes | No |
| Trainer guidance | No | Yes | No |
| Own attendance history | Yes | Yes | Yes |
| Own payment history and receipts | Yes | Yes | Yes |
| Generate a check in code | Yes | Yes | No |
| Pay | Yes | Yes | Yes |

**FR-53.** Expiry triggers three days of grace during which nothing changes.

**FR-53b.** An expired member keeps her full history, her receipts, the timetable, the price list and the pay button.

### 6.11 Data protection

**FR-58. Privacy notice.** Shown during sign up and accepted before the account is created. It states what is stored, who sees it, how long it is kept, and how to request a copy or deletion.

Version 3.0 moves acceptance from activation to sign up, because activation no longer exists.

**FR-59.** The gym is the data controller. The developer is a processor.

**FR-60. Retention.** Attendance, question logs, access logs and check in codes: twenty four months. Payment records and receipts: seven years. Member identity records: while active, and twenty four months after cancellation.

**FR-61. Exit.** Full CSV export within fourteen days of contract end, deletion within thirty days of export confirmation.

---

## 7. AI and AI Related Tools and Solutions

Unchanged from version 2.0 in every respect. Summarised here; the full text of section 7 in version 2.0 remains authoritative for anything not restated.

### 7.1 Models

| Component | Choice | Free limit |
|-----------|--------|------------|
| Embedding model | Google `text-embedding-004`, 768 dimensions | Free tier, rate limited per minute and per day |
| Language model | Google `gemini-2.5-flash` | Free tier, rate limited per minute and per day |

ASSUMPTION: the Gemini free tier exists in this shape when you build. Verify before writing code and keep both models behind one interface module.

### 7.2 What is embedded and what is not

Embedded: approved card versions only.

Never embedded: attendance, payments, ledger entries, balances, expiry dates, phone numbers, email addresses, member names, question logs, access logs, check in codes, password hashes.

Version 3.0 adds email addresses and password hashes to that list explicitly, because sign up introduced them.

### 7.3 The rules layer

A deterministic check runs before any model call. A hit refuses immediately with no network call. Categories: medical, another member, door access, money decisions, staff conduct.

The door access category keeps its place and gains weight in version 3.0. A member who has just typed a code at a keypad is more likely to ask whether the door will open. The app cannot know and must refuse.

### 7.4 to 7.10

Router prompt, answer prompt, grounding check, stage budgets, retries and cost estimates are unchanged. See version 2.0 sections 7.4 through 7.10 and `rules/ai.md`.

---

## 8. Technical Architecture with a Prisma Data Model

### 8.1 The stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js, App Router, TypeScript | |
| ORM | Prisma | |
| Database | PostgreSQL with `pgvector` | Pooled connection for the app, direct for migrations |
| Hosting | Vercel for build and test | Hobby forbids commercial use. See 11.4 |
| Scheduled jobs | One daily job | Version 3.0 removes the second job. See 8.1.1 |
| Payments | Flutterwave | |
| Models | Gemini API | |

#### 8.1.1 One scheduled job, not two

Version 2.0 had two jobs: a daily check in code generator and a nightly sweep.

Version 3.0 deletes the code generator, because codes are now generated by members on demand. One job remains.

| Job | Time | What it does |
|-----|------|--------------|
| Nightly sweep | 03:00 gym local time | Marks payment attempts pending over twenty four hours as abandoned, expires unconsumed check in codes, runs the `PrivateAccessLog` assertion, computes the review page counts |

Expiring stale codes is housekeeping only. A code past its expiry is already unusable because the verifier checks the timestamp. The job deletes the rows so the table does not grow.

### 8.2 Request flow

```
Browser (saved web app, service worker cache)
  |
  |-- session cookie -> memberId, effectiveTier   [never from request body]
  |
  |-- /api/ask
  |     rules layer (deterministic, no network)
  |       hit -> REFUSED_POLICY -> named officer. Stop.
  |     router call -> intent JSON   [skipped for tapped questions]
  |     if SHARED:  embed -> pgvector search, filtered to effective tier
  |                   -> top 5 -> answer model -> grounding check
  |     if PRIVATE: skip retrieval entirely
  |                   src/server/private/*.ts (memberId is argument one)
  |                   -> PrivateAccessLog -> query -> code template
  |     write QuestionLog
  |
  |-- /api/checkin/generate
  |     eligibility -> create CheckInCode (6 digits, 5 min, single use)
  |
  |-- /api/checkin/status
  |     poll: is the code consumed yet?
  |
  |-- verifier (src/server/checkin/verifier.ts)
        simulated: consumes after 10 seconds
        real:      keypad calls an authenticated endpoint
        either way: consume code + write CheckIn in one transaction
```

### 8.3 Where rules are enforced

| Rule | Enforced where |
|------|----------------|
| Member ID comes from the session only | `src/server/auth/session.ts` |
| Private reads filter by member ID and log | `src/server/private/*.ts` |
| No route handler touches Prisma directly | CI check |
| No `CardChunk` write through the client | CI check |
| No private model reachable from retrieval | CI check |
| Never answer list | `src/server/router/rules.ts` |
| Tier gating | SQL WHERE clause in `src/server/retrieval/search.ts` |
| Code consumption | `src/server/checkin/verifier.ts`, the only place a code is consumed |
| Staff and owner routes | Separate middleware, separate cookie |
| Webhook authenticity | Signature and verify call before any write |

### 8.5 Schema changes in version 3.0

Three changes. Everything else in the version 2.0 schema is unchanged.

**Removed: the `ActivationCode` model.** Members sign up themselves. Nothing issues activation codes.

**Changed: `Member`.** Remove `pinHash` and `deviceId`. Add `email` (unique, lowercase), `passwordHash`, `tempPasswordHash`, `tempPasswordExpiresAt`, `passwordChangedAt`. Keep `memberNumber` and make its uniqueness per gym enforceable for the sign up lookup. Add `accountCreatedAt` to distinguish a member record the owner created from a member who has signed up.

**Changed: `CheckInCode`.** This model changes shape completely. It was one row per gym per day. It becomes one row per member per generation.

```prisma
// PRIVATE. Fetched by exact member ID only, except the verifier lookup,
// which is by code digits and returns at most one active row.
model CheckInCode {
  id          String    @id @default(cuid())
  memberId    String
  member      Member    @relation(fields: [memberId], references: [id])
  code        String    // six digits
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  consumedAt  DateTime?
  consumedBy  String?   // "SIMULATED" or the keypad device identifier
  checkIn     CheckIn?

  @@index([memberId, createdAt])
  @@index([code, consumedAt, expiresAt])
}
```

The uniqueness of active codes in FR-19b cannot be expressed as a plain Prisma unique constraint, because it applies only to rows that are unconsumed and unexpired. It goes in a hand written migration as a partial unique index on `code` where `consumedAt` is null. State that in `rules/schema.md`.

`CheckIn` gains a nullable link to the `CheckInCode` that produced it, and keeps its manual source for staff entries.

### 8.6 Volume

| Model | Rows per month at 400 members | Notes |
|-------|-------------------------------|-------|
| CheckIn | About 6,400 | Unchanged |
| CheckInCode | About 7,000 | New shape. Slightly more than check ins, because some codes expire unused. Deleted after twenty four months per FR-60 |
| Everything else | Unchanged from version 2.0 | |

---

## 9. Vector Database Architecture and Design

Unchanged from version 2.0.

`pgvector` in the same PostgreSQL database. Only approved card chunks are embedded. Nothing private is embedded, and version 3.0 adds email addresses and password hashes to that prohibition explicitly.

Chunking, tier filtering before ranking, the 0.70 threshold, the reindex order with embedding outside the transaction, and the card status filter all carry over without change. See `rules/retrieval.md`.

---

## 10. Vector Database Model

Unchanged from version 2.0. See `rules/retrieval.md` and version 2.0 section 10 for the column list, the index decision, and the query.

---

## 11. Business Model

Unchanged from version 2.0 except where noted.

### 11.1 Who pays

The gym pays. The member pays nothing for the app.

### 11.2 Price

Fifty thousand naira per month, flat, for up to five hundred members.

ASSUMPTION: this price. Reason: it covers running cost at one gym under either hosting option, so break even does not depend on an unresolved question.

ASSUMPTION: a fifteen thousand naira monthly membership fee, from the founder's failure scene. Confirm in Gate B.

### 11.3 Gateway cost

OPEN. The fee table in version 2.0 quotes Paystack rates. The stack is Flutterwave. Get the current Flutterwave rate for Nigerian local cards, including any cap and any waiver band, before any figure in this section is used.

The decision that the gym absorbs the fee stands regardless of the number. Reason: adding the fee at checkout makes the app the expensive way to pay, the member walks to the desk with cash, and the ledger problem returns.

### 11.4 Running cost

Version 3.0 removes nothing and adds nothing to the cost line. There is no email service, because version one sends no email. There is no keypad hardware, because version one does not have one.

| Item | Cost |
|------|------|
| PostgreSQL free tier | Free at these volumes |
| Hosting | Twenty dollars a month for Vercel Pro, or about ten thousand naira a month self hosted |
| Gemini API | Free at eight hundred questions a month |
| Flutterwave | Per transaction only |
| Domain | About fifteen dollars a year |

### 11.5 Break even

Fifty thousand naira covers either hosting option at one gym.

---

## 12. Success Metrics

| # | Metric | Definition | Measured from | Baseline | Target |
|---|--------|------------|---------------|----------|--------|
| M-1 | Grounded answer rate | Answered rows divided by all rows excluding REFUSED_POLICY, ERROR and BLOCKED_UNGROUNDED, rolling seven days | `QuestionLog.outcome` | The fourteen day desk tally | 70 percent by end of month two |
| M-2 | Check in coverage | Distinct `CheckIn` rows divided by counted gym entries in the same period | A three day counted sample in weeks two, six and ten | Zero | 60 percent by end of month two |
| M-3 | After hours answers | Count of answered rows between 20:00 and 06:00, per month | `QuestionLog.askedAt` | Zero | 80 in month two |
| M-4 | In app renewal share | IN_APP RENEWAL payments divided by all RENEWAL payments, per month | `Payment.channel`, `Payment.purpose` | Zero | 40 percent by end of month three |
| M-5 | Wrong answer rate | Self reported and audited. The audited figure governs | `WrongAnswerReport`, `AnswerAudit` | None | Audited under 5 percent |
| M-6 | Availability | ERROR rows divided by all rows, rolling seven days | `QuestionLog.outcome` | Not applicable | Under 2 percent |
| M-7 | Code completion rate | Consumed codes divided by generated codes, per week | `CheckInCode` | Not applicable | Above 90 percent |

**M-7 is new in version 3.0.** It measures whether the check in flow works as an interaction, separately from whether members check in at all.

A low completion rate means members are generating codes and abandoning them. That is a usability failure: the code is hard to read, the wait is too long, the screen is confusing, or the keypad is busy. It is a different problem from members not opening the app, and it has a different fix.

**What M-2 means now.** Version three records a claimed arrival. A member could generate a code at home. Read M-2 as a measure of habit, not of verified attendance, until a real keypad exists.

### The stop signal

**M-2 under thirty percent at the end of week three stops feature work.** Fix it in the building: a sign at the desk, the officer prompting members, a bigger counter on the home screen.

Still under thirty percent at week six means cutting check in. F-2 then loses attendance, half the reason to open the app disappears, and what remains is a timetable with a payment button. That is a smaller product and must be priced and described as one.

**M-5 audited above five percent stops shipping** until cards are fixed or the threshold is recalibrated.

---

## 13. Risks

| # | Risk | What happens | Why it is severe | Early warning | Mitigation |
|---|------|--------------|------------------|---------------|------------|
| R-1 | One member sees another member's records | A missing WHERE clause, or a member ID read from the request body | Four hundred people in one city. A leaked balance becomes a story by the end of the week | Any `PrivateAccessLog` row where session and target IDs differ | FR-15, FR-16, FR-16b detector, CI checks, section 9.3 CI rule |
| R-2 | The app states a wrong balance because a cash payment was never entered | The desk takes cash on Tuesday and enters it Friday, or never | Money answers are the reason the product exists. One wrong one poisons every other answer | Any gap over twenty four hours between `paidAt` and `createdAt` on cash rows | FR-47b with the fourteen day launch gate, FR-18, FR-8b, FR-47 immutability |
| R-3 | Nobody checks in | Attendance stays empty. F-2 answers nothing. The counter never moves | The quiet failure and the most likely one. Nothing breaks, the product just becomes pointless | M-2 under thirty percent in week three | FR-19 honest framing, one tap generation, the home screen counter, the section 12 stop rule |
| R-4 | Attendance is fiction because members check in from home | The code is self generated, so nothing ties it to the building | It corrupts M-2, the stop metric, so a failing product could look like a passing one | M-2 high while the gym looks empty. M-7 near 100 percent with no keypad | FR-19 states the limit plainly, FR-23 opening hours, FR-23d anomaly flags, Gate A as the real fix |
| R-5 | An account is shared, or a password is guessed | Version 3.0 dropped the one device rule, so credentials work anywhere | A shared password exposes that member's own records to whoever holds it | Sessions from several places for one member | FR-4 length rule, FR-6 lockout, FR-7 revoke on password change, FR-7b owner revoke, FR-16b detector |
| R-6 | Someone signs up against a member number that is not theirs | A person who learns a member number claims that record first | She would see another member's attendance and balance, which is R-1 by another route | A member reporting she cannot sign up because her number is taken | FR-2 one account per record, the owner creating records first, FR-7b revoke. See Gate E |
| R-7 | A payment is confirmed wrongly in either direction | A missed webhook leaves a paid member unpaid. A spoofed one marks an unpaid member paid and renews her | Both put the gym in a dispute it cannot win with its own records | Any attempt PENDING past twelve hours. Any signature failure | FR-24, FR-25, FR-26, FR-27, FR-29, FR-24b in the same transaction |
| R-8 | The owner stops approving cards | Cards drift past review. The app answers confidently and wrongly | A stale record is worse than no record, because the member acts on it | The reconfirming list growing past five cards | FR-45, FR-12, FR-14, FR-49, FR-49b |
| R-9 | The simulation ships live | The gym believes attendance is verified when the app is confirming its own codes | It turns an honest weak signal into a dishonest strong one | The banner in FR-19d appearing on a live review page | FR-19d flag defaults to off, the banner, and the launch checklist |
| R-10 | Data protection failure | No notice, no retention limit, no named controller | The Nigeria Data Protection Act applies. Version 3.0 now holds email addresses too | A member asking what you hold, with no answer ready | FR-58 at sign up, FR-59, FR-60, FR-61 |

R-5, R-6 and R-9 are new in version 3.0. All three come from the changes this version makes.

---

## 14. Blocking Gates and Open Questions

### 14.1 Blocking gates

**Gate A. Will there be a real keypad or code entry device at the door, and can it call an endpoint?**
Owner: founder, with the gym owner. Due: before feature three is considered finished.
Version one assumes one exists and simulates it. If one will exist, the real verifier replaces the simulated one and attendance becomes real. If one will never exist, say so, and accept permanently that attendance is self reported. Gates the meaning of M-2, not the build.
Assumed meanwhile: a keypad will exist later. Version one simulates it behind one module.

**Gate B. Where does a member's outstanding balance live today, and what is the monthly fee per tier?**
Owner: founder, with the gym owner. Due: before any balance answer code.
Gates the balance half of F-2 and all of F-4's amounts.
Assumed meanwhile: a paper ledger exists and can be transcribed. Fifteen thousand naira monthly.

**Gate C. Is the gym registered, and does it hold a bank account in the gym's name?**
Owner: gym owner. Due: before any payment code.
Flutterwave requires business verification and a matching settlement account. Gates F-4 end to end.
Assumed meanwhile: both exist.

**Gate D. Can the desk commit to entering cash and transfer payments the same day?**
Owner: gym owner. Due: before balance answers launch.
Gates the go live of balance answers, not the build.
Assumed meanwhile: yes, before the shift ends.

**Gate E. Does every member have a member number she can read off something she holds?**
Owner: gym owner. Due: before the first member signs up.
New in version 3.0. FR-2 makes the member number the link between an account and a record. If members do not know their number, nobody can sign up and the desk gets four hundred phone calls.
Assumed meanwhile: the number is printed on the membership card.

### 14.2 Open questions

**Q-1. Do written training plans and trainer guidance exist in writing today?**
If the plans live in a trainer's head, Premium has nothing behind it. Blocks the Premium tier, not the product. Assumed: some plans exist and can be typed as cards.

**Q-2. Who signs as data controller?**
FR-59 names the gym. Somebody has to agree in writing. Blocks the contract. Assumed: the gym owner signs.

**Q-3. Who is on the desk when?**
Feature five names a person, and naming the wrong person is worse than naming nobody. Assumed: a weekly rota in `DeskShift`.

**Q-4. Vercel Pro or self hosted?**
A margin decision, not a pricing one. Assumed: Vercel Pro at launch.

**Q-5. What are the gym's opening and closing times?**
FR-23 needs real numbers. Assumed: six in the morning to ten at night.

**Q-6. Should the member be able to see her own active sessions and log them out herself?**
New in version 3.0. It would reduce the owner's work under FR-7b. It is one screen. Blocks nothing. Assumed: not in version one, owner revoke only.

**Q-7. What is the current Flutterwave fee for Nigerian local cards?**
Section 11.3 cannot be finished without it. Blocks the pricing page, not the build. Assumed: similar to the figures version 2.0 quoted, which were another gateway's and must not be relied on.

---

## Appendix A: All assumptions in this document

1. **Sign up requires the member number.** Without it, anyone with an email can create an account and the app cannot tell which member record it belongs to. (FR-2)
2. **Passwords have a length minimum and no composition rules.** Composition rules push people toward one predictable pattern and toward writing the password down. (FR-4)
3. **Codes are six digits and last five minutes.** Six digits because several codes are active at once during peak evenings. Five minutes because that is long enough to walk to the door. (FR-19, FR-22)
4. **The simulated verifier consumes after ten seconds.** Long enough to look like a real verification, short enough not to feel broken. (FR-19c)
5. **A warm app open transfers under fifty kilobytes.** Keeps eighteen opens a month under one naira of data. (FR-10)
6. **Staff cannot see any member's balance or payment history.** Cash entry is the owner's control point. (FR-43)
7. **The Gemini free tier exists in the shape described.** Verify before building. (7.1)
8. **The similarity threshold starts at 0.70.** A starting point, recalibrated in week two from logged scores. (7.5, `rules/retrieval.md`)
9. **Timetables are chunked one per day of the week.** A Saturday question should match a Saturday chunk. (9.4, `rules/retrieval.md`)
10. **The gym price is fifty thousand naira per month up to five hundred members.** It covers running cost under both hosting options. (11.2)
11. **The membership fee is fifteen thousand naira per month.** From the founder's failure scene. Confirmed in Gate B. (11.2)
12. **The gym absorbs the gateway fee.** Passing it on makes the app the expensive way to pay. (11.3)
13. **Monthly charges are posted manually by the owner.** Automatic billing is an agent, and agents are version two. (FR-48)
14. **The grace period is three days.** Carried from the refined idea. Confirm with the owner. (FR-53)
15. **Gym opening hours default to six in the morning until ten at night.** Placeholder until Q-5 answers. (FR-23)
16. **A keypad will exist eventually.** Version one simulates it behind one module so the swap is one file. (FR-19c, Gate A)

---

## Appendix B: Changes from version 2.0

| # | Change | Where |
|---|--------|-------|
| 1 | Activation codes and the four digit PIN are removed entirely | FR-1 to FR-7, 8.5 |
| 2 | Sign up added: full name, email, password, member number | FR-1, FR-2 |
| 3 | Login is email and password | FR-5 |
| 4 | Password rules: eight character minimum, no composition rules, Argon2id | FR-4 |
| 5 | Lockout rules rewritten for email and password | FR-6 |
| 6 | Password reset is owner issued temporary passwords, not email | FR-6b, FR-46c |
| 7 | The one device, one member rule is removed | FR-7 |
| 8 | Sessions revoke on password change, and the owner can revoke them | FR-7, FR-7b, FR-46d |
| 9 | Check in rewritten: the member generates a per member single use code | 6.5, FR-19 to FR-23d |
| 10 | The daily gym wide whiteboard code is gone | 6.5, 6.8 |
| 11 | The verifier is one module with a simulated and a real implementation | FR-19c |
| 12 | The simulation runs only behind a flag that defaults to off, with a banner | FR-19d, R-9 |
| 13 | Codes are six digits, unique while active, expiring in five minutes | FR-19, FR-19b, FR-22 |
| 14 | Eligibility is checked at generation, not at consumption | FR-21 |
| 15 | `CheckInCode` changes from one row per gym per day to one row per member per generation | 8.5 |
| 16 | `ActivationCode` model removed | 8.5 |
| 17 | `Member` gains email, password fields and account timestamps, loses PIN and device fields | 8.5 |
| 18 | Two staff screens removed: set the daily code, issue activation codes | 6.8 |
| 19 | Three owner screens added: temporary password, session revoke, and the member record must exist before sign up | FR-46, FR-46c, FR-46d |
| 20 | Scheduled jobs go from two to one | 8.1.1 |
| 21 | Payment re authentication uses the password, not the PIN | 6.6 |
| 22 | Privacy notice acceptance moves from activation to sign up | FR-58 |
| 23 | Email addresses and password hashes added to the never embedded list | 7.2, 9 |
| 24 | M-7 added: code completion rate | 12 |
| 25 | M-2 reinterpreted as a habit measure, not a verified attendance measure | G-2, 12 |
| 26 | R-4 rewritten: the risk is now self generated codes, not a shared wall code | 13 |
| 27 | R-5, R-6 and R-9 added: shared credentials, member number claimed by the wrong person, simulation shipped live | 13 |
| 28 | Gate E added: does every member know her member number | 14.1 |
| 29 | Gate A rewritten: it is now about whether a keypad will ever exist, and no longer blocks the build | 14.1 |
| 30 | Q-6 and Q-7 added: member visible sessions, and the real Flutterwave fee | 14.2 |
| 31 | Flutterwave replaces Paystack throughout. The version 2.0 fee figures are void | 11.3, Stack |