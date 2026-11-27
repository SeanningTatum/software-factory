# claude

The Claude harness that ships to new projects. It is a stand-in until B-08.

`create-software-factory` copies everything here except this README into each new project's
`.claude/` folder, and moves a top-level `CLAUDE.md`, if there is one, to the project root. It
records a hash per file in `harness.lock.json`.

## Workflow blocks

A block is two files with one job, the way a feature is one folder:

| File                    | What it does                                                                |
| ----------------------- | --------------------------------------------------------------------------- |
| `workflows/<name>.js`   | A Claude dynamic workflow: the agent work. It never talks to the human.     |
| `commands/<command>.md` | The human's side: what to ask, when to run the script, when to stop and ask. |

A script cannot pause for a person, so every stop lives in the command: it asks, runs the script,
shows what came back, asks again, and writes only after a yes.

Rules for a new block:

- **The script takes one `args` object and returns `{ markdown, gaps, questions }`.** `questions`
  is what the command puts to the human next; each has `section`, `question`, `why` and `options`.
- **It builds on the foundation.** Its agents read `docs/product/FOUNDATION.md` first, by the
  headings in `SECTIONS` in `workflows/product-foundation.js`. If the file is missing, the command
  stops and sends the human to `/foundation`.
- **It never settles what the foundation leaves open.** An item in the `Open` section that bears on
  the block's work becomes a question for the human, not a guess.
- **It writes one file under `docs/product/`**, and only its command writes it.
- **Blocks compose with `workflow("<name>", args)`**, one level deep. A script that needs another
  block's result calls it; it does not copy its prompts.
- **It has a golden test in `evals/<name>/`**, which does not ship: `cases.json` (inputs with planted
  flaws the output must catch), `check.js`, a saved real output per case in `golden/`, and at least
  one output in `bad/` that the checks refuse. `apps/cli/src/workflow-blocks.test.ts` fails a
  workflow without them. `evals/README.md` says how to run one.
- **`meta.name` is the file name**, and differs from the command's name: a saved workflow also
  runs as `/<name>`, without the stops.

| Block      | Command       | Script                  | Writes                       |
| ---------- | ------------- | ----------------------- | ---------------------------- |
| Foundation | `/foundation` | `product-foundation.js` | `docs/product/FOUNDATION.md` |

`docs/workflow-blocks.md` draws the flow, with a sample of what goes in and out.

To try a script here, copy it into `.claude/workflows/` and run `/reload-skills`.
