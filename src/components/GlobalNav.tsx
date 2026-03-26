import { Link, useLocation } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function GlobalNav() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
            <Link
              to="/"
              className={`text-lg sm:text-xl font-bold text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname === '/' ? 'underline' : ''}`}
            >
              fintellectus (Zero)
            </Link>
          </div>

          <div className="flex-1 flex justify-center max-w-md">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <Link
              to="/assets"
              className={`text-sm sm:text-base text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname.startsWith('/assets') ? 'underline' : ''}`}
            >
              Assets
            </Link>
            <Link
              to="/superinvestors"
              className={`text-sm sm:text-base text-foreground hover:text-muted-foreground hover:underline underline-offset-4 transition-colors cursor-pointer outline-none ${location.pathname.startsWith('/superinvestors') ? 'underline' : ''}`}
            >
              Superinvestors
            </Link>
            <Link to="/profile">
              <Avatar className="h-8 w-8 hover:ring-2 hover:ring-muted-foreground transition-all cursor-pointer">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
