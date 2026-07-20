import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function SettingsWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.settings} />;
}
