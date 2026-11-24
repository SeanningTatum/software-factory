const escapeRegExp = (s: string) => s.replace(/[.+^$()|[\]\\]/g, "\\$&");

/** One glob token at `i`: its RegExp source and how many characters it used. */
const token = (glob: string, i: number): { readonly out: string; readonly used: number } => {
  const c = glob[i] as string;
  if (c === "*" && glob[i + 1] === "*") {
    return glob[i + 2] === "/" ? { out: "(?:.*/)?", used: 3 } : { out: ".*", used: 2 };
  }
  if (c === "*") return { out: "[^/]*", used: 1 };
  if (c === "?") return { out: "[^/]", used: 1 };
  if (c === "{") {
    const end = glob.indexOf("}", i);
    const options = glob
      .slice(i + 1, end)
      .split(",")
      .map(escapeRegExp);
    return { out: `(?:${options.join("|")})`, used: end - i + 1 };
  }
  return { out: escapeRegExp(c), used: 1 };
};

/** Turns a glob (`**`, `*`, `?`, `{a,b}`) into a RegExp for a path relative to the project root. */
export const globToRegExp = (glob: string): RegExp => {
  let out = "";
  for (let i = 0; i < glob.length; ) {
    const t = token(glob, i);
    out += t.out;
    i += t.used;
  }
  return new RegExp(`^${out}$`);
};

export const matchesAny = (path: string, globs: ReadonlyArray<string>) =>
  globs.some((g) => globToRegExp(g).test(path));
