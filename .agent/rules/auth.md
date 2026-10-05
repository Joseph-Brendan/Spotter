---
trigger: glob
globs: src/server/auth/**, src/middleware.ts
---

# Auth

This file controls identity: how a person proves who they are and how long the
proof lasts. It does not control what they can then see. That is
rules/membership.md.

## Three separate identities

Member, staff and owner sessions use separate cookies, separate secrets and
separate middleware branches. A staff session never grants access to a member
route, and the reverse.

Reason: one cookie with a role field is one bug away from a member holding an
owner session.

## Cookie attributes

Every session cookie is httpOnly, secure, sameSite lax, and scoped to the path
of its route group.

Reason: without httpOnly any script on the page can read the session. Without
secure it travels in clear text on a bad network. Lax is what allows the return
trip from the payment gateway to keep the session alive.

## Sign up

Four fields, all required: full name, email, password, member number.

The member number must match an existing member record that has no account
attached. If it does not match, or the record already has an account, sign up
fails and no account row is created.

Reason: the member number is the only thing linking an account to a member
record. Without it, anyone with an email address could create an account and
the app would have no idea whose attendance and balance to show her.

The privacy notice is accepted during sign up, before the account row is
created. See rules/privacy.md.

## Email

One email, one account. Stored lowercase and trimmed. Comparison is case
insensitive.

Reason: a member who signs up as Chioma@example.com and logs in as
chioma@example.com is the same person and must not get a second account.

## Passwords

- Minimum eight characters. No maximum below 128.
- No composition rules. No forced symbols, no forced digits, no forced capitals.
- Hashed with Argon2id.
- Never stored in plain form, never logged, never returned in any response or
  error, never sent by email.

Reason for no composition rules: they push people toward one predictable
pattern and toward writing the password down. Length is the control that
matters.

Argon2id needs a package. Ask before adding it, per AGENTS.md.

## Login

Email and password. Nothing else. No code, no PIN, no device check.

## Lockout

- Five consecutive failed logins for one email lock that account for fifteen
  minutes. While locked, the correct password also fails.
- Twenty failed logins from one IP address in one hour are refused for one hour.

Reason: the email and password pair is the only thing standing in front of a
member's records, so the brute force limit is the whole defence.

## Error messages

One message covers a wrong email and a wrong password alike. It never reveals
whether the email is registered. See rules/copy.md for the wording.

Reason: a message that distinguishes the two tells an attacker which emails
exist.

## Password reset

There is no self service reset. Version one sends no email.

The owner issues a temporary password from the owner screen. It is single use,
expires in twenty four hours, and is hashed like any other password.

On logging in with a temporary password, the member is sent straight to a
change password screen. Nothing else loads until she sets a new one. She cannot
navigate away, and no private record is served to a session holding a temporary
password.

The owner screen displays the temporary password once and never again.

Reason: an email service is another dependency and another cost, and the only
reset case version one has is a member standing at the desk.

## Sessions

- A session lasts ninety days from last use and refreshes on each request.
- A session is not bound to a device. A member may be logged in on more than one
  device at once.
- Changing the password revokes every session for that account except the one
  that changed it.
- The owner can list and revoke all sessions for one member.

Reason for dropping the one device rule: sign up is self service and there is no
desk step to re link a device, so a device rule would lock members out with no
way back. The compensating controls are the access log detector in
rules/privacy.md, revoke on password change, and owner revoke.

Revoking marks a session revoked. It does not delete the row.

Reason: the event needs to stay visible when somebody asks what happened.

## Re authentication before payment

The member re enters her password before any payment starts. See
rules/payments.md.

## Staff and owner logins

Password based, on separate routes. Never reachable from the member app.

## OPEN

The PRD does not specify staff password rules, staff session length, or whether
staff and owner share one login route with different permissions. Ask before
building.

The PRD asks in Q-6 whether a member should see and revoke her own sessions.
Version one says no, owner revoke only. Do not build the member facing screen
without asking.