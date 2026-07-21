import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveRulesConfig } from "@/lib/live-data";

export async function RulesWorkspace() {
  return <OperationalWorkspace config={await liveRulesConfig()} />;
}
