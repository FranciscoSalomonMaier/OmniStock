import type { MarketplaceConnector } from './marketplace-connector.interface';
import { connectorNotImplemented } from './marketplace-errors';
import type {
  AuthorizationResult,
  AuthorizationUrlInput,
  AuthorizationUrlResult,
  ConnectionValidationResult,
  ConnectorContext,
  DisconnectResult,
  ExchangeAuthorizationCodeInput,
  ImportOrdersInput,
  ImportOrdersResult,
  ImportProductsInput,
  ImportProductsResult,
  MarketplaceCapabilities,
  RefreshTokenInput,
  SendInvoiceInput,
  SendInvoiceResult,
  TokenRefreshResult,
  UpdatePriceInput,
  UpdatePriceResult,
  UpdateStockInput,
  UpdateStockResult,
} from './marketplace-types';
export abstract class UnimplementedMarketplaceConnector implements MarketplaceConnector {
  abstract readonly channelCode: MarketplaceConnector['channelCode'];
  abstract readonly enabled: boolean;
  abstract getCapabilities(): MarketplaceCapabilities;
  getAuthorizationUrl(
    input: AuthorizationUrlInput,
  ): Promise<AuthorizationUrlResult> {
    return this.unavailable(input);
  }
  exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<AuthorizationResult> {
    return this.unavailable(input);
  }
  refreshToken(input: RefreshTokenInput): Promise<TokenRefreshResult> {
    return this.unavailable(input);
  }
  validateConnection(
    context: ConnectorContext,
  ): Promise<ConnectionValidationResult> {
    return this.unavailable(context);
  }
  importProducts(input: ImportProductsInput): Promise<ImportProductsResult> {
    return this.unavailable(input);
  }
  importOrders(input: ImportOrdersInput): Promise<ImportOrdersResult> {
    return this.unavailable(input);
  }
  updateStock(input: UpdateStockInput): Promise<UpdateStockResult> {
    return this.unavailable(input);
  }
  updatePrice(input: UpdatePriceInput): Promise<UpdatePriceResult> {
    return this.unavailable(input);
  }
  sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult> {
    return this.unavailable(input);
  }
  disconnect(context: ConnectorContext): Promise<DisconnectResult> {
    return this.unavailable(context);
  }
  private unavailable<T>(input: unknown): Promise<T> {
    void input;
    return Promise.reject(connectorNotImplemented());
  }
}
