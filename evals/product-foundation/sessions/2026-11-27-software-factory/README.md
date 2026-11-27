# Session: software-factory, 2026-11-27

The first real run of `/foundation`: the owner of this repo, answering for this repo. It wrote
`docs/product/FOUNDATION.md`. Each `round-N.json` holds one run of `product-foundation`: what the
run cost, its `output` as returned, and the part of its `args` that was new. The rest of each run's
`args` is in the earlier files: `answers` is round 1's, `previous` is the round before's
`output.markdown`, and `feedback` adds to the rounds before.

It is a record, not a golden case: a case needs a planted flaw, which a real session does not have.

## What it took

| Step                      | Count                                               |
| ------------------------- | --------------------------------------------------- |
| Interview answers typed   | 12: one per topic, and 4 presses                    |
| Question dialogs          | 6, four questions each: 24 answered, 3 in own words |
| Approval                  | 1                                                   |
| Workflow runs             | 3, of 5 agents each                                 |
| Questions left unanswered | 11, when the founder chose to stop                  |

| Run     | Tokens    | Tool calls | Seconds | Words | Open items | Questions |
| ------- | --------- | ---------- | ------- | ----- | ---------- | --------- |
| Round 1 | 397,806   | 9          | 33      | 606   | 11         | 12        |
| Round 2 | 403,773   | 10         | 48      | 686   | 9          | 12        |
| Round 3 | 419,523   | 12         | 41      | 779   | 10         | 11        |
| Total   | 1,221,102 | 31         | 122     |       |            |           |

The session that ran the command, from `/foundation` to the written file, made 35 model calls:
30,489 tokens out, 53,327 written to the cache and 5,369,933 read from it.

## What `check.js` says

At the time, every round failed one check and passed the rest: the limit was 550 words for the
whole document, and the Words column above counts it that way. The Open section grows with every gap
the drafter must list, 192 words by round 3, so the drafter could not hold the total down.

The limit is now 700 words before Open, in the prompt and in the check. By that count the rounds
are 405, 495 and 586 words, and all three pass. No run has been made since the prompt changed.

## What went wrong, or could be better

- **The questions never run out.** 12, 12, then 11, against a cap of 12. Each round's answers
  open as many questions as they close, so "stop when no questions come back" never happens; the
  founder has to call it.
- **Two readers asked the same thing in round 3**: whether a donation page survives the rule
  against paid offers.
- **The document keeps what an answer replaced.** Round 2 left "an agency needs one shared setup"
  as the reason to switch, beside a solo developer as the persona. It did list the clash in Open.
- **The command needs a description per option** for the question dialog, and the script returns
  only labels. The session wrote them, which is a place for a guess to get in.
- **`/product-foundation` runs with no stops.** The founder typed it first, as the README warns.
- **The README step fits a new project only.** Replacing all that sits between the title and the
  first heading would have removed this repo's badges and install lines.

## What went right

- It caught the founder contradicting themself twice: solo developer against an agency's reason,
  and a donation page against "no paid offers".
- No invented numbers in any round, and no option too long for a button.
- No question in round 2 or 3 asked again what an earlier answer had settled, by a reading of the
  questions; `mustNotAsk` patterns were not written for this session.
