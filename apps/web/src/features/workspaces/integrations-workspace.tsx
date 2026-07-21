import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveIntegrationsConfig } from "@/lib/live-data";

export async function IntegrationsWorkspace() {
  return <OperationalWorkspace config={await liveIntegrationsConfig()} />;
}
