import type { MouseEvent } from "react";
import { BLOCKS_TOP_FIRST, type BlockName } from "../lib/blocks.ts";
import { Plate } from "./plate.tsx";

const ROW =
  "grid w-full grid-cols-[5.5rem_1fr_auto] items-baseline gap-4 border-b py-2 text-left lg:grid-cols-[7.5rem_1fr_auto] lg:pl-4";

export function BlockStack({
  picked,
  disabled,
  onPick,
}: {
  picked: ReadonlyArray<BlockName>;
  disabled: boolean;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="mt-12 grid lg:grid-cols-[420px_1fr]">
      <svg
        viewBox="0 0 420 622"
        className="mx-auto w-full max-w-[420px]"
        role="img"
        aria-label="The picked blocks as a stack of plates"
      >
        <defs>
          <pattern
            id="hatch"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(38)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--muted-foreground)" strokeWidth="1" />
          </pattern>
        </defs>
        <Plate index={BLOCKS_TOP_FIRST.length} state="base" />
        {BLOCKS_TOP_FIRST.toReversed().map((block) => (
          <Plate
            key={block.name}
            index={BLOCKS_TOP_FIRST.indexOf(block)}
            state={picked.includes(block.name) ? "in" : "out"}
          />
        ))}
      </svg>
      <ul className="pt-4 lg:pt-[46px]">
        {BLOCKS_TOP_FIRST.map((block) => (
          <li key={block.name} className="flex items-center lg:h-[72px]">
            <button
              type="button"
              value={block.name}
              aria-pressed={picked.includes(block.name)}
              className={`${ROW} group`}
              disabled={disabled}
              onClick={onPick}
            >
              <span className="font-mono group-hover:text-crate-ink group-aria-[pressed=false]:text-muted-foreground">
                {block.name}
              </span>
              <span className="text-[0.9375rem] leading-snug text-muted-foreground">
                {block.summary}
              </span>
              <span className="min-w-10 text-right font-mono text-[0.8125rem] text-muted-foreground group-aria-pressed:text-crate-ink">
                {picked.includes(block.name) ? "in" : "out"}
              </span>
            </button>
          </li>
        ))}
        <li className="flex items-center lg:h-[72px]">
          <div className={ROW}>
            <span className="font-mono">base</span>
            <span className="text-[0.9375rem] leading-snug text-muted-foreground">
              Always in: logs, analytics, the UI kit, cookie consent and the home page.
            </span>
            <span className="min-w-10 text-right font-mono text-[0.8125rem] text-muted-foreground">
              in
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}
