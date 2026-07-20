import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function AssetsWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.assets} />;
}
