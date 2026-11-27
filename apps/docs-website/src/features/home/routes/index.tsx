import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { navItems } from "#/app/nav.ts";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout
      className="[--fd-layout-width:64rem]"
      nav={{ title: "create-tanstack-cf-saas" }}
      links={navItems
        .filter((item) => item.to !== "/")
        .map((item) => ({ text: item.label, url: item.to }))}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          create-tanstack-cf-saas
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          A CLI that builds a TanStack Start SaaS on Cloudflare Workers. You pick the features (db,
          auth, billing, kv, workflows, uploads) and it writes a project with only those.
        </p>
        <Link
          className="mt-8 inline-block font-medium underline underline-offset-4"
          params={{ _splat: "" }}
          to="/docs/$"
        >
          Read the docs
        </Link>
      </div>
    </HomeLayout>
  );
}
