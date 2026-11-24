import type { ReactNode } from "react";

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-semibold tracking-tight">{children}</h1>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-7 text-muted-foreground">{children}</p>;
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg border bg-card p-4 font-mono text-sm">
      <code>{children}</code>
    </pre>
  );
}

export function List({ items }: { items: ReadonlyArray<ReactNode> }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static content that never reorders.
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
