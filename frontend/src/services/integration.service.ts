import { apiRequest } from "./api";
import type {
  ChannelConnection,
  MarketplaceConnectorDescriptor,
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceSyncRun,
  SalesChannel,
} from "../types/integration";
export const integrationService = {
  catalog: () => apiRequest<SalesChannel[]>("/sales-channels"),
  list: () => apiRequest<ChannelConnection[]>("/sales-channel-connections"),
  get: (id: string) =>
    apiRequest<ChannelConnection>(`/sales-channel-connections/${id}`),
  capabilities: (id: string) =>
    apiRequest<MarketplaceConnectorDescriptor>(
      `/sales-channel-connections/${id}/capabilities`,
    ),
  create: (salesChannelId: string, displayName: string) =>
    apiRequest<ChannelConnection>("/sales-channel-connections", {
      method: "POST",
      body: JSON.stringify({ salesChannelId, displayName }),
    }),
  authorizeMercadoLivre: (connectionId: string) =>
    apiRequest<{ authorizationUrl: string; expiresAt: string }>(
      "/integrations/mercado-livre/authorize",
      { method: "POST", body: JSON.stringify({ connectionId }) },
    ),
  syncListings: (id: string) =>
    apiRequest<{ syncRunId: string; status: string }>(
      `/integrations/mercado-livre/connections/${id}/sync/listings`,
      { method: "POST" },
    ),
  syncOrders: (id: string) =>
    apiRequest<{ syncRunId: string; status: string }>(
      `/integrations/mercado-livre/connections/${id}/sync/orders`,
      { method: "POST" },
    ),
  listings: (id: string) =>
    apiRequest<MarketplaceListing[]>(
      `/integrations/mercado-livre/connections/${id}/listings`,
    ),
  orders: (id: string) =>
    apiRequest<MarketplaceOrder[]>(
      `/integrations/mercado-livre/connections/${id}/orders`,
    ),
  runs: (id: string) =>
    apiRequest<MarketplaceSyncRun[]>(
      `/integrations/mercado-livre/connections/${id}/sync-runs`,
    ),
  validate: (id: string) =>
    apiRequest(`/sales-channel-connections/${id}/validate`, { method: "POST" }),
  disable: (id: string) =>
    apiRequest<ChannelConnection>(`/sales-channel-connections/${id}/disable`, {
      method: "POST",
    }),
  enable: (id: string) =>
    apiRequest<ChannelConnection>(`/sales-channel-connections/${id}/enable`, {
      method: "POST",
    }),
  disconnect: (id: string) =>
    apiRequest<ChannelConnection>(`/sales-channel-connections/${id}`, {
      method: "DELETE",
    }),
};
