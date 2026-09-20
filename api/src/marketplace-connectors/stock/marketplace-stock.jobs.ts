export const MARKETPLACE_STOCK_SYNC_QUEUE = 'marketplace-stock-sync';
export interface StockFanoutJob {
  inventoryEventId: string;
  companyId: string;
  productId: string;
  inventoryVersion: number;
  quantity: number;
  correlationId: string;
  source: string;
}
export interface StockSyncJob extends StockFanoutJob {
  syncId: string;
  productMarketplaceLinkId: string;
  marketplaceAccountId: string;
  externalProductId: string;
  externalVariationId: string | null;
}
