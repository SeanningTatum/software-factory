/**
 * A feature's TIMELINE.md has marked blocks that tools write and a part people write.
 * `cf-saas-blocks sync` owns the generated block; `bun run machines:print` owns the machines block.
 */
export const TIMELINE_FILE = "TIMELINE.md";
export const GENERATED_START = "<!-- generated:start -->";
export const GENERATED_END = "<!-- generated:end -->";
export const MACHINES_START = "<!-- machines:start -->";
export const MACHINES_END = "<!-- machines:end -->";

const span = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  const to = from < 0 ? -1 : text.indexOf(end, from);
  return to < 0 ? undefined : { from, to: to + end.length };
};

/** The text with both marked blocks cut out: what people wrote by hand. */
export const handWritten = (text: string): string =>
  [
    [GENERATED_START, GENERATED_END],
    [MACHINES_START, MACHINES_END],
  ].reduce((acc, [start = "", end = ""]) => {
    const s = span(acc, start, end);
    return s ? acc.slice(0, s.from) + acc.slice(s.to) : acc;
  }, text);

/**
 * Puts `block` (markers included) where the marked block is, or after `anchor` when there is none.
 * An empty `block` removes the marked block and the blank line before it.
 */
export const withBlock = (
  text: string,
  start: string,
  end: string,
  block: string,
  anchor: string,
): string => {
  const s = span(text, start, end);
  if (s) {
    if (block) return text.slice(0, s.from) + block + text.slice(s.to);
    const from = text.slice(s.from - 2, s.from) === "\n\n" ? s.from - 2 : s.from;
    return text.slice(0, from) + text.slice(s.to);
  }
  if (!block) return text;
  const at = text.indexOf(anchor);
  if (at < 0) return `${text.trimEnd()}\n\n${block}\n`;
  const after = at + anchor.length;
  return `${text.slice(0, after)}\n\n${block}${text.slice(after)}`;
};
