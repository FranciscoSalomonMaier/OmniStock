export interface SalesChannel {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  supportsOAuth: boolean;
  supportsProducts: boolean;
  supportsOrders: boolean;
  supportsStock: boolean;
  supportsPrices: boolean;
  supportsInvoices: boolean;
}
export interface ChannelConnection {
  id: string;
  channel: SalesChannel;
  displayName: string;
  status: string;
  externalAccountName: string | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: { at: string; code: string | null; message: string | null } | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiresSoon: boolean;
  requiresReauthorization: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CapabilityState {
  supportedByProvider: boolean;
  implemented: boolean;
}
export interface MarketplaceCapabilities {
  authorization: CapabilityState;
  tokenRefresh: CapabilityState;
  productImport: CapabilityState;
  orderImport: CapabilityState;
  stockUpdate: CapabilityState;
  priceUpdate: CapabilityState;
  invoiceSubmission: CapabilityState;
  webhooks: CapabilityState;
  incrementalSync: CapabilityState;
  multipleAccounts: CapabilityState;
  disconnectRevocation: CapabilityState;
}
export interface MarketplaceConnectorDescriptor {
  channelCode: string;
  enabled: boolean;
  capabilities: MarketplaceCapabilities;
}
export interface MarketplaceListing {
  id: string;
  externalItemId: string;
  externalVariationId: string | null;
  externalSku: string | null;
  title: string;
  status: string;
  price: string;
  currency: string;
  availableQuantity: number | null;
  soldQuantity: number | null;
  thumbnailUrl: string | null;
  lastSyncedAt: string;
}
export interface MarketplaceOrder {
  id: string;
  externalOrderId: string;
  status: string;
  paymentStatus: string | null;
  shippingStatus: string | null;
  buyerNickname: string | null;
  purchasedAt: string;
  currency: string;
  totalAmount: string;
  shipmentId: string | null;
  lastSyncedAt: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPrice: string;
  }>;
}
export interface MarketplaceSyncRun {
  id: string;
  operation: string;
  status: string;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}
