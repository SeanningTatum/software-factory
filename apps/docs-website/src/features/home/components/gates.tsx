const GATES: ReadonlyArray<readonly [name: string, what: string]> = [
  ["Lint", "Biome, plus house rules: no throw, no try/catch, no stray process.env."],
  ["Types", "Strict TypeScript across the project."],
  ["Tests", "Every source file has a test beside it, and the test must run code."],
  ["State machines", "Every flow a user can see is a tested XState machine."],
  ["Feature layout", "A feature owns one folder and nothing outside it."],
  ["Feature matrix", "Before a release, every block combination is built and checked."],
];

export function Gates() {
  return (
    <>
      <div
        aria-hidden="true"
        className="mt-12 h-2.5 rounded-xs bg-[repeating-linear-gradient(115deg,var(--boom)_0_28px,var(--foreground)_28px_56px)]"
      />
      <dl className="mt-10 grid gap-x-20 md:grid-cols-2">
        {GATES.map(([name, what]) => (
          <div key={name} className="grid gap-x-4 gap-y-1 border-b py-4 sm:grid-cols-[9.5rem_1fr]">
            <dt className="font-medium">{name}</dt>
            <dd className="text-[0.9375rem] text-muted-foreground">{what}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
