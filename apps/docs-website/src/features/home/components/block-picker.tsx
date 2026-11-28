import type { MouseEvent } from "react";
import type { BlockName } from "../lib/blocks.ts";

const CHIPS: ReadonlyArray<BlockName> = ["db", "kv", "auth", "billing", "workflows", "uploads"];

export function BlockPicker({
  picked,
  disabled,
  onPick,
}: {
  picked: ReadonlyArray<BlockName>;
  disabled: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <fieldset className="mt-10 max-w-xl">
      <legend className="mb-3 text-[0.9375rem] text-muted-foreground">Pick your blocks</legend>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((name) => (
          <button
            key={name}
            type="button"
            value={name}
            aria-pressed={picked.includes(name)}
            className="rounded-sm border bg-background px-3 py-1.5 font-mono text-sm transition-colors duration-200 hover:border-foreground aria-pressed:border-crate aria-pressed:bg-crate aria-pressed:text-on-crate"
            disabled={disabled}
            onClick={onPick}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
