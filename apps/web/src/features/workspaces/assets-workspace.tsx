import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveAssetsConfig } from "@/lib/live-data";

export async function AssetsWorkspace() {
  return <OperationalWorkspace config={await liveAssetsConfig()} />;
}
