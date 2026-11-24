/** `--blocks` was the flag before features; it still works, and is not listed in --help. */
export const legacyArgs = (argv: ReadonlyArray<string>): Array<string> =>
  argv.map((arg) =>
    arg === "--blocks"
      ? "--features"
      : arg.startsWith("--blocks=")
        ? `--features=${arg.slice(9)}`
        : arg,
  );
