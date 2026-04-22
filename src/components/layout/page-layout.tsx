import { cn } from "@/lib/utils";

const widthClassNames = {
  content: "max-w-[var(--page-max-width-content)]",
  wide: "max-w-[var(--page-max-width-wide)]",
  full: "max-w-[var(--page-max-width)]",
} as const;

type PageLayoutWidth = keyof typeof widthClassNames;

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  width?: PageLayoutWidth;
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({
  children,
  className,
  width = "wide",
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 px-[var(--page-gutter)] py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
        "pb-[calc(var(--page-section-gap)+var(--safe-area-bottom))] sm:pb-[calc(2rem+var(--safe-area-bottom))]",
        widthClassNames[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  leading,
  trailing,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/80 pb-6 sm:gap-5 sm:pb-8",
        className,
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-3">
          {leading ? (
            <div className="text-sm font-medium text-muted-foreground">{leading}</div>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {trailing ? <div className="sm:pb-1">{trailing}</div> : null}
      </div>
    </header>
  );
}

export function PageSection({ children, className }: PageSectionProps) {
  return <section className={cn("space-y-4", className)}>{children}</section>;
}
