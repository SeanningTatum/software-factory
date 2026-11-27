import { binding } from "./binding.ts";

export interface WorkerVersion {
  readonly id: string;
  readonly tag?: string;
}

/**
 * During a gradual rollout two versions serve production; this says which one a request reached.
 */
export const workerVersion = (env: object): WorkerVersion | undefined => {
  const meta = binding<{ id?: string; tag?: string }>(env, "CF_VERSION_METADATA");
  if (!meta?.id) return undefined;
  return meta.tag ? { id: meta.id, tag: meta.tag } : { id: meta.id };
};
