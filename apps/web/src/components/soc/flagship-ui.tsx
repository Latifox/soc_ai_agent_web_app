import type { ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Filter,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

const severityStyles: Record<Severity, string> = {
  critical: "text-critical border-critical/25 bg-critical/10",
  high: "text-high border-high/25 bg-high/10",
  medium: "text-medium border-medium/25 bg-medium/10",
  low: "text-low border-low/25 bg-low/10",
  info: "text-info border-info/25 bg-info/10",
};

const severityDot: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
  info: "bg-info",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
        severityStyles[severity],
      )}
    >
      <span className={cn("size-1.5 rounded-full", severityDot[severity])} aria-hidden="true" />
      {severity}
    </span>
  );
}

export function StatusLabel({
  children,
  tone = "violet",
}: {
  children: ReactNode;
  tone?: "violet" | "green" | "amber" | "red" | "neutral";
}) {
  const tones = {
    violet: "border-primary/25 bg-primary/10 text-primary",
    green: "border-low/25 bg-low/10 text-low",
    amber: "border-medium/25 bg-medium/10 text-medium",
    red: "border-high/25 bg-high/10 text-high",
    neutral: "border-border bg-surface text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-control border px-2 py-1 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function WorkspaceTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="soc-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; detail: string; tone?: "red" | "green" | "violet" | "amber" }>;
}) {
  const tone = {
    red: "text-high",
    green: "text-low",
    violet: "text-primary",
    amber: "text-medium",
  };
  return (
    <div className="grid border-b border-border bg-surface-subtle/55 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="border-b border-border px-5 py-4 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
          <p className="soc-label">{metric.label}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className={cn("text-2xl font-semibold tracking-tight", metric.tone ? tone[metric.tone] : "text-foreground")}>{metric.value}</p>
            <p className="pb-0.5 text-[11px] text-muted-foreground">{metric.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("soc-panel min-w-0 overflow-hidden", className)}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? <p className="soc-eyebrow mb-1">{eyebrow}</p> : null}
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Toolbar({
  placeholder,
  children,
}: {
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface-subtle/35 p-3 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          placeholder={placeholder}
          className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <div className="flex items-center gap-2">
        {children}
        <Button size="sm" variant="secondary"><Filter aria-hidden="true" /> Filter</Button>
        <Button size="icon" variant="secondary" aria-label="More options"><MoreHorizontal aria-hidden="true" /></Button>
      </div>
    </div>
  );
}

export interface QueueItem {
  id: string;
  title: string;
  entity: string;
  time: string;
  severity: Severity;
  status: string;
}

export function PriorityQueue({
  items,
  selectedId,
  onSelect,
}: {
  items: QueueItem[];
  selectedId: string;
  onSelect(id: string): void;
}) {
  return (
    <div className="soc-scrollbar flex max-h-[38rem] flex-col gap-2 overflow-y-auto p-2">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "rounded-control border p-3 text-left transition",
              selected
                ? "border-primary/70 bg-primary/[0.07] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                : "border-border bg-surface-subtle/50 hover:border-primary/25 hover:bg-primary/[0.035]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]", severityStyles[item.severity].split(" ")[0])}>
                <span className={cn("size-1.5 rounded-full", severityDot[item.severity])} />
                {item.severity}
              </span>
              <span className="text-[10px] text-muted-foreground">{item.time}</span>
            </div>
            <p className="mt-2 text-sm font-medium leading-snug text-foreground">{item.title}</p>
            <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{item.entity}</p>
            <div className="mt-2"><StatusLabel tone={selected ? "violet" : "neutral"}>{item.status}</StatusLabel></div>
          </button>
        );
      })}
    </div>
  );
}

export interface TimelineItem {
  time: string;
  category: "Identity" | "Endpoint" | "Process" | "Network";
  title: string;
  detail: string;
  entity: string;
  severity: Severity;
}

export function EventTimeline({ events }: { events: TimelineItem[] }) {
  const icon = { Identity: CircleDot, Endpoint: Activity, Process: Bot, Network: ArrowUpRight };
  return (
    <div className="soc-scrollbar overflow-x-auto">
      <table className="soc-table min-w-[720px]">
        <thead><tr><th>Time (UTC)</th><th>Event</th><th>Details</th><th>Entity</th><th>Risk</th></tr></thead>
        <tbody>
          {events.map((event) => {
            const Icon = icon[event.category];
            return (
              <tr key={`${event.time}-${event.title}`}>
                <td className="w-24 font-mono text-xs text-muted-foreground">{event.time}</td>
                <td>
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", severityStyles[event.severity])}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div><p className="text-[11px] font-medium text-primary">{event.category}</p><p className="text-sm font-medium">{event.title}</p></div>
                  </div>
                </td>
                <td className="max-w-64 text-xs text-muted-foreground">{event.detail}</td>
                <td className="font-mono text-xs text-muted-foreground">{event.entity}</td>
                <td><SeverityBadge severity={event.severity} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ConfidenceMeter({ value, caption }: { value: number; caption?: string }) {
  const label = value >= 80 ? "High confidence" : value >= 60 ? "Medium confidence" : "Low confidence";
  return (
    <div>
      <div className="mb-2 flex items-end justify-between"><span className="text-sm font-semibold">{label}</span><span className="font-mono text-xs text-muted-foreground">{value}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Evidence confidence">
        <div className="h-full rounded-full bg-low" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption ?? "Confidence derived from incident severity and correlated evidence."}</p>
    </div>
  );
}

export function ApprovalCard({
  status = "pending",
  title = "Continue investigation",
  summary = "No destructive action is pending for this incident.",
  steps = [],
  onApprove,
  onReject,
}: {
  status?: "pending" | "approved" | "rejected";
  title?: string;
  summary?: string;
  steps?: string[];
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const approved = status === "approved";
  const rejected = status === "rejected";
  return (
    <div className="border-t border-border bg-primary/[0.035] p-4">
      <div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" aria-hidden="true" /><span className="soc-eyebrow text-primary">Argus recommendation</span></div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{summary}</p>
      {steps.length > 0 && (
        <div className="mt-3 space-y-2 rounded-control border border-border bg-background/60 p-3 text-xs">
          {steps.map((step) => <p key={step} className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary" /> <span className="font-mono">{step}</span></p>)}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" disabled={approved || rejected} onClick={onReject}>Reject</Button>
        <Button variant="primary" size="sm" disabled={approved || rejected} onClick={onApprove}><ShieldAlert aria-hidden="true" /> Approve</Button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock3 className="size-3" />
        {approved ? "Approved and queued for execution." : rejected ? "Recommendation rejected and logged." : "Approval is audited and executed by Aegis."}
      </p>
    </div>
  );
}

export function DetailLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-accent">
      {children}
      <ChevronRight className="size-3" />
    </button>
  );
}
