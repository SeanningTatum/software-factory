const COMMANDS: ReadonlyArray<readonly [command: string, what: string]> = [
  ["add billing", "Adds a block, and the blocks it needs."],
  ["remove uploads", "Removes a block and everything it owns."],
  ["setup", "Creates the Cloudflare resources, migrates, sets secrets and deploys."],
  ["github", "Puts the project on GitHub with branch rules and deploy settings."],
  ["harness sync", "Updates the Claude Code files from the CLI's copy."],
];

export function CliCommands() {
  return (
    <ul className="border-t">
      {COMMANDS.map(([command, what]) => (
        <li
          key={command}
          className="grid gap-x-4 gap-y-1 border-b py-3.5 text-[0.9375rem] text-muted-foreground sm:grid-cols-[11rem_1fr]"
        >
          <code className="font-mono text-foreground">{command}</code>
          {what}
        </li>
      ))}
    </ul>
  );
}
