export const meta = {
  name: "product-foundation",
  description: "Draft the product foundation from the founder's answers and list what is still vague",
  whenToUse: "Run by /foundation with { answers, previous?, feedback? }. It never asks the human.",
  phases: [
    { title: "Draft", detail: "write the document from the answers alone" },
    { title: "Challenge", detail: "four readers look for what is vague or in conflict" },
  ],
};

const SECTIONS = [
  ["Product", "One sentence: what it is and who it is for. Say if the name is fixed or a working name."],
  ["Problem", "What hurts today, and what people do about it now, with the tools they use by name."],
  ["Persona", "The one primary user: role, setting, what they want, what stops them."],
  ["Core scenario", "One typical use: what sets it off, where they are and how often, what done looks like."],
  ["Also affected", "Who else sees or is touched by the product, and what they should feel."],
  ["Not for", "Who might sign up but is not the user we build for."],
  ["Feel", "A few words for how it should feel, and a few for what it must never be."],
  ["Goals", "A numbered list. Each has a number and a date to check it by. Then a line: Earns by: <how>."],
  ["Anti-goals", "A numbered list of tempting things we will not build or chase, each with why."],
  ["Assumptions", "What must be true for this to work and is not yet proven."],
  ["Open", "A list of everything missing or in conflict, each line starting with its section's name."],
];

const LENSES = [
  [
    "persona",
    "Read Persona, Core scenario, Also affected, Not for and Feel. Could two people read them and picture different users or a different moment of use? Does Not for turn away anyone who would otherwise sign up? Does Feel suit both the user and the others affected?",
  ],
  [
    "goals",
    "Read Goals. Can each be checked on a date with a number? Does any goal pull against another, or against an anti-goal? Does the way it earns fit the goals?",
  ],
  [
    "anti-goals",
    "Read Anti-goals. Would a sensible team be tempted to build each one? One that nobody would build anyway is not an anti-goal. Does each give a reason clear enough to judge whether a new feature conflicts with it? Which tempting thing is missing?",
  ],
  [
    "problem",
    "Read Problem and Assumptions. Is there any evidence the problem is real? Which assumption, if false, ends the product? Which alternative do users already have, and why would they leave it?",
  ],
];

const DRAFT = {
  type: "object",
  required: ["markdown", "gaps"],
  properties: {
    markdown: { type: "string" },
    gaps: { type: "array", items: { type: "string" } },
  },
};

const QUESTIONS = {
  type: "object",
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["section", "question", "why", "options"],
        properties: {
          section: { type: "string" },
          question: { type: "string" },
          why: { type: "string" },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string", maxLength: 30 },
          },
        },
      },
    },
  },
};

if (!args?.answers) throw new Error("product-foundation needs args.answers");

const outline = SECTIONS.map(([name, holds]) => `## ${name}\n${holds}`).join("\n\n");
const source = args.previous
  ? `Revise this document:\n\n${args.previous}\n\nThe founder answered the open questions:\n\n${JSON.stringify(args.feedback, null, 2)}\n\nTheir first answers, for reference:\n\n${JSON.stringify(args.answers, null, 2)}`
  : `The founder's answers:\n\n${JSON.stringify(args.answers, null, 2)}`;

phase("Draft");
const draft = await agent(
  `Write a product foundation document. Every later workflow (brand, UI, UX, features) reads it before it does anything, so it must be short, exact and free of filler.

${source}

Use exactly these headings, in this order, under a top heading "# Product foundation":

${outline}

Rules:
- Use only what the founder said. Never invent a user, a number, a date, a feeling or a name. A section with nothing said for it holds the one line "See Open."
- Everything missing, or too vague to act on, goes in the Open section and nowhere else, one line each, as "- <Section>: <what is missing>". Return the same lines in "gaps". With nothing open, the section holds "Nothing."
- Where two things the founder said pull against each other, keep both as said and add an Open line that names the conflict.
- Keep the founder's own words where they are clear. Plain short words, active voice, no marketing language.
- Under 700 words, not counting the Open section.

Return the document in "markdown".`,
  { label: "draft", schema: DRAFT },
);
if (!draft) throw new Error("The draft agent returned nothing");

phase("Challenge");
const settled = args.feedback
  ? `\nThe founder has already decided these. Do not ask them again, even if you would decide otherwise:\n\n${JSON.stringify(args.feedback, null, 2)}\n`
  : "";
const asked = await parallel(
  LENSES.map(([label, task]) => () =>
    agent(
      `You are a hard reader of a product foundation document. ${task}

${draft.markdown}
${settled}
Return at most three questions for the founder, and only ones whose answer would change the document. For each: the section it is about, the question in one sentence, why it matters in one sentence, and two to four answers the founder could pick from, each 30 characters or fewer so it fits on a button. Return none if the section holds up.`,
      { label: `challenge:${label}`, phase: "Challenge", schema: QUESTIONS },
    ),
  ),
);
const lost = asked.filter((a) => !a).length;
if (lost) log(`${lost} of ${LENSES.length} readers failed; their questions are missing`);

return {
  markdown: draft.markdown,
  gaps: draft.gaps.map((gap) => gap.replace(/^- /, "")),
  questions: asked.filter(Boolean).flatMap((a) => a.questions),
};
