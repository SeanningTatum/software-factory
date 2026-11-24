const escape = (s: string) => s.replace(/[.+^$()|[\]\\]/g, "\\$&");

/** Turns a glob (`**`, `*`, `?`, `{a,b}`) into a RegExp for a path relative to the project root. */
export const globToRegExp = (glob: string): RegExp => {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      out += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      out += `(?:${glob.slice(i + 1, end).split(",").map(escape).join("|")})`;
      i = end;
    } else out += escape(c);
  }
  return new RegExp(`^${out}$`);
};

export const matchesAny = (path: string, globs: ReadonlyArray<string>) =>
  globs.some((g) => globToRegExp(g).test(path));
