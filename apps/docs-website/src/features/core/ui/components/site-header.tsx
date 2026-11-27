import { Link } from "@tanstack/react-router";
import { navItems, visibleNav } from "#/app/nav.ts";

export function SiteHeader({ signedIn, appName }: { signedIn: boolean; appName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4" aria-label="Main">
        <Link to="/" className="font-semibold">
          {appName}
        </Link>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {visibleNav(navItems, signedIn)
            .filter((item) => item.to !== "/")
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
