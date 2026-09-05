import type { Product } from './product';

export type LinkStatus = 'ACTIVE' | 'INACTIVE' | 'INVALID' | 'PENDING_VALIDATION';
export type LinkSource = 'MANUAL' | 'SKU_EXACT_MATCH' | 'BARCODE_EXACT_MATCH' | 'IMPORTED' | 'API' | 'MIGRATION';
export type MatchedBy = 'SKU' | 'BARCODE' | 'EXTERNAL_ID' | 'MANUAL_SELECTION' | 'NONE';

export interface LinkListing {
  id: string;
  externalItemId: string;
  externalVariationId: string | null;
  externalSku: string | null;
  title: string;
  thumbnailUrl: string | null;
  price: string;
  currency: string;
  availableQuantity: number | null;
  status: string;
  lastSyncedAt: string;
  channel?: { id: string; code: string; name: string };
  connection?: { id: string; name: string };
}

export interface ProductMarketplaceLink {
  id: string;
  status: LinkStatus;
  linkSource: LinkSource;
  matchedByField: MatchedBy | null;
  matchConfidence: string | null;
  linkedAt: string;
  unlinkedAt: string | null;
  unlinkReason: string | null;
  lastValidation: { at: string | null; status: string | null; message: string | null };
  product: Pick<Product, 'id' | 'sku' | 'name' | 'salePrice' | 'status'>;
  listing: LinkListing;
  channel: { id: string; code: string; name: string };
  connection: { id: string; name: string; status: string };
  linkedBy: { id: string; name: string };
  unlinkedBy: { id: string; name: string } | null;
}

export interface LinkSuggestion {
  productId: string;
  sku: string;
  name: string;
  matchedBy: MatchedBy;
  confidence: number;
}

export interface UnlinkedListingItem {
  listing: LinkListing;
  suggestion: LinkSuggestion | null;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
