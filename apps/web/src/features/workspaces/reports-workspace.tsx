import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function ReportsWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.reports} />;
}
