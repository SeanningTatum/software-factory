import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

const pages = [
  { to: "/docs", label: "Getting started" },
  { to: "/docs/blocks", label: "Blocks" },
  { to: "/docs/setup", label: "Deploying" },
  { to: "/docs/rules", label: "Rules and checks" },
  { to: "/docs/claude", label: "Claude workflows" },
] as const;

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 md:flex-row">
      <nav
        aria-label="Docs"
        className="flex shrink-0 flex-row flex-wrap gap-3 text-sm md:w-48 md:flex-col"
      >
        {pages.map((page) => (
          <Link
            key={page.to}
            to={page.to}
            activeOptions={{ exact: true }}
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "font-medium text-foreground" }}
          >
            {page.label}
          </Link>
        ))}
      </nav>
      <article className="prose-docs min-w-0 flex-1">
        <Outlet />
      </article>
    </div>
  );
}
