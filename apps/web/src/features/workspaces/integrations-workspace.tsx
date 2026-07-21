import { WorkspaceTitle } from "@/components/soc/flagship-ui";
import { DataConnectors } from "@/features/workspaces/data-connectors";
import { IntegrationsList } from "@/features/workspaces/integrations-list";
import { LiveDataPreview } from "@/features/workspaces/live-data-preview";
import { TenantsBar } from "@/features/workspaces/tenants-bar";
import { getIntegrations, getTenants, getWhoami } from "@/lib/api";

export async function IntegrationsWorkspace() {
  const [integrations, tenants, who] = await Promise.all([getIntegrations(), getTenants(), getWhoami()]);
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Connectors"
        title="Integrations"
        description="Onboard workspaces, connect each to its OpenSearch cluster, test connectivity, and grant the Argus crew access to query it."
      />
      <TenantsBar tenants={tenants} currentTenantId={who.tenant_id} />
      <DataConnectors integrations={integrations} />
      <div className="grid gap-4 p-4 lg:p-5">
        <LiveDataPreview />
        <IntegrationsList initial={integrations} />
      </div>
    </div>
  );
}
