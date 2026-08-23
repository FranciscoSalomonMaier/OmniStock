import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
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
export interface MarketplaceConnector {
  readonly channelCode: SalesChannelCode;
  readonly enabled: boolean;
  getCapabilities(): MarketplaceCapabilities;
  getAuthorizationUrl(
    input: AuthorizationUrlInput,
  ): Promise<AuthorizationUrlResult>;
  exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<AuthorizationResult>;
  refreshToken(input: RefreshTokenInput): Promise<TokenRefreshResult>;
  validateConnection(
    context: ConnectorContext,
  ): Promise<ConnectionValidationResult>;
  importProducts(input: ImportProductsInput): Promise<ImportProductsResult>;
  importOrders(input: ImportOrdersInput): Promise<ImportOrdersResult>;
  updateStock(input: UpdateStockInput): Promise<UpdateStockResult>;
  updatePrice(input: UpdatePriceInput): Promise<UpdatePriceResult>;
  sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult>;
  disconnect(context: ConnectorContext): Promise<DisconnectResult>;
}
