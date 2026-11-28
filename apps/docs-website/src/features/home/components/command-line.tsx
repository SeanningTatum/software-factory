import { type BlockName, CREATE_COMMAND, featuresFlag } from "../lib/blocks.ts";

export type CopyStatus = "idle" | "copying" | "copied" | "refused";

const LABEL: Record<CopyStatus, string> = {
  idle: "Copy",
  copying: "Copy",
  copied: "Copied",
  refused: "Select it",
};

export function CommandLine({
  picked,
  status,
  disabled,
  onCopy,
}: {
  picked: ReadonlyArray<BlockName>;
  status: CopyStatus;
  disabled: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex max-w-xl items-stretch rounded-md border bg-card shadow-[0_12px_32px_-18px_rgb(0_0_0/0.55)]">
      <code className="flex-1 px-4 py-3.5 font-mono text-sm leading-normal wrap-anywhere">
        {CREATE_COMMAND}
        {picked.length > 0 && " --features "}
        <span className="text-crate-ink">{featuresFlag(picked)}</span>
      </code>
      <button
        type="button"
        aria-live="polite"
        className="min-w-22 border-l px-4 text-sm hover:bg-crate hover:text-on-crate"
        disabled={disabled}
        onClick={onCopy}
      >
        {LABEL[status]}
      </button>
    </div>
  );
}
