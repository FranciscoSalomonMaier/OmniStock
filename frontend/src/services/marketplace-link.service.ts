import { apiRequest } from './api';
import type { ProductPage } from '../types/product';
import type {
  Page,
  ProductMarketplaceLink,
  UnlinkedListingItem,
} from '../types/marketplace-link';

const key = () => crypto.randomUUID();
export const marketplaceLinkService = {
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    apiRequest<Page<ProductMarketplaceLink>>(`/product-marketplace-links?${query}`, { signal }),
  get: (id: string) => apiRequest<ProductMarketplaceLink>(`/product-marketplace-links/${id}`),
  productLinks: (productId: string, signal?: AbortSignal) =>
    apiRequest<ProductMarketplaceLink[]>(`/products/${productId}/marketplace-links`, { signal }),
  unlinkedListings: (query: URLSearchParams, signal?: AbortSignal) =>
    apiRequest<Page<UnlinkedListingItem>>(`/marketplace-listings/unlinked?${query}`, { signal }),
  unlinkedProducts: (query: URLSearchParams, signal?: AbortSignal) =>
    apiRequest<ProductPage>(`/products/unlinked-marketplaces?${query}`, { signal }),
  products: (query: URLSearchParams, signal?: AbortSignal) =>
    apiRequest<ProductPage>(`/products?${query}`, { signal }),
  create: (productId: string, marketplaceListingId: string) =>
    apiRequest<ProductMarketplaceLink>('/product-marketplace-links', {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({ productId, marketplaceListingId }),
    }),
  acceptSuggestion: (listingId: string, productId: string) =>
    apiRequest<ProductMarketplaceLink>(`/marketplace-listings/${listingId}/accept-suggestion`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({ productId }),
    }),
  unlink: (id: string, reason?: string) =>
    apiRequest<ProductMarketplaceLink>(`/product-marketplace-links/${id}/unlink`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({ reason: reason || undefined }),
    }),
  validate: (id: string) =>
    apiRequest<ProductMarketplaceLink>(`/product-marketplace-links/${id}/validate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
    }),
  bulk: (links: Array<{ productId: string; marketplaceListingId: string }>) =>
    apiRequest<{ results: Array<Record<string, unknown>> }>('/product-marketplace-links/bulk', {
      method: 'POST',
      headers: { 'Idempotency-Key': key() },
      body: JSON.stringify({ links }),
    }),
};
