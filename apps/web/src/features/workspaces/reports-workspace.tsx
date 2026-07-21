import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveReportsConfig } from "@/lib/live-data";

export async function ReportsWorkspace() {
  return <OperationalWorkspace config={await liveReportsConfig()} />;
}
