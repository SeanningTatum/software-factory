import { describe, expect, it } from "vitest";
import { errorInfo, errorStatus, INTERNAL, NotFound, RateLimited } from "./errors.ts";

describe("errors", () => {
  it("maps each tagged error to a status and a safe message", () => {
    expect(errorInfo(new NotFound({ what: "user" })._tag)).toEqual({
      status: 404,
      message: "Not found.",
    });
    expect(errorInfo(new RateLimited({ retryAfterSeconds: 5 })._tag).status).toBe(429);
  });

  it("treats an unknown tag as an internal error", () => {
    expect(errorInfo("Boom")).toBe(INTERNAL);
  });

  it("never gives a 2xx or 3xx status", () => {
    for (const info of Object.values(errorStatus)) expect(info.status).toBeGreaterThanOrEqual(400);
  });
});
