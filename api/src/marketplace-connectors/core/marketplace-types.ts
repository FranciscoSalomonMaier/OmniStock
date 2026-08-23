import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';

export type CapabilityState = {
  supportedByProvider: boolean;
  implemented: boolean;
};
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
export interface ConnectorCredentials {
  accessToken?: string;
  refreshToken?: string;
}
export interface ConnectorContext {
  companyId: string;
  connectionId: string;
  channelCode: SalesChannelCode;
  externalAccountId: string | null;
  correlationId: string;
  operationId: string;
  locale: string;
  credentials?: ConnectorCredentials;
  metadata: Readonly<Record<string, unknown>>;
}
export interface ExternalProduct {
  externalId: string;
  externalSku: string | null;
  title: string;
  description: string | null;
  status: string;
  price: number;
  currency: string;
  availableQuantity: number;
  barcode: string | null;
  imageUrls: string[];
  categoryExternalId: string | null;
  variationId: string | null;
}
export interface ExternalOrderItem {
  externalItemId: string;
  externalProductId: string;
  externalSku: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variationId: string | null;
}
export interface ExternalParty {
  name: string;
  document: string | null;
  email: string | null;
}
export interface ExternalAddress {
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
export interface ExternalOrder {
  externalId: string;
  externalNumber: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  purchasedAt: Date;
  updatedAt: Date;
  buyer: ExternalParty;
  shippingAddress: ExternalAddress;
  items: ExternalOrderItem[];
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  metadata: Readonly<Record<string, unknown>>;
}
export interface AuthorizationUrlInput {
  companyId: string;
  connectionId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string | null;
}
export interface AuthorizationUrlResult {
  url: string;
  expiresAt: Date | null;
  stateIdentifier: string;
}
export interface ExchangeAuthorizationCodeInput {
  context: ConnectorContext;
  code: string;
  redirectUri: string;
}
export interface AuthorizationResult {
  externalAccountId: string;
  externalAccountName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  grantedScopes: string[];
  metadata: Readonly<Record<string, unknown>>;
}
export interface RefreshTokenInput {
  context: ConnectorContext;
  refreshToken: string;
}
export interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  grantedScopes: string[] | null;
}
export interface ConnectionValidationResult {
  valid: boolean;
  externalAccountId: string | null;
  externalAccountName: string | null;
  checkedAt: Date;
}
export interface ImportProductsInput {
  context: ConnectorContext;
  cursor: string | null;
  updatedSince: Date | null;
  pageSize: number;
  filters: Readonly<Record<string, string>>;
}
export interface ImportProductsResult {
  items: ExternalProduct[];
  nextCursor: string | null;
  hasMore: boolean;
  importedAt: Date;
  providerRequestId: string | null;
}
export interface ImportOrdersInput {
  context: ConnectorContext;
  cursor: string | null;
  updatedSince: Date | null;
  status: string | null;
  pageSize: number;
}
export interface ImportOrdersResult {
  items: ExternalOrder[];
  nextCursor: string | null;
  hasMore: boolean;
  importedAt: Date;
  providerRequestId: string | null;
}
export interface UpdateStockInput {
  context: ConnectorContext;
  externalProductId: string;
  externalVariationId: string | null;
  sku: string;
  availableQuantity: number;
  idempotencyKey: string;
  sourceUpdatedAt: Date;
}
export interface UpdateStockResult {
  success: boolean;
  externalProductId: string;
  acceptedQuantity: number;
  providerRequestId: string | null;
  synchronizedAt: Date;
}
export interface UpdatePriceInput {
  context: ConnectorContext;
  externalProductId: string;
  externalVariationId: string | null;
  price: number;
  currency: string;
  idempotencyKey: string;
}
export interface UpdatePriceResult {
  success: boolean;
  acceptedPrice: number;
  currency: string;
  providerRequestId: string | null;
  synchronizedAt: Date;
}
export interface SendInvoiceInput {
  context: ConnectorContext;
  externalOrderId: string;
  invoiceAccessKey: string;
  invoiceNumber: string;
  invoiceSeries: string;
  issuedAt: Date;
  xmlUrl: string;
  idempotencyKey: string;
}
export interface SendInvoiceResult {
  success: boolean;
  externalOrderId: string;
  providerRequestId: string | null;
  sentAt: Date;
}
export interface DisconnectResult {
  revoked: boolean;
  disconnectedAt: Date;
}
