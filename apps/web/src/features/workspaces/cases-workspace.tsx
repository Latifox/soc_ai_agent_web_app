import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { workspaceConfigs } from "@/lib/workspace-data";

export function CasesWorkspace() {
  return <OperationalWorkspace config={workspaceConfigs.cases} />;
}
