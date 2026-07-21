import { Activity, Code2, Database, Radio, Search, ShieldCheck, type LucideIcon } from "lucide-react";

/** Backend RuleType keys mapped to the analyst-facing catalog (mirrors the reference UI). */
export type RuleType = "query" | "advanced_threshold" | "source_monitor" | "threat_match" | "code" | "spark";

export interface RuleTypeSpec {
  type: RuleType;
  name: string;
  blurb: string;
  icon: LucideIcon;
  template: (title: string) => string;
}

const baseHeader = (title: string, type: RuleType, extra = "") =>
  `title: ${title}\nseverity: medium\ntype: ${type}\nenabled: true\ndepth: 15m\ntags: []\n${extra}`;

export const RULE_TYPES: RuleTypeSpec[] = [
  {
    type: "query",
    name: "Query Rule",
    blurb: "Create rules based on search queries and pattern matching.",
    icon: Search,
    template: (t) => baseHeader(t, "query", "query: event.category:process AND process.name:lsass.exe\n"),
  },
  {
    type: "advanced_threshold",
    name: "Threshold Rule",
    blurb: "Monitor for values exceeding specified thresholds.",
    icon: Activity,
    template: (t) =>
      baseHeader(t, "advanced_threshold", "query: event.category:network AND event.action:accept\n") +
      "threshold:\n  group_by: [source.ip]\n  aggregate: cardinality(destination.port)\n  operator: \">\"\n  value: 50\n",
  },
  {
    type: "source_monitor",
    name: "Source Monitor",
    blurb: "Monitor specific log sources for events or patterns.",
    icon: Radio,
    template: (t) => baseHeader(t, "source_monitor", "indices:\n  - syslog-fortinet-fw*\nquery: event.action:*\n"),
  },
  {
    type: "threat_match",
    name: "Threat Match",
    blurb: "Match events against known threat indicators.",
    icon: ShieldCheck,
    template: (t) => baseHeader(t, "threat_match", "query: event.category:network AND event.type:dns\nthreat_field: destination.domain\n"),
  },
  {
    type: "code",
    name: "Code Based",
    blurb: "Write custom detection logic using Python.",
    icon: Code2,
    template: (t) => baseHeader(t, "code", "query: event.category:authentication\ncode: |\n  def detect(events):\n      return [e for e in events if e]\n"),
  },
  {
    type: "spark",
    name: "Spark rules",
    blurb: "Create rules using Lucene and Apache Spark.",
    icon: Database,
    template: (t) => baseHeader(t, "spark", "query: event.category:authentication AND event.action:failure\nspark_sql: SELECT user_name, count(*) c FROM events GROUP BY user_name HAVING c > 20\n"),
  },
];

export const ruleTypeName = (type: string): string =>
  RULE_TYPES.find((r) => r.type === type)?.name ?? type;
