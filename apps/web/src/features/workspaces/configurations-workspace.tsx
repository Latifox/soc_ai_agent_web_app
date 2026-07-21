import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveConfigurationsConfig } from "@/lib/live-data";

export async function ConfigurationsWorkspace() {
  return <OperationalWorkspace config={await liveConfigurationsConfig()} />;
}
