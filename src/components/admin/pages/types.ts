import type { IntegrationsStatus } from "@/lib/integrations-api";

export interface OptionalServiceAdminPageProps {
  status: IntegrationsStatus | undefined;
  loading: React.ReactNode;
}
