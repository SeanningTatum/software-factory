# evals

Golden tests for the workflows in `claude/workflows/`. Nothing here ships to new projects.

Every workflow has a folder named after it:

| File                    | What it holds                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `cases.json`            | The inputs. Each case plants flaws and lists them in `mustCatch`; `mustNotAsk` lists what is already decided. |
| `check.js`              | `check(case, output)` returns what is wrong with an output, in plain code with no model.                      |
| `golden/<case>.json`    | A real output for each case. It must pass the checks.                                                         |
| `bad/<case>-<why>.json` | A real output that went wrong. The checks must refuse it, which proves they can fail.                         |

`apps/cli/src/workflow-blocks.test.ts` holds every workflow to this, so `bun run check` fails one
with no cases, a case with no saved output, or a saved output that breaks a check.

## After a change to a prompt

The saved outputs are only as fresh as the last run, and a run costs tokens, so CI does not make
them. Before you merge a change to a workflow's script:

1. Run the workflow once per case, with the case's `args`.
2. Save each result over `golden/<case>.json`.
3. Run `bun run --filter create-software-factory test`. A failure is a real fault in the output:
   fix the prompt or the schema, not the saved file. An output worth keeping as a warning goes in
   `bad/`.
4. Add a row below.

"Caught" is a regex per planted flaw, not a judge: it is free and exact, but a reworded question can
slip past a pattern. Swap in a judge when one misfires.

One run per case can pass or fail by luck. If a check fails once in a few runs, treat it as failing.

## Runs

| Date       | Workflow           | Case         | Caught | Asked again | Invented | Format             | Tokens  |
| ---------- | ------------------ | ------------ | ------ | ----------- | -------- | ------------------ | ------- |
| 2026-11-27 | product-foundation | first-round  | 3 of 3 | 0           | 0        | 9 options too long | 304,511 |
| 2026-11-27 | product-foundation | second-round | 2 of 2 | 2           | 0        | pass               | 305,132 |
| 2026-11-27 | product-foundation | second-round | 2 of 2 | 0           | 0        | 1 option too long  | 229,253 |
| 2026-11-27 | product-foundation | first-round  | 3 of 3 | 0           | 0        | pass               | 304,665 |
| 2026-11-27 | product-foundation | second-round | 2 of 2 | 0           | 0        | pass               | 237,193 |
| 2026-11-27 | product-foundation | first-round  | 3 of 3 | 0           | 0        | pass               | 410,004 |
| 2026-11-27 | product-foundation | second-round | 2 of 2 | 0           | 0        | pass               | 402,881 |

The first two rows are the outputs kept in `bad/`; the fixes that followed are the settled list
handed to the readers and the 30-character limit on an option. The third and fifth rows reused a
cached draft; the fifth replaced the third once that limit was in the schema. The last two rows are the first runs with
eleven sections and four readers, and are the outputs now in `golden/`.
