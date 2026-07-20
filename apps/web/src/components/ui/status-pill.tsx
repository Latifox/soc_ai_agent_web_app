import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusPill — tinted severity/status token per DESIGN.md:
 * ~12% color fill with the solid semantic color as the label.
 * The active color is exposed through the `--pill` custom property,
 * consumed by the `.status-pill` base class in globals.css.
 */
const statusPillVariants = cva("status-pill", {
  variants: {
    variant: {
      critical: "[--pill:var(--color-critical)]",
      high: "[--pill:var(--color-high)]",
      medium: "[--pill:var(--color-medium)]",
      low: "[--pill:var(--color-low)]",
      info: "[--pill:var(--color-info)]",
      open: "[--pill:var(--color-status-open)]",
      progress: "[--pill:var(--color-status-progress)]",
      resolved: "[--pill:var(--color-status-resolved)]",
      enabled: "[--pill:var(--color-low)]",
      disabled: "[--pill:var(--color-muted-foreground)]",
      neutral: "[--pill:var(--color-muted-foreground)]",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export type StatusPillVariant = NonNullable<
  VariantProps<typeof statusPillVariants>["variant"]
>;

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  /** Render a leading status dot. */
  dot?: boolean;
}

export function StatusPill({
  className,
  variant,
  dot = false,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ variant }), className)} {...props}>
      {dot ? <span className="status-pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export { statusPillVariants };
