import { allNavItems } from "@/lib/nav";
import { Card, CardContent } from "@/components/ui/card";

interface PageStubProps {
  /** Route href — title/description/icon are resolved from the nav config. */
  href: string;
}

/**
 * FE-01 placeholder: a page heading + one-line teardown description.
 * Real content arrives in later FE-* tasks; no data fetching here.
 */
export function PageStub({ href }: PageStubProps) {
  const item = allNavItems.find((navItem) => navItem.href === href);
  const title = item?.title ?? "Aegis";
  const description = item?.description ?? "";
  const Icon = item?.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-1 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {title} workspace
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            App shell scaffolded (FE-01). This surface is wired for navigation;
            live data and controls land in a later frontend task.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
