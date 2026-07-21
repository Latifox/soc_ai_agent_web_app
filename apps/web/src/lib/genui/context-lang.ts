/**
 * Deterministic OpenUI Lang generators for the "Investigate with Argus" context card.
 *
 * The Argus agents emit OpenUI Lang for their own generative replies; here we emit it too,
 * so an incident/case the analyst launched from renders as real generative UI (AlertCard +
 * entities + MITRE) at the top of the thread — the same renderer, same component library.
 */

import type { CaseRecord, IncidentRecord } from "@/lib/api";

const q = (s: unknown) => JSON.stringify(String(s ?? ""));

const SEV = new Set(["low", "medium", "high", "critical"]);
function severity(s?: string): string {
  return SEV.has(s ?? "") ? (s as string) : "medium";
}
function incidentStatus(s?: string): string {
  return s === "resolved" ? "resolved" : s === "in_progress" ? "in_progress" : "open";
}
function caseStatus(s?: string): string {
  return s === "closed" ? "resolved" : s === "in_progress" ? "in_progress" : "open";
}

/** OpenUI Lang for an incident: AlertCard + entities + MITRE mapping. */
export function incidentLang(i: IncidentRecord): string {
  const entities = i.entities ?? [];
  const mitre = (i.tags ?? []).filter((t) => /^T1\d{3}/i.test(t));
  const host = entities.find((e) => /win|host|srv|gw|dc/i.test(e)) ?? "";
  const user = entities.find((e) => e.includes(".") && !/\d/.test(e)) ?? "";
  const detected = i.detected_at ?? i.created_at ?? "";
  const lines: string[] = [];
  const rootChildren = ["alert"];
  lines.push(
    `alert = AlertCard(${q(i.title)}, ${q(severity(i.severity))}, ${q(host)}, ${q(user)}, ${q(detected)}, ${q(incidentStatus(i.status))}, ${q(i.description ?? "")})`,
  );
  if (entities.length) {
    rootChildren.push("entities");
    lines.push(`entities = EntityList("Entities", [${entities.map(q).join(", ")}])`);
  }
  if (mitre.length) {
    rootChildren.push("mitre");
    const rows = mitre.map((m) => `{tactic: "ATT&CK", technique: ${q(m)}, id: ${q(m)}, evidence: ${q("observed in this incident")}}`).join(", ");
    lines.push(`mitre = MitreMappingTable([${rows}])`);
  }
  return [`root = Stack([${rootChildren.join(", ")}])`, ...lines].join("\n");
}

/** OpenUI Lang for a case: AlertCard summary + tag entities. */
export function caseLang(c: CaseRecord): string {
  const tags = c.tags ?? [];
  const lines: string[] = [];
  const rootChildren = ["alert"];
  lines.push(
    `alert = AlertCard(${q(c.title)}, "medium", "", ${q(c.assignee ?? "")}, ${q(c.created_at ?? "")}, ${q(caseStatus(c.status))}, ${q(c.description ?? "")})`,
  );
  if (tags.length) {
    rootChildren.push("tags");
    lines.push(`tags = EntityList("Tags", [${tags.map(q).join(", ")}])`);
  }
  return [`root = Stack([${rootChildren.join(", ")}])`, ...lines].join("\n");
}
