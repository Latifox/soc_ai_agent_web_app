import type { QueueItem, TimelineItem } from "@/components/soc/flagship-ui";

export const incidentQueue: QueueItem[] = [
  { id: "INC-2026-0720-0001", title: "Credential Access via LSASS after Suspicious Login", entity: "WIN-7F3G2K9H8", time: "2m ago", severity: "critical", status: "Investigating" },
  { id: "INC-2026-0720-0002", title: "PowerShell Remoting to Multiple Hosts", entity: "WIN-4XJ2L7D3", time: "18m ago", severity: "high", status: "New" },
  { id: "INC-2026-0720-0003", title: "Unusual DNS Tunneling Detected", entity: "workstation-23", time: "1h ago", severity: "medium", status: "Triage" },
  { id: "INC-2026-0720-0004", title: "Multiple Failed Logins from New ASN", entity: "user: jsmith", time: "2h ago", severity: "low", status: "Monitoring" },
  { id: "INC-2026-0720-0005", title: "New Service Account Created", entity: "CORP\\svc_backup", time: "3h ago", severity: "info", status: "Resolved" },
];

export const investigationEvents: TimelineItem[] = [
  { time: "13:58:41", category: "Identity", title: "Unusual interactive login", detail: "User authenticated from ASN 20473; MFA not satisfied.", entity: "jsmith · 10.12.4.45", severity: "medium" },
  { time: "14:00:12", category: "Endpoint", title: "Encoded PowerShell execution", detail: "Command line decoded to a 1.2 KB script.", entity: "WIN-7F3G2K9H8", severity: "high" },
  { time: "14:01:07", category: "Process", title: "Suspicious payload spawned", detail: "rundll32.exe created from powershell.exe (PID 4120).", entity: "rundll32.exe", severity: "medium" },
  { time: "14:02:33", category: "Process", title: "LSASS memory access", detail: "MiniDumpWriteDump access pattern indicates credential dumping.", entity: "lsass.exe · PID 612", severity: "critical" },
  { time: "14:04:18", category: "Network", title: "Admin share accessed", detail: "SMB session established with delegated credentials.", entity: "WIN-4XJ2L7D3", severity: "medium" },
  { time: "14:06:02", category: "Process", title: "PowerShell remoting", detail: "New PSSession established and whoami executed.", entity: "10.12.4.33", severity: "high" },
  { time: "14:12:20", category: "Process", title: "Remote service execution", detail: "PsExec service created on a third host.", entity: "SRV-2M9P8Q1", severity: "medium" },
];

export const dashboardMetrics = [
  { label: "Open incidents", value: "247", detail: "+18 today", tone: "red" as const },
  { label: "Critical", value: "12", detail: "3 unassigned", tone: "red" as const },
  { label: "Mean time to triage", value: "14m 32s", detail: "↓ 4m 18s", tone: "green" as const },
  { label: "Argus auto-resolved", value: "93", detail: "+11 today", tone: "violet" as const },
];

export const mitreMappings = [
  ["T1003.001", "OS Credential Dumping: LSASS Memory", "critical"],
  ["T1059.001", "Command and Scripting: PowerShell", "high"],
  ["T1021.002", "Remote Services: SMB/Admin Shares", "medium"],
  ["T1078.001", "Valid Accounts: Domain Accounts", "medium"],
] as const;

