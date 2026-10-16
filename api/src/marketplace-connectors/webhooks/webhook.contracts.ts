import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
export enum MarketplaceWebhookEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  SHIPMENT_UPDATED = 'SHIPMENT_UPDATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  STOCK_UPDATED = 'STOCK_UPDATED',
  UNKNOWN = 'UNKNOWN',
}
export interface MarketplaceWebhookRequest {
  payload: unknown;
  headers?: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}
export interface WebhookValidationResult {
  valid: boolean;
  mechanism: 'APPLICATION_AND_AUTHENTICATED_RESOURCE';
}
export interface NormalizedMarketplaceWebhook {
  marketplace: SalesChannelCode;
  eventType: MarketplaceWebhookEventType;
  externalEventId: string | null;
  externalAccountId: string;
  externalResourceId: string | null;
  externalOrderId: string | null;
  externalProductId: string | null;
  externalShipmentId: string | null;
  resource: string;
  topic: string;
  occurredAt: Date | null;
  receivedAt: Date;
  payload: Record<string, unknown>;
}
export interface MarketplaceWebhookAdapter {
  validateRequest(
    request: MarketplaceWebhookRequest,
  ): Promise<WebhookValidationResult>;
  normalize(
    request: MarketplaceWebhookRequest,
  ): Promise<NormalizedMarketplaceWebhook>;
}
export interface MarketplaceWebhookHandler {
  supports(event: NormalizedMarketplaceWebhook): boolean;
  handle(event: NormalizedMarketplaceWebhook): Promise<void>;
}
export const WEBHOOK_QUEUE = 'marketplace-webhook-processing';
export interface ProcessMarketplaceWebhookJob {
  webhookEventId: string;
  marketplace: SalesChannelCode;
  correlationId: string;
  generation: number;
}
