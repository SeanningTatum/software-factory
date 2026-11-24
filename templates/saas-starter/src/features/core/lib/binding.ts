/**
 * A Cloudflare binding from the Worker's env by name, typed as the part of it the caller uses, or
 * undefined when wrangler.jsonc does not declare it. Features that need a binding read it here, so
 * a missing one can turn into `NotConfigured` instead of a crash.
 */
export const binding = <T>(env: object, name: string): T | undefined => {
  const value = (env as Readonly<Record<string, unknown>>)[name];
  return value === undefined || value === null ? undefined : (value as T);
};
