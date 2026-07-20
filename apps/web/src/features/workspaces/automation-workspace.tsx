import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function AutomationWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.automation} />;
}
