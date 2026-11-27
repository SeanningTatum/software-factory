const HEADINGS = [
  "Product",
  "Problem",
  "Persona",
  "Core scenario",
  "Also affected",
  "Not for",
  "Feel",
  "Goals",
  "Anti-goals",
  "Assumptions",
  "Open",
];
const MAX_WORDS = 550;
const MAX_QUESTIONS = 12;
const MAX_OPTION_CHARS = 30;

const numbers = (text) => (text.match(/\d[\d,]*/g) ?? []).map((n) => n.replaceAll(",", ""));
const words = (text) => text.trim().split(/\s+/).length;
const matches = (pattern, text) => new RegExp(pattern, "i").test(text);

export const check = (testCase, output) => {
  const failures = [];
  const { markdown, gaps, questions } = output;

  const found = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  if (found.join("|") !== HEADINGS.join("|")) failures.push(`headings are ${found.join(", ")}`);
  if (words(markdown) > MAX_WORDS) failures.push(`document is ${words(markdown)} words`);

  const beforeOpen = markdown.split(/^## Open$/m)[0];
  if (/\bOpen:/.test(beforeOpen)) failures.push("an open item sits outside the Open section");
  const listed = (markdown.split(/^## Open$/m)[1] ?? "").match(/^- /gm)?.length ?? 0;
  if (listed !== gaps.length) failures.push(`Open lists ${listed} items, gaps has ${gaps.length}`);

  const given = new Set(numbers(JSON.stringify(testCase.args)));
  const invented = numbers(markdown.replace(/^\d+\. /gm, "")).filter((n) => !given.has(n));
  if (invented.length) failures.push(`invented numbers: ${[...new Set(invented)].join(", ")}`);

  if (questions.length > MAX_QUESTIONS) failures.push(`${questions.length} questions`);
  const long = questions.flatMap((q) => q.options).filter((o) => o.length > MAX_OPTION_CHARS);
  failures.push(...long.map((o) => `option too long for a button: "${o}"`));

  const raised = [...gaps, ...questions.map((q) => `${q.question} ${q.why}`)].join("\n");
  const missed = testCase.mustCatch.filter(({ pattern }) => !matches(pattern, raised));
  failures.push(...missed.map(({ flaw }) => `missed: ${flaw}`));
  const again = testCase.mustNotAsk.filter(({ pattern }) =>
    questions.some((q) => matches(pattern, q.question)),
  );
  failures.push(...again.map(({ settled }) => `asked again: ${settled}`));

  return failures;
};
