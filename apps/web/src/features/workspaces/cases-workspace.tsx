import { OperationalWorkspace } from "@/features/workspaces/operational-workspace";
import { liveCasesConfig } from "@/lib/live-data";

export async function CasesWorkspace() {
  return <OperationalWorkspace config={await liveCasesConfig()} />;
}
