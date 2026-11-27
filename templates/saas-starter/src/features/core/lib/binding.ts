/**
 * Features read bindings here, so a missing one can turn into `NotConfigured` instead of a crash.
 */
export const binding = <T>(env: object, name: string): T | undefined => {
  const value = (env as Readonly<Record<string, unknown>>)[name];
  return value === undefined || value === null ? undefined : (value as T);
};
