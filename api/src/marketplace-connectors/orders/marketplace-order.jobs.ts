export const MARKETPLACE_ORDER_IMPORT_QUEUE = 'marketplace-order-import',
  MARKETPLACE_ORDER_RECONCILIATION_QUEUE = 'marketplace-order-reconciliation',
  MARKETPLACE_ORDER_DEAD_LETTER_QUEUE = 'marketplace-order-dead-letter';
export type MarketplaceOrderJobSource = 'WEBHOOK' | 'PERIODIC_SYNC' | 'MANUAL';
export interface ImportMarketplaceOrderJob {
  webhookEventId?: string;
  companyId: string;
  marketplaceAccountId: string;
  externalOrderId: string;
  source: MarketplaceOrderJobSource;
  correlationId: string;
  requestedByUserId?: string;
}
export interface ReconcileMarketplaceOrdersJob {
  companyId: string;
  marketplaceAccountId: string;
  correlationId: string;
  requestedByUserId?: string;
}
