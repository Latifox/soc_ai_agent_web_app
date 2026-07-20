import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function RulesWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.rules} />;
}
