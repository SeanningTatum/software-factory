// software-factory-lint allow comments
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { source } from "#/features/docs/lib/source.ts";

const MAX_DEPTH = 16;

const Slugs = Schema.toStandardSchemaV1(
  Schema.Array(Schema.String).check(Schema.isMaxLength(MAX_DEPTH)),
);

/** Null when no page has these slugs: the route turns that into a 404. */
export const loadDocsPage = createServerFn({ method: "GET" })
  .validator(Slugs)
  .handler(({ context, data }) =>
    runEffect(
      context,
      Effect.promise(async () => {
        const page = source.getPage([...data]);
        if (!page) return null;
        return {
          path: page.path,
          pageTree: await source.serializePageTree(source.getPageTree()),
        };
      }),
      "docs.page",
    ),
  );
