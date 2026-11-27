import { describe, expect, test } from "bun:test";
import { createProject, type Fetch, PosthogError } from "./posthog.ts";

const answering = (status: number, body: unknown) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetcher, calls };
};

describe("createProject", () => {
  test("posts the name to the app host with the personal key, and returns the project key", async () => {
    const { fetcher, calls } = answering(201, { id: 1, api_token: "phc_made" });
    const key = await createProject(
      fetcher,
      "https://eu.i.posthog.com",
      "phx_secret",
      "acme-staging",
    );
    expect(key).toBe("phc_made");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://eu.posthog.com/api/organizations/@current/projects/");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer phx_secret" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ name: "acme-staging" });
  });

  test("fails with PostHog's reason when it refuses", async () => {
    const { fetcher } = answering(403, {
      detail: "API key missing required scope 'project:write'",
    });
    const made = createProject(fetcher, "https://us.i.posthog.com", "phx_secret", "acme");
    await expect(made).rejects.toThrow(PosthogError);
    await expect(made).rejects.toThrow(
      "PostHog did not create acme (403: API key missing required scope",
    );
  });

  test("fails when a success carries no project key", async () => {
    const { fetcher } = answering(200, { id: 1 });
    await expect(
      createProject(fetcher, "https://us.i.posthog.com", "phx_secret", "acme"),
    ).rejects.toThrow("PostHog did not create acme (200)");
  });
});
