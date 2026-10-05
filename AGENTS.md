# Spotter

## Description

Spotter is a web app that a gym gives to its own members. A member signs up with her full name, email, password and the member number the gym gave her, then logs in with her email and password. It answers her questions using only the gym's own approved written records, lets her generate a check in code when she arrives, shows her own attendance and balance, and lets her pay her subscription so that a confirmed payment extends her membership immediately with no staff action. When the records hold no answer, or the question is on the never answer list, it says so in one sentence and hands her to the front desk officer by name.

The full PRD lives at docs/spotter-prd-v3.md in this repo. Read it only when this file or a rules file points you there.

## Who uses it

- Member. The only user of the member app. She signs up, logs in, asks questions, checks in, reads her own records, and pays. Build for a low end Android phone on a small data bundle: one network request on the home screen open, cached status, and no blocking spinners.
- Owner. Creates member records before members can sign up. Approves cards, maintains the member list and membership plans, records cash and transfer payments, issues temporary passwords, revokes sessions, runs the weekly review and the weekly answer audit.
- Staff, the front desk officers. Draft cards for approval and record manual check ins for dead phones. Inside the member app they appear only as a name and a WhatsApp link.

Owner and staff screens live on separate routes behind a separate login with a separate session cookie, and are never reachable from the member app.

## One thing the agent must do well

Keep private records private.

- A private record is read by exact member ID taken from the server session, never from a request body.
- Private records are never searched across members and never embedded.
- Every private read writes an access log row in the same function, and a scheduled job asserts the session and target IDs match.
- No private model name may appear in any file under src/server/retrieval/. CI fails the build on a match.

This matters more in version three than it did in version two. There is no longer a one device rule, so the access log is the primary detector of a cross member read. If a change you are making would weaken any of these four, stop and ask.

## Defined scope for the MVP

Five member facing features and no more.

1. Ask about the gym. Answers from approved shared cards that the member's effective tier allows. Shows the source card and the date it was last confirmed. Refuses to serve any question while the approved card count is below the minimum in rules/retrieval.md.
2. My records. Answers from her own private records only. Attendance answers list the actual dates. Money is reported, never ruled on. Balance answers are gated on the condition in rules/payments.md. Until that condition is met, this feature answers attendance only.
3. Check in. The member generates a six digit single use code in the app, enters it at the door keypad, and the app confirms. Version one has no keypad and simulates the verification behind one module. One check in per member per calendar day.
4. Pay. Renewal or arrears. Only a verified gateway webhook confirms a payment. A confirmed renewal extends the expiry date inside the same transaction that records the payment.
5. Ask the desk. Names the officer on duty and opens WhatsApp with the question already typed.

Sign up and login are how a member reaches the app at all. They are not a feature and are not counted. The "this is wrong" report control sits on the answer screen in features 1 and 2 and is not a sixth feature.

Owner and staff screens are input, not features. Build them, do not count them.

Ship a web app the member saves to her home screen. Cache the app shell and her status. Never cache an answer.

Success metrics and the launch gates are product facts, not code rules. They live in docs/spotter-prd-v3.md sections 12 and 14, and there is no rules file for either. Do not build a reporting screen unless a task asks for it.

## Not in scope for the MVP

- Class booking and capacity.
- The app never initiates contact with a member. No message, no reminder, no nudge, no follow up, in any channel.
- Email sending of any kind, including password reset links. Password reset is an owner issued temporary password.
- Trainer chat or any member to staff messaging inside the app.
- Progress tracking, weight logs, body metrics.
- Referrals, streaks, leaderboards.
- Door access control. The app records a claimed arrival. It does not open the door.
- Building the door keypad. Version one simulates it.
- Multi gym support.
- Native Android app.
- Automatic monthly billing. Charges are posted manually by the owner.

One scheduled internal job is in scope and is described in rules/jobs.md. It does nothing member facing.

Later version features exist and are listed in docs/spotter-prd-v3.md. Do not build them early. If a task looks like one, stop and ask.

## Stack

- Next.js with the App Router.
- TypeScript.
- Prisma.
- PostgreSQL.
- pgvector for vector storage and similarity search.
- Flutterwave for payments. Any reference to another payment gateway in any document in this repo is void. Do not copy fee figures or webhook shapes from those references.
- Gemini free tier for the router model, the embedding model, and the answer model. All model calls go through a single interface module so the provider can be swapped. Rate limits and timeouts live in rules/ai.md.

## Folder map

- All application code lives under src/.
- src/app/api/ holds the route handlers.
- src/server/auth/session.ts is the only place the session cookie is read.
- src/server/router/rules.ts holds the deterministic never answer checks and runs before any model call.
- src/server/private/ holds every private record read. Member ID is argument one in every exported function.
- src/server/checkin/ holds code generation and eligibility.
- src/server/checkin/verifier.ts is the only place a check in code is consumed.
- src/server/retrieval/search.ts holds the vector query. It is one of only two raw SQL files.
- src/server/retrieval/index-card.ts holds chunk writes. It is the other raw SQL file.
- prisma/ holds the schema and the migrations.
- rules/ holds the rules files listed below.
- docs/ holds the PRD.

The map above is complete for server code. For components, hooks and tests, follow rules/structure.md.

## How to work in this codebase

- One change at a time. Make one change, show it, stop. Do not bundle refactors with features.
- Ask before adding any dependency, including dev dependencies and type packages. Name it, say what it does, say why nothing installed covers it. Wait for a yes.
- You may edit the Prisma schema. You may never run a migration, push, reset, seed, or any other command or script that writes to a database, in any environment, including through the ORM. Propose the migration and stop.
- Only files under src/server/ import the Prisma client. Route handlers, server components, server actions and jobs call those modules.
- Chunk reads and writes are raw SQL in the two retrieval files only, because the ORM cannot set the embedding column. Write no raw SQL anywhere else.
- Never hold a database transaction open across a model call or a gateway call.
- When retrieval returns nothing usable, return the refusal. Never call the answer model without source records attached.
- A refusal from the rules layer or from the router refuses. They are not weighed against each other.
- A check in code is consumed in one place only. Never write an attendance record from anywhere except the verifier.
- Before claiming a change works, run the commands listed in rules/commands.md and paste the output.
- List your assumptions at the end of every response. If you have none, write "Assumptions: none."
- Stop and ask when this file and the relevant rules file do not cover the decision. Do not guess a value, a rule, a threshold, a price, or a behaviour.
- Ask before changing anything that touches private records, tier gating, the never answer list, payment confirmation, or check in code consumption. These are the five places where a mistake is expensive.

## Where the detailed rules live

Read only the file that covers the task in front of you. Do not load all of them.

- rules/commands.md holds the build, typecheck, lint and test commands.
- rules/structure.md holds where components, hooks and tests live.
- rules/schema.md holds the data model, field names, sign conventions, indexes, and migration policy.
- rules/auth.md holds sign up, login, passwords, lockout, temporary passwords, sessions, and the separate staff and owner logins.
- rules/retrieval.md holds chunking, tier filtering, the similarity threshold, the minimum approved card count, reindexing, and the query conditions.
- rules/ai.md holds the rules layer pattern list, the router prompt, the answer prompt, the grounding check, rate limits, and stage time budgets.
- rules/checkin.md holds code generation, eligibility, expiry, the verifier seam, the simulation flag, manual check ins, and the anomaly flags.
- rules/payments.md holds Flutterwave integration, webhook verification, idempotency, pending and abandoned states, how a renewal extends membership, and the balance launch condition.
- rules/privacy.md holds private read rules, the access log, the privacy notice, retention periods, and the exit export.
- rules/client.md holds caching, offline behaviour, the check in screen states, and the data budget for a page open.
- rules/jobs.md holds the one scheduled job and what it does.
- rules/copy.md holds every fixed member facing string.
- rules/env.md holds every environment variable, what it is for, and where it is set.
- rules/ci.md holds the build time checks that block forbidden code paths.

If a rules file does not exist yet, say so and ask for it. Do not invent its contents.

## Definitions

- Member. A person the gym has registered. The owner creates her record. She then signs up against it using her member number.
- Member number. The identifier the gym already gives each member. It links a sign up to an existing member record. One record, one account.
- Shared record, also called a card. A short typed record the gym writes once for everyone, such as the timetable, prices, rules, access hours, guest policy, pause and cancellation terms, training plans, and trainer guidance. Shared records may be searched by meaning.
- Card version. One drafted revision of a card. Staff draft it, the owner approves it, and only an approved version is live.
- Approval. The owner's act of making a card version live. Nothing reaches a member unapproved.
- Last confirmed date. The date the owner last approved or reconfirmed a card. It is shown with every shared answer.
- Review interval. How often a card must be reconfirmed. It is a field on the card, not a constant in code.
- Private record. A record belonging to one member: her attendance, tier, expiry date, payment history, balance, email and password hash. Fetched by exact member ID. Never searched across members. Never embedded.
- Chunk. A piece of the text of an approved card version whose parent card is also approved. Chunks are embedded and stored for similarity search.
- Retrieval. Returns a chunk only when its card, its card version and its current version pointer all pass the checks in rules/retrieval.md.
- Tier. Basic or Premium. Tier decides which shared cards a member may see.
- Effective tier. The tier used for retrieval. It is the stored tier while the member is active or in grace, and Basic once she is expired or cancelled. Only the effective tier reaches the retrieval query.
- Status. Active, grace, expired or cancelled. Status is never stored. It is computed from the expiry date, the gym's grace days, and the cancellation timestamp.
- Grace. Days after expiry during which access is unchanged. The number is a field on the gym record, never a constant in code.
- Balance. Computed from the ledger by one function and never stored or typed. The formula lives in rules/schema.md.
- Arrears. What the ledger shows a member still owes. One of the two things a member can pay.
- Check in code. A six digit single use code the member generates in the app and enters at the door. It becomes an attendance record only when the verifier consumes it.
- Verifier. The one module that consumes a check in code and writes the attendance record. Version one ships a simulated implementation behind a flag. A real keypad replaces it without changing anything else.
- Temporary password. A single use password the owner issues when a member is locked out. It expires in twenty four hours and forces a password change on first use.
- Never answer list. The set of questions the app refuses even when a record exists: anything about another member, anything medical, whether the door will open right now, refunds and waivers and discounts and cancellation decisions, and staff conduct.
- Rules layer. The deterministic check that runs before any model call and refuses never answer questions with no network call.
- Router. The step that classifies a question into a shared intent, a private intent, a refusal, or unclear.
- Grounding check. Compares digit sequences in the answer against the source records and the question, and discards the answer on a mismatch. Numbers written as words are not checked.
- Handoff. Passing the member to the named officer on duty with her question carried over.