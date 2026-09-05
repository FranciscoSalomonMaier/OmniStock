import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import type {
  ConnectorContext,
  ExternalOrder,
  ExternalProduct,
} from '../core/marketplace-types';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import {
  MarketplaceNotification,
  NotificationStatus,
} from './entities/marketplace-notification.entity';
import { MarketplaceOrderImportItem } from './entities/marketplace-order-import-item.entity';
import { MarketplaceOrderImport } from './entities/marketplace-order-import.entity';
import {
  MarketplaceSyncRun,
  SyncRunStatus,
} from './entities/marketplace-sync-run.entity';
import { MercadoLivreConnector } from './mercado-livre.connector';
import { MercadoLivreIntegrationService } from './mercado-livre-integration.service';
import {
  MERCADO_LIVRE_QUEUE,
  MercadoLivreJobPayload,
} from './mercado-livre.jobs';
import { OrderImportService } from '../../orders/order-import.service';
@Processor(MERCADO_LIVRE_QUEUE, { concurrency: 3 })
export class MercadoLivreProcessor extends WorkerHost {
  constructor(
    @InjectRepository(SalesChannelConnection)
    private readonly connections: Repository<SalesChannelConnection>,
    @InjectRepository(MarketplaceListing)
    private readonly listings: Repository<MarketplaceListing>,
    @InjectRepository(MarketplaceOrderImport)
    private readonly orders: Repository<MarketplaceOrderImport>,
    @InjectRepository(MarketplaceOrderImportItem)
    private readonly orderItems: Repository<MarketplaceOrderImportItem>,
    @InjectRepository(MarketplaceSyncRun)
    private readonly runs: Repository<MarketplaceSyncRun>,
    @InjectRepository(MarketplaceNotification)
    private readonly notifications: Repository<MarketplaceNotification>,
    private readonly connector: MercadoLivreConnector,
    private readonly integration: MercadoLivreIntegrationService,
    private readonly orderImporter: OrderImportService,
  ) {
    super();
  }
  async process(job: Job<MercadoLivreJobPayload>) {
    if (!job.data.syncRunId) return;
    const run = await this.runs.findOneByOrFail({
      id: job.data.syncRunId,
      companyId: job.data.companyId,
      connectionId: job.data.connectionId,
    });
    run.status = SyncRunStatus.RUNNING;
    run.startedAt = new Date();
    await this.runs.save(run);
    try {
      const connection = await this.connections.findOne({
        where: { id: job.data.connectionId, companyId: job.data.companyId },
        relations: { channel: true },
      });
      if (
        !connection ||
        connection.channel.code !== SalesChannelCode.MERCADO_LIVRE
      )
        throw new MarketplaceConnectorError(
          'CONNECTION_NOT_READY',
          'Conexão inválida para o job.',
        );
      const tokens = await this.integration.validTokens(connection),
        context: ConnectorContext = {
          companyId: connection.companyId,
          connectionId: connection.id,
          channelCode: SalesChannelCode.MERCADO_LIVRE,
          externalAccountId: connection.externalAccountId,
          correlationId: job.data.correlationId,
          operationId: run.id,
          locale: 'pt-BR',
          credentials: tokens,
          metadata: {},
        };
      if (job.data.operation === 'IMPORT_LISTINGS')
        await this.products(context, connection, run);
      if (job.data.operation === 'IMPORT_ORDERS')
        await this.importOrders(context, run);
      if (
        job.data.operation === 'PROCESS_NOTIFICATION' &&
        job.data.notificationId
      ) {
        const notification = await this.notifications.findOneByOrFail({
          id: job.data.notificationId,
          companyId: connection.companyId,
          connectionId: connection.id,
        });
        notification.status = NotificationStatus.PROCESSING;
        await this.notifications.save(notification);
        if (notification.topic.includes('item'))
          await this.products(context, connection, run);
        else if (notification.topic.includes('order'))
          await this.importOrders(context, run);
        else notification.status = NotificationStatus.IGNORED;
        if (notification.status !== NotificationStatus.IGNORED)
          notification.status = NotificationStatus.PROCESSED;
        notification.processedAt = new Date();
        await this.notifications.save(notification);
      }
      run.status = SyncRunStatus.SUCCEEDED;
      run.finishedAt = new Date();
      connection.lastSyncAt = new Date();
      connection.lastSuccessfulSyncAt = new Date();
      connection.lastErrorAt = null;
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
      await Promise.all([
        this.runs.save(run),
        this.connections.save(connection),
      ]);
    } catch (error) {
      run.status = SyncRunStatus.FAILED;
      run.finishedAt = new Date();
      run.failureCount++;
      run.errorCode =
        error instanceof MarketplaceConnectorError
          ? error.code
          : 'UNKNOWN_PROVIDER_ERROR';
      run.errorMessage =
        error instanceof MarketplaceConnectorError
          ? error.message
          : 'Falha ao sincronizar com o Mercado Livre.';
      await this.runs.save(run);
      throw error;
    }
  }
  private async products(
    context: ConnectorContext,
    connection: SalesChannelConnection,
    run: MarketplaceSyncRun,
  ) {
    let cursor: string | null = null,
      pages = 0;
    do {
      const result = await this.connector.importProducts({
        context,
        cursor,
        updatedSince: null,
        pageSize: 50,
        filters: {},
      });
      for (const item of result.items)
        await this.upsertListing(connection, item);
      run.processedCount += result.items.length;
      run.successCount += result.items.length;
      cursor = result.nextCursor;
      run.cursor = cursor;
      await this.runs.save(run);
      pages++;
    } while (cursor && pages < 100);
  }
  private async upsertListing(
    connection: SalesChannelConnection,
    item: ExternalProduct,
  ) {
    const variation = item.variationId ?? '';
    await this.listings.query(
      `INSERT INTO marketplace_listings(company_id,connection_id,sales_channel_id,external_item_id,external_variation_id,external_seller_id,external_sku,title,status,price,currency,available_quantity,sold_quantity,thumbnail_url,last_synced_at) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12,NULL,$13,now()) ON CONFLICT(company_id,connection_id,external_item_id,(COALESCE(external_variation_id,''))) DO UPDATE SET external_sku=EXCLUDED.external_sku,title=EXCLUDED.title,status=EXCLUDED.status,price=EXCLUDED.price,currency=EXCLUDED.currency,available_quantity=EXCLUDED.available_quantity,thumbnail_url=EXCLUDED.thumbnail_url,last_synced_at=now(),updated_at=now()`,
      [
        connection.companyId,
        connection.id,
        connection.salesChannelId,
        item.externalId,
        variation,
        connection.externalAccountId,
        item.externalSku,
        item.title,
        item.status,
        item.price,
        item.currency,
        item.availableQuantity,
        item.imageUrls[0] ?? null,
      ],
    );
  }
  private async importOrders(
    context: ConnectorContext,
    run: MarketplaceSyncRun,
  ) {
    let cursor: string | null = null,
      pages = 0;
    do {
      const result = await this.connector.importOrders({
        context,
        cursor,
        updatedSince: null,
        status: null,
        pageSize: 50,
      });
      for (const order of result.items) {
        const imported = await this.upsertOrder(
          context.companyId,
          context.connectionId,
          order,
        );
        const connection = await this.connections.findOneByOrFail({
          id: context.connectionId,
          companyId: context.companyId,
        });
        await this.orderImporter.importMarketplace(connection, order, imported);
      }
      run.processedCount += result.items.length;
      run.successCount += result.items.length;
      cursor = result.nextCursor;
      run.cursor = cursor;
      await this.runs.save(run);
      pages++;
    } while (cursor && pages < 100);
  }
  private async upsertOrder(
    companyId: string,
    connectionId: string,
    order: ExternalOrder,
  ) {
    let entity = await this.orders.findOneBy({
      companyId,
      connectionId,
      externalOrderId: order.externalId,
    });
    entity ??= this.orders.create({
      companyId,
      connectionId,
      externalOrderId: order.externalId,
    });
    Object.assign(entity, {
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      buyerNickname: order.buyer.name,
      purchasedAt: order.purchasedAt,
      externalUpdatedAt: order.updatedAt,
      currency: order.currency,
      totalAmount: order.totalAmount,
      shipmentId:
        typeof order.metadata.shipmentId === 'string'
          ? order.metadata.shipmentId
          : null,
      lastSyncedAt: new Date(),
    });
    entity = await this.orders.save(entity);
    await this.orderItems.delete({ companyId, orderImportId: entity.id });
    await this.orderItems.save(
      order.items.map((item) =>
        this.orderItems.create({
          companyId,
          orderImportId: entity.id,
          externalItemId: item.externalItemId,
          externalVariationId: item.variationId,
          externalSku: item.externalSku,
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          currency: order.currency,
        }),
      ),
    );
    return entity;
  }
}
