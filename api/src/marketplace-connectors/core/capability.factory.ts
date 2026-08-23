import type { MarketplaceCapabilities } from './marketplace-types';
const state = (supportedByProvider: boolean) => ({
  supportedByProvider,
  implemented: false,
});
export function unimplementedCapabilities(
  values: Partial<Record<keyof MarketplaceCapabilities, boolean>> = {},
): MarketplaceCapabilities {
  return {
    authorization: state(values.authorization ?? true),
    tokenRefresh: state(values.tokenRefresh ?? true),
    productImport: state(values.productImport ?? true),
    orderImport: state(values.orderImport ?? true),
    stockUpdate: state(values.stockUpdate ?? true),
    priceUpdate: state(values.priceUpdate ?? true),
    invoiceSubmission: state(values.invoiceSubmission ?? false),
    webhooks: state(values.webhooks ?? false),
    incrementalSync: state(values.incrementalSync ?? true),
    multipleAccounts: state(values.multipleAccounts ?? true),
    disconnectRevocation: state(values.disconnectRevocation ?? false),
  };
}
