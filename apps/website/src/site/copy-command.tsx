import { useState } from "react";

const RESET_MS = 1500;

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 font-mono text-sm">
      <span className="select-none text-muted-foreground">$</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() =>
          void navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), RESET_MS);
          })
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
