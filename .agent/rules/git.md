---
trigger: always_on
---

# Git

This file controls what you may do to the repository and its history.

## Branches

Never commit to main.

Reason: main is what gets deployed, and a commit straight to it skips every
check in rules/commands.md and rules/ci.md.

One branch per change, named type/short-description. Types: feat, fix, chore,
docs, refactor. A branch does one thing. If you find a second thing, stop and
say so.

## Commits

- One line, imperative, under 72 characters, saying what changed.
- A body only when the change needs a reason recording.
- Never describe the process. "Fix retrieval tier filter" is right. "Address
  feedback" is not.

Reason: the log is read years later by someone looking for when a behaviour
changed.

## Work you did not do

Never stash, revert, commit or discard a change you did not make. If the working
tree is dirty when you start, say what you see and stop.

Reason: uncommitted work is unrecoverable once discarded.

## Never

- Never force push.
- Never rebase or amend a commit that is already pushed.
- Never delete a branch you did not create.
- Never commit: .env or any environment file, any key or token, any real member
  data, any database dump, node_modules, generated client output, build output.
- Never resolve a merge conflict by taking one side wholesale. Read both, then
  say what you did.

Reason: history is the only record of what the code used to be. Rewriting it
removes the ability to find out when something broke.

## Before a pull request

The three commands in rules/commands.md pass, the production build passes, and
the diff contains only the one change.

## If you are unsure

Stop and ask. An unwanted commit is cheap to prevent and expensive to unpick.