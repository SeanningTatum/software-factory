export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export class PosthogError extends Error {}

/**
 * Creates a project in the personal key's current organization and returns its project key, the
 * one events are sent with. The key needs the `project:write` scope.
 */
export const createProject = async (
  fetcher: Fetch,
  ingestHost: string,
  personalKey: string,
  name: string,
): Promise<string> => {
  const api = ingestHost.replace(".i.posthog.com", ".posthog.com");
  const response = await fetcher(`${api}/api/organizations/@current/projects/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${personalKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    api_token?: unknown;
    detail?: unknown;
  };
  if (response.ok && typeof body.api_token === "string") return body.api_token;
  throw new PosthogError(
    `PostHog did not create ${name} (${response.status}${typeof body.detail === "string" ? `: ${body.detail}` : ""})`,
  );
};
