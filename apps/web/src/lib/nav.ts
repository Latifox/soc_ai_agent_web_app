import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  Plug,
  ScrollText,
  Search,
  Server,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** One-line teardown description, surfaced on the stub page. */
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description:
          "Operational overview — open incidents, severities, and SOC health above the fold.",
      },
      {
        title: "Rules",
        href: "/rules",
        icon: ScrollText,
        description:
          "Detection-as-code: versioned YAML rules across six rule types with tags and folders.",
      },
      {
        title: "Incidents",
        href: "/incidents",
        icon: ShieldAlert,
        description: "Monitor and manage security incidents.",
      },
      {
        title: "Cases",
        href: "/cases",
        icon: Briefcase,
        description: "Track and manage security cases.",
      },
      {
        title: "Assets",
        href: "/assets",
        icon: Server,
        description:
          "Asset & entity inventory (endpoints, users, hosts) tied to detections.",
      },
      {
        title: "Automation",
        href: "/automation",
        icon: Workflow,
        description:
          "SOAR playbooks and response workflows — notify, block, isolate, disable account.",
      },
      {
        title: "Investigations",
        href: "/investigations",
        icon: Search,
        description:
          "Threat-hunting workspace — query, results, entity pivot, and timeline.",
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        description:
          "Metrics and executive reporting — MTTD/MTTR, FP rate, and MITRE coverage.",
      },
      {
        title: "AI Assistant",
        href: "/assistant",
        icon: Sparkles,
        description:
          "Generative-UI chat to explain alerts with MITRE mapping and suggested actions.",
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        title: "Integrations",
        href: "/integrations",
        icon: Plug,
        description:
          "Connect log sources and tools — AWS, Azure, GCP, Kubernetes, Okta, and more.",
      },
      {
        title: "Configurations",
        href: "/configurations",
        icon: SlidersHorizontal,
        description:
          "Tenant and data-source configuration — indices, retention, and ingestion.",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Users, roles, API keys, SSO/SCIM, and tenant preferences.",
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((group) => group.items);
