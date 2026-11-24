import { Effect } from "effect";

/**
 * One call to something outside the Worker (a binding, an API, a library that does I/O) as an
 * Effect: a rejected promise becomes `onError(cause)`, and the call gets its own client span.
 */
export const outsideCall = <A, E>(
  span: string,
  run: () => Promise<A>,
  onError: (cause: unknown) => E,
  attributes?: Readonly<Record<string, unknown>>,
): Effect.Effect<A, E> =>
  Effect.tryPromise({ try: run, catch: onError }).pipe(
    Effect.withSpan(span, { kind: "client", ...(attributes ? { attributes } : {}) }),
  );
