import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { Uploads } from "./uploads.ts";

export const CursorSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(512))) }),
);

export const listFiles = createServerFn({ method: "GET" })
  .validator(CursorSearch)
  .handler(({ context, data }) =>
    runEffect(
      context,
      Effect.gen(function* () {
        const auth = yield* Auth;
        const user = yield* auth.requireUser;
        const uploads = yield* Uploads;
        return yield* uploads.list(user.id, data.cursor);
      }),
      "uploads.page",
    ),
  );
