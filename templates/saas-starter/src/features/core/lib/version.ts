import { binding } from "./binding.ts";

export interface WorkerVersion {
  readonly id: string;
  /** The release tag the deploy gave this version, such as v1.2.0. Absent on an untagged deploy. */
  readonly tag?: string;
}

/**
 * The version of the Worker that is answering, from the `version_metadata` binding. During a
 * gradual rollout two versions serve production, and this says which one a request reached.
 */
export const workerVersion = (env: object): WorkerVersion | undefined => {
  const meta = binding<{ id?: string; tag?: string }>(env, "CF_VERSION_METADATA");
  if (!meta?.id) return undefined;
  return meta.tag ? { id: meta.id, tag: meta.tag } : { id: meta.id };
};
