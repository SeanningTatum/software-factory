---
description: Define the product with the founder (product, persona, goals, anti-goals) and write docs/product/FOUNDATION.md
---

You are helping the founder write the product foundation: the one document every later workflow
(UI, UX, product) reads first. The founder decides everything in it. You ask, press on vague
answers, and write down what they said. Never fill a gap with your own guess.

## 1. Start

If `docs/product/FOUNDATION.md` exists, read it, show it, and ask what has changed. Skip to step 3
with the file as `previous` and their answer as `feedback`.

## 2. Interview

Ask one topic at a time, in plain text, and wait for each answer. Do not ask them all at once.

1. **Product.** What is it, in a sentence? Is the name fixed? What hurts today, and what do people
   use for it now, by name?
2. **Persona.** Who is the one primary user: their role, where they work, what they want, what
   stops them? Who might sign up but is not the user you build for?
3. **Scenario.** Walk me through the last time they had this problem: what set it off, where were
   they, on what device, how often does it happen, and what did done look like?
4. **Also affected.** Who else sees or is touched by the product, and what should they feel?
5. **Feel.** Three words for how it should feel, and three it must never be.
6. **Goals.** What must be true in three months and in a year? Ask for a number and a date for
   each. How does it earn: subscription, per seat, usage, something else?
7. **Anti-goals.** What tempting things will you not build or chase, and why?
8. **Assumptions.** What must be true for this to work that you have not proven yet?

Press once on an answer you could not act on: "everyone" is not a persona, "grow" is not a goal,
and an anti-goal nobody would build anyway is not one. If the founder does not know yet, record
that and move on; the document marks it as open.

## 3. Draft and challenge

Run the saved workflow `product-foundation` with
`args: { answers: { product, persona, scenario, alsoAffected, feel, goals, earns, antiGoals,
assumptions }, previous?, feedback? }`,
keeping the founder's words. It returns `{ markdown, gaps, questions }`.

## 4. The founder answers

Show the draft in full. Then put each question to the founder with AskUserQuestion, using the
question's own options and saying why it matters; batch up to four per call. Read out the Open
section too: the founder may settle any of it on the spot.

If they answered anything, run the workflow again with `previous` set to the draft and `feedback`
to every answer so far, as `[{ question, answer }]`: the readers skip what is already decided. Then
repeat this step. Stop when no questions come back or the founder says it
is good enough: what is unsettled stays in the document's Open section.

## 5. Approve and write

Show the final document and ask: write it? Only on a yes:

- Write it to `docs/product/FOUNDATION.md`, with a last line `Agreed <today's date>`.
- In `README.md`, replace what sits between the title and the first `## ` heading with the Product
  sentence, one line on who it is for, and a link to `docs/product/FOUNDATION.md`. Leave the rest.
- If the root `CLAUDE.md` does not name that file yet, add one rule: "Read
  `docs/product/FOUNDATION.md` before any product, UI or UX work. Stop if the work conflicts with
  an anti-goal, and ask before deciding anything its Open section leaves unsettled." If `CLAUDE.md`
  is at its 80-line limit, shorten another rule to make room and say which.

Do not commit. Tell the founder the file is written and that a change of mind means running
`/foundation` again, not editing around it.
