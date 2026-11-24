import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CredentialsForm } from "./credentials-form.tsx";

const render = (mode: "sign-in" | "sign-up") =>
  renderToString(
    <CredentialsForm mode={mode} submit={() => Promise.resolve()} onDone={() => undefined} />,
  );

describe("CredentialsForm before hydration", () => {
  it.each(["sign-in", "sign-up"] as const)("%s posts, so fields never land in the URL", (mode) => {
    expect(render(mode)).toMatch(/<form[^>]* method="post"/);
  });

  it.each(["sign-in", "sign-up"] as const)("%s keeps its submit button disabled", (mode) => {
    const submit = render(mode).match(/<button[^>]*type="submit"[^>]*>/)?.[0];
    expect(submit).toContain('disabled=""');
  });
});
