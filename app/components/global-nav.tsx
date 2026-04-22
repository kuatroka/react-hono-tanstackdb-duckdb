import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { Link } from "./link";
import { UFuzzyGlobalSearch } from "@/components/UFuzzyGlobalSearch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  {
    to: "/assets" as const,
    label: "Assets",
    isActive: (pathname: string) => pathname.startsWith("/assets"),
  },
  {
    to: "/superinvestors" as const,
    label: "Superinvestors",
    isActive: (pathname: string) => pathname.startsWith("/superinvestors"),
  },
];

function MobileNavButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-md border border-border/70 bg-background/60 text-foreground hover:bg-muted"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function GlobalNav() {
  const location = useLocation();
  const [mobileOpenPanel, setMobileOpenPanel] = useState<"nav" | "search" | null>(null);
  const isHome = location.pathname === "/";
  const isMobileMenuOpen = mobileOpenPanel !== null;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/88">
        <div className="mx-auto w-full max-w-[90rem] px-4 pt-[max(0.75rem,var(--safe-area-top))] pb-3 sm:px-6 lg:px-8">
          <div className="hidden h-13 items-center gap-6 md:flex">
            <Link
              to="/"
              className={cn(
                "shrink-0 text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80",
                isHome ? "text-foreground" : "text-foreground/90",
              )}
            >
              fintellectus (Tanstack DB)
            </Link>
            <div className="min-w-0 flex-1">
              <UFuzzyGlobalSearch mode="desktop" />
            </div>
            <div className="flex items-center gap-4">
              {navLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  search={{ page: undefined, search: undefined }}
                  className={`text-sm sm:text-base text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${item.isActive(location.pathname) ? "underline" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex h-13 items-center justify-between gap-3 md:hidden">
            <div className="w-10">
              {mobileOpenPanel === "nav" ? (
                <MobileNavButton ariaLabel="Close navigation menu" onClick={() => setMobileOpenPanel(null)}>
                  <X className="size-5" />
                </MobileNavButton>
              ) : (
                <MobileNavButton ariaLabel="Open navigation menu" onClick={() => setMobileOpenPanel("nav")}>
                  <Menu className="size-5" />
                </MobileNavButton>
              )}
            </div>

            <Link
              to="/"
              className="flex-1 text-center text-base font-semibold tracking-tight text-foreground"
            >
              fintellectus
            </Link>

            <div className="flex w-10 justify-end">
              {mobileOpenPanel === "search" ? (
                <MobileNavButton ariaLabel="Close global search" onClick={() => setMobileOpenPanel(null)}>
                  <X className="size-5" />
                </MobileNavButton>
              ) : (
                <MobileNavButton ariaLabel="Open global search" onClick={() => setMobileOpenPanel("search")}>
                  <Search className="size-4.5" />
                </MobileNavButton>
              )}
            </div>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <div className="border-b border-border/70 bg-background/95 md:hidden">
          <div className="mx-auto w-full max-w-[90rem] px-4 pb-[calc(1.5rem+var(--safe-area-bottom))] sm:px-6">
            <div className="mt-3 rounded-[1.5rem] border border-border/70 bg-card px-4 py-4 shadow-sm">
              {mobileOpenPanel === "search" ? (
                <UFuzzyGlobalSearch
                  mode="mobile-drawer"
                  placeholder="Search or jump to…"
                  onNavigate={() => setMobileOpenPanel(null)}
                />
              ) : null}

              {mobileOpenPanel === "nav" ? (
                <div className="space-y-0.5">
                  {navLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      search={{ page: undefined, search: undefined }}
                      className="flex items-center justify-between rounded-md px-1 py-3 text-base font-semibold tracking-tight text-foreground"
                      onClick={() => setMobileOpenPanel(null)}
                    >
                      <span>{item.label}</span>
                      <span className="text-lg text-muted-foreground">›</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
