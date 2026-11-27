import { Effect } from "effect";

export const outsideCall = <A, E>(
  span: string,
  run: () => Promise<A>,
  onError: (cause: unknown) => E,
  attributes?: Readonly<Record<string, unknown>>,
): Effect.Effect<A, E> =>
  Effect.tryPromise({ try: run, catch: onError }).pipe(
    Effect.withSpan(span, { kind: "client", ...(attributes ? { attributes } : {}) }),
  );
