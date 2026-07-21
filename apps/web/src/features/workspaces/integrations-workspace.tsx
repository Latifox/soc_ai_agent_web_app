import { WorkspaceTitle } from "@/components/soc/flagship-ui";
import { DataConnectors } from "@/features/workspaces/data-connectors";
import { IntegrationsList } from "@/features/workspaces/integrations-list";
import { LiveDataPreview } from "@/features/workspaces/live-data-preview";
import { getIntegrations } from "@/lib/api";

export async function IntegrationsWorkspace() {
  const integrations = await getIntegrations();
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Connectors"
        title="Integrations"
        description="Connect your ClickHouse datalake and OpenSearch cluster, test connectivity, and grant the Argus crew access to query them."
      />
      <DataConnectors integrations={integrations} />
      <div className="grid gap-4 p-4 lg:p-5">
        <LiveDataPreview />
        <IntegrationsList initial={integrations} />
      </div>
    </div>
  );
}
