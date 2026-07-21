import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveAutomationConfig } from "@/lib/live-data";

export async function AutomationWorkspace() {
  return <OperationalWorkspace config={await liveAutomationConfig()} />;
}
