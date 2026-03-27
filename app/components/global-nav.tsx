import { useLocation } from "@tanstack/react-router";
import { Link } from "./link";
import { DuckDBGlobalSearch } from "@/components/DuckDBGlobalSearch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function GlobalNav() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-40 bg-background/95 border-b border-border shadow-sm backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
            <Link
              to="/"
              className={`text-lg sm:text-xl font-bold text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname === "/" ? "underline" : ""}`}
            >
              fintellectus (Tanstack DB)
            </Link>
          </div>

          <div className="flex-1 flex justify-center items-center gap-2">
            <DuckDBGlobalSearch />
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <Link
              to="/assets"
              search={{ page: undefined, search: undefined }}
              className={`text-sm sm:text-base text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname.startsWith("/assets") ? "underline" : ""}`}
            >
              Assets
            </Link>
            <Link
              to="/superinvestors"
              search={{ page: undefined, search: undefined }}
              className={`text-sm sm:text-base text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname.startsWith("/superinvestors") ? "underline" : ""}`}
            >
              Superinvestors
            </Link>
            <Avatar className="h-8 w-8 hover:ring-2 hover:ring-muted-foreground transition-all cursor-pointer">
              <AvatarFallback className="text-xs">U</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </nav>
  );
}
