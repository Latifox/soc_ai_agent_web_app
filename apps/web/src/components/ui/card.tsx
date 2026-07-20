import * as React from "react";

import { cn } from "@/lib/utils";

export type SeverityRail = "critical" | "high" | "medium" | "low" | "info";

const railClass: Record<SeverityRail, string> = {
  critical: "[--rail:var(--color-critical)]",
  high: "[--rail:var(--color-high)]",
  medium: "[--rail:var(--color-medium)]",
  low: "[--rail:var(--color-low)]",
  info: "[--rail:var(--color-info)]",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional 3px left severity rail (incident/case cards). */
  rail?: SeverityRail;
}

export function Card({ className, rail, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "aegis-card",
        rail ? `has-rail ${railClass[rail]}` : undefined,
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-base font-semibold leading-tight tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 pt-0", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  );
}
