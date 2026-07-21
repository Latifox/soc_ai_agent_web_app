import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveSettingsConfig } from "@/lib/live-data";

export async function SettingsWorkspace() {
  return <OperationalWorkspace config={await liveSettingsConfig()} />;
}
