import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import type { MarketplaceConnector } from '../core/marketplace-connector.interface';
import {
  connectorNotImplemented,
  MarketplaceConnectorError,
} from '../core/marketplace-errors';
import type {
  AuthorizationResult,
  AuthorizationUrlInput,
  AuthorizationUrlResult,
  ConnectionValidationResult,
  ConnectorContext,
  DisconnectResult,
  ExchangeAuthorizationCodeInput,
  ExternalOrder,
  ExternalProduct,
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
} from '../core/marketplace-types';
import { MercadoLivreApiClient } from './mercado-livre-api.client';
import type {
  MercadoLivreItem,
  MercadoLivreOrder,
} from './mercado-livre.types';
@Injectable()
export class MercadoLivreConnector implements MarketplaceConnector {
  readonly channelCode = SalesChannelCode.MERCADO_LIVRE;
  readonly enabled: boolean;
  private readonly authBase: string;
  private readonly clientId: string;
  private readonly redirectUri: string;
  constructor(
    config: ConfigService,
    private readonly api: MercadoLivreApiClient,
  ) {
    this.enabled =
      config.get<boolean>('MERCADO_LIVRE_CONNECTOR_ENABLED') ?? false;
    this.authBase =
      config.get<string>('MERCADO_LIVRE_AUTH_BASE_URL') ??
      'https://auth.mercadolivre.com.br/authorization';
    this.clientId = config.get<string>('MERCADO_LIVRE_CLIENT_ID') ?? '';
    this.redirectUri = config.get<string>('MERCADO_LIVRE_REDIRECT_URI') ?? '';
  }
  getCapabilities(): MarketplaceCapabilities {
    const implemented = (supportedByProvider = true) => ({
      supportedByProvider,
      implemented: supportedByProvider,
    });
    return {
      authorization: implemented(),
      tokenRefresh: implemented(),
      productImport: implemented(),
      orderImport: implemented(),
      stockUpdate: implemented(),
      priceUpdate: implemented(),
      invoiceSubmission: { supportedByProvider: false, implemented: false },
      webhooks: implemented(),
      incrementalSync: implemented(),
      multipleAccounts: implemented(),
      disconnectRevocation: { supportedByProvider: false, implemented: false },
    };
  }
  getAuthorizationUrl(
    input: AuthorizationUrlInput,
  ): Promise<AuthorizationUrlResult> {
    this.ensureEnabled();
    const url = new URL(this.authBase);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: input.state,
    }).toString();
    return Promise.resolve({
      url: url.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      stateIdentifier: input.state,
    });
  }
  async exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<AuthorizationResult> {
    this.ensureEnabled();
    const token = await this.api.exchangeAuthorizationCode(input.code);
    return {
      externalAccountId: String(token.user_id),
      externalAccountName: null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      grantedScopes: token.scope.split(' ').filter(Boolean),
      metadata: { tokenType: token.token_type },
    };
  }
  async refreshToken(input: RefreshTokenInput): Promise<TokenRefreshResult> {
    const token = await this.api.refreshAccessToken(input.refreshToken);
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      grantedScopes: token.scope.split(' ').filter(Boolean),
    };
  }
  async validateConnection(
    context: ConnectorContext,
  ): Promise<ConnectionValidationResult> {
    const user = await this.api.getCurrentUser(this.accessToken(context));
    return {
      valid: true,
      externalAccountId: String(user.id),
      externalAccountName: user.nickname,
      checkedAt: new Date(),
    };
  }
  async importProducts(
    input: ImportProductsInput,
  ): Promise<ImportProductsResult> {
    const token = this.accessToken(input.context),
      seller = this.seller(input.context);
    const page = await this.api.listSellerItems(
      token,
      seller,
      input.cursor,
      input.pageSize,
    );
    const details = await Promise.all(
      page.results.map((id) => this.api.getItem(token, id)),
    );
    return {
      items: details.flatMap((item) => this.mapProducts(item)),
      nextCursor: page.scroll_id ?? null,
      hasMore: Boolean(page.scroll_id && page.results.length),
      importedAt: new Date(),
      providerRequestId: null,
    };
  }
  async importOrders(input: ImportOrdersInput): Promise<ImportOrdersResult> {
    const offset = Number(input.cursor ?? 0);
    const page = await this.api.searchOrders(
      this.accessToken(input.context),
      this.seller(input.context),
      offset,
      input.pageSize,
      input.updatedSince,
    );
    return {
      items: page.results.map((order) => this.mapOrder(order)),
      nextCursor:
        offset + page.paging.limit < page.paging.total
          ? String(offset + page.paging.limit)
          : null,
      hasMore: offset + page.paging.limit < page.paging.total,
      importedAt: new Date(),
      providerRequestId: null,
    };
  }
  async updateStock(input: UpdateStockInput): Promise<UpdateStockResult> {
    if (
      !Number.isInteger(input.availableQuantity) ||
      input.availableQuantity < 0
    )
      throw new MarketplaceConnectorError(
        'VALIDATION_ERROR',
        'A quantidade deve ser um inteiro não negativo.',
      );
    const body = input.externalVariationId
      ? {
          variations: [
            {
              id: Number(input.externalVariationId),
              available_quantity: input.availableQuantity,
            },
          ],
        }
      : { available_quantity: input.availableQuantity };
    const item = await this.api.updateItem(
      this.accessToken(input.context),
      input.externalProductId,
      body,
    );
    return {
      success: true,
      externalProductId: item.id,
      acceptedQuantity: input.availableQuantity,
      providerRequestId: null,
      synchronizedAt: new Date(),
    };
  }
  async updatePrice(input: UpdatePriceInput): Promise<UpdatePriceResult> {
    if (input.externalVariationId)
      throw new MarketplaceConnectorError(
        'OPERATION_NOT_SUPPORTED',
        'Atualização de preço por variação requer confirmação adicional do formato oficial.',
      );
    if (input.price <= 0)
      throw new MarketplaceConnectorError(
        'VALIDATION_ERROR',
        'O preço deve ser positivo.',
      );
    const item = await this.api.updateItem(
      this.accessToken(input.context),
      input.externalProductId,
      { price: input.price },
    );
    return {
      success: true,
      acceptedPrice: item.price,
      currency: item.currency_id,
      providerRequestId: null,
      synchronizedAt: new Date(),
    };
  }
  sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult> {
    void input;
    return Promise.reject(connectorNotImplemented());
  }
  disconnect(context: ConnectorContext): Promise<DisconnectResult> {
    void context;
    return Promise.resolve({ revoked: false, disconnectedAt: new Date() });
  }
  private accessToken(context: ConnectorContext) {
    if (!context.credentials?.accessToken)
      throw new MarketplaceConnectorError(
        'INVALID_CREDENTIALS',
        'Access token indisponível.',
      );
    return context.credentials.accessToken;
  }
  private seller(context: ConnectorContext) {
    if (!context.externalAccountId)
      throw new MarketplaceConnectorError(
        'CONNECTION_NOT_READY',
        'A conta externa não foi identificada.',
      );
    return context.externalAccountId;
  }
  private ensureEnabled() {
    if (!this.enabled || !this.clientId || !this.redirectUri)
      throw new MarketplaceConnectorError(
        'CONNECTOR_DISABLED',
        'O conector do Mercado Livre não está configurado.',
      );
  }
  private mapProducts(item: MercadoLivreItem): ExternalProduct[] {
    const sku =
      item.seller_custom_field ??
      item.attributes?.find((x) => x.id === 'SELLER_SKU')?.value_name ??
      null;
    if (!item.variations?.length)
      return [
        {
          externalId: item.id,
          externalSku: sku,
          title: item.title,
          description: null,
          status: item.status,
          price: item.price,
          currency: item.currency_id,
          availableQuantity: item.available_quantity,
          barcode: null,
          imageUrls: item.thumbnail ? [item.thumbnail] : [],
          categoryExternalId: item.category_id,
          variationId: null,
        },
      ];
    return item.variations.map((v) => ({
      externalId: item.id,
      externalSku:
        v.attributes?.find((x) => x.id === 'SELLER_SKU')?.value_name ?? sku,
      title: item.title,
      description: null,
      status: item.status,
      price: v.price ?? item.price,
      currency: item.currency_id,
      availableQuantity: v.available_quantity ?? 0,
      barcode: null,
      imageUrls: item.thumbnail ? [item.thumbnail] : [],
      categoryExternalId: item.category_id,
      variationId: String(v.id),
    }));
  }
  private mapOrder(order: MercadoLivreOrder): ExternalOrder {
    return {
      externalId: String(order.id),
      externalNumber: String(order.id),
      status: order.status,
      paymentStatus: order.payments?.[0]?.status ?? 'unknown',
      shippingStatus: order.shipping ? 'pending' : 'not_applicable',
      purchasedAt: new Date(order.date_created),
      updatedAt: new Date(order.date_last_updated),
      buyer: {
        name: order.buyer?.nickname ?? 'Comprador',
        document: null,
        email: null,
      },
      shippingAddress: {
        street: '',
        number: null,
        complement: null,
        district: null,
        city: '',
        state: '',
        postalCode: '',
        country: 'BR',
      },
      items: order.order_items.map((x) => ({
        externalItemId: x.item.id,
        externalProductId: x.item.id,
        externalSku: x.item.seller_sku ?? null,
        title: x.item.title,
        quantity: x.quantity,
        unitPrice: x.unit_price,
        totalPrice: x.unit_price * x.quantity,
        variationId: x.item.variation_id ? String(x.item.variation_id) : null,
      })),
      subtotal: order.total_amount,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: order.total_amount,
      currency: order.currency_id,
      metadata: {
        shipmentId: order.shipping?.id ? String(order.shipping.id) : null,
      },
    };
  }
}
