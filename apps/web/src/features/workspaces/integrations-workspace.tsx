import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function IntegrationsWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.integrations} />;
}
