import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { SalesChannelsService } from '../../sales-channels/sales-channels.service';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import type { ConnectorContext } from '../core/marketplace-types';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { MarketplaceOrderImportItem } from './entities/marketplace-order-import-item.entity';
import { MarketplaceOrderImport } from './entities/marketplace-order-import.entity';
import { MercadoLivreApiClient } from './mercado-livre-api.client';
import { MercadoLivreConnector } from './mercado-livre.connector';
import { MercadoLivreIntegrationService } from './mercado-livre-integration.service';
import {
  UpdateMarketplacePriceDto,
  UpdateMarketplaceStockDto,
} from './dto/mercado-livre-operation.dto';
@Injectable()
export class MercadoLivreOperationsService {
  constructor(
    @InjectRepository(MarketplaceListing)
    private readonly listings: Repository<MarketplaceListing>,
    @InjectRepository(MarketplaceOrderImport)
    private readonly orders: Repository<MarketplaceOrderImport>,
    @InjectRepository(MarketplaceOrderImportItem)
    private readonly items: Repository<MarketplaceOrderImportItem>,
    private readonly channels: SalesChannelsService,
    private readonly integration: MercadoLivreIntegrationService,
    private readonly connector: MercadoLivreConnector,
    private readonly api: MercadoLivreApiClient,
  ) {}
  async listListings(companyId: string, connectionId: string) {
    await this.channels.get(companyId, connectionId);
    return this.listings.find({
      where: { companyId, connectionId },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
  }
  async listOrders(companyId: string, connectionId: string) {
    await this.channels.get(companyId, connectionId);
    const orders = await this.orders.find({
      where: { companyId, connectionId },
      order: { externalUpdatedAt: 'DESC' },
      take: 200,
    });
    return Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await this.items.findBy({ companyId, orderImportId: order.id }),
      })),
    );
  }
  async externalOrder(
    companyId: string,
    connectionId: string,
    externalOrderId: string,
  ) {
    const connection = await this.channels.get(companyId, connectionId),
      tokens = await this.integration.validTokens(connection),
      order = await this.api.getOrder(tokens.accessToken!, externalOrderId);
    if (String(order.seller.id) !== connection.externalAccountId)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Pedido não encontrado para esta conexão.',
      );
    return order;
  }
  async shipment(companyId: string, connectionId: string, shipmentId: string) {
    const connection = await this.channels.get(companyId, connectionId);
    if (
      !(await this.orders.exists({
        where: { companyId, connectionId, shipmentId },
      }))
    )
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Envio não associado a esta conexão.',
      );
    const tokens = await this.integration.validTokens(connection);
    return this.api.getShipment(tokens.accessToken!, shipmentId);
  }
  async updateStock(
    companyId: string,
    connectionId: string,
    dto: UpdateMarketplaceStockDto,
  ) {
    const { listing, context } = await this.context(
      companyId,
      connectionId,
      dto.listingId,
    );
    return this.connector.updateStock({
      context,
      externalProductId: listing.externalItemId,
      externalVariationId: listing.externalVariationId,
      sku: listing.externalSku ?? '',
      availableQuantity: dto.availableQuantity,
      idempotencyKey: dto.idempotencyKey,
      sourceUpdatedAt: new Date(),
    });
  }
  async updatePrice(
    companyId: string,
    connectionId: string,
    dto: UpdateMarketplacePriceDto,
  ) {
    const { listing, context } = await this.context(
      companyId,
      connectionId,
      dto.listingId,
    );
    return this.connector.updatePrice({
      context,
      externalProductId: listing.externalItemId,
      externalVariationId: listing.externalVariationId,
      price: dto.price,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
    });
  }
  private async context(
    companyId: string,
    connectionId: string,
    listingId: string,
  ) {
    const connection = await this.channels.get(companyId, connectionId);
    if (connection.channel.code !== SalesChannelCode.MERCADO_LIVRE)
      throw new MarketplaceConnectorError(
        'CONNECTOR_NOT_FOUND',
        'Conexão inválida.',
      );
    const listing = await this.listings.findOneBy({
      id: listingId,
      companyId,
      connectionId,
    });
    if (!listing)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Anúncio não encontrado.',
      );
    const credentials = await this.integration.validTokens(connection),
      context: ConnectorContext = {
        companyId,
        connectionId,
        channelCode: SalesChannelCode.MERCADO_LIVRE,
        externalAccountId: connection.externalAccountId,
        correlationId: randomUUID(),
        operationId: dtoOperationId(),
        locale: 'pt-BR',
        credentials,
        metadata: {},
      };
    return { listing, context };
  }
}
function dtoOperationId() {
  return randomUUID();
}
