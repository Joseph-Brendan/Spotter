Ship a change
Run this every time. The steps are ordered so the cheap checks fail before the expensive ones.

Do not start until the code works.

1. Confirm the change is one thing
State in one sentence what this change does.

If the sentence needs the word "and" to join two unrelated things, stop. Split it. Follow rules/git.md for the one branch, one change rule.

Checkable: the sentence is in your response and contains one change.

2. Check the working tree
Run a status check. State whether anything in the tree was changed by someone other than you.

If there is work you did not do, stop and say what you see. Follow rules/git.md.

Checkable: you have stated the tree is clean of other people's work, or stopped.

3. Run the three commands
Run the three commands in rules/commands.md, in the order that file gives, and paste the output of each.

All three must pass. If one fails, fix it and run all three again from the top. Do not carry a failure forward.

Checkable: three blocks of output are in your response, all passing.

4. Run the production build
Run the production build command from rules/commands.md and paste the output.

A green dev server does not replace this step. The build rejects errors the dev server tolerates.

Checkable: the build output is in your response and it succeeded.

5. Check the five expensive areas
Answer five yes or no questions about your change:

Did it touch anything under src/server/private/?
Did it touch tier or status logic?
Did it touch a refusal path?
Did it touch payment confirmation?
Did it touch check in code generation or consumption?
For every yes, run the tests for that area from rules/testing.md and paste the output.

For every no, say no.

Checkable: five answers are in your response, and output exists for every yes.

6. Check the check in simulation flag
Answer one question: did this change touch anything under src/server/checkin/ or the environment validation module?

If yes, state the current default of the simulation flag and confirm it is still off. Follow rules/env.md.

If no, say no.

Checkable: you have stated yes with the flag default, or no.

7. Check for a schema change
State whether prisma/schema.prisma changed.

If it did, stop here. Follow rules/schema.md: say that a migration is needed and describe what it does. Do not open the pull request until the migration is agreed.

If it did not, continue.

Checkable: you have stated yes or no.

8. Branch and commit
Create the branch and write the commit. Follow rules/git.md for both the branch name and the message shape.

Checkable: the branch name and the commit message are in your response.

9. Read your own diff
Read the full diff before opening the pull request.

State anything in it that is not part of the one sentence from step 1. A stray console line, a reformatted file, an unrelated import.

Remove anything you find.

Checkable: you have stated that the diff contains only the one change, or named what you removed.

10. Open the pull request
Open it with the change described in plain English: what changed and why.

Checkable: the pull request exists and its description names the change.

Decision tree: a step fails and you cannot fix it
Stop at that step. Report the failure verbatim.

Do not skip the step, do not work around it, and do not edit a script or a test to make it pass. A check edited to go green removes the only signal you had.

