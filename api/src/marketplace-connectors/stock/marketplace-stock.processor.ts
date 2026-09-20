import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import {
  InventoryOutboxEvent,
  OutboxEventStatus,
} from '../../inventory/entities/inventory-outbox-event.entity';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import { MarketplaceConnectorRegistry } from '../core/marketplace-connector.registry';
import { MarketplaceCredentialProvider } from '../core/marketplace-credential.provider';
import { ProductMarketplaceLink } from '../../product-marketplace-links/entities/product-marketplace-link.entity';
import { ProductMarketplaceLinkStatus } from '../../product-marketplace-links/enums/product-marketplace-link.enums';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import {
  SalesChannelCode,
  SalesChannelConnectionStatus,
} from '../../sales-channels/enums/sales-channel.enums';
import { MercadoLivreIntegrationService } from '../mercado-livre/mercado-livre-integration.service';
import {
  MARKETPLACE_STOCK_SYNC_QUEUE,
  StockFanoutJob,
  StockSyncJob,
} from './marketplace-stock.jobs';
import {
  MarketplaceStockDivergence,
  MarketplaceStockSync,
  StockDivergenceStatus,
  StockSyncStatus,
} from './marketplace-stock-sync.entity';

@Injectable()
export class StockOutboxSchedule implements OnModuleInit {
  constructor(
    @InjectQueue(MARKETPLACE_STOCK_SYNC_QUEUE) private q: Queue,
    private config: ConfigService,
  ) {}
  async onModuleInit() {
    if (!(this.config.get<boolean>('STOCK_SYNC_ENABLED') ?? true)) return;
    await this.q.upsertJobScheduler(
      'stock-outbox-publisher',
      { every: 1000 },
      {
        name: 'PUBLISH_OUTBOX',
        data: {},
        opts: { removeOnComplete: { count: 100 } },
      },
    );
  }
}

@Processor(MARKETPLACE_STOCK_SYNC_QUEUE, {
  concurrency: Number(process.env.STOCK_SYNC_CONCURRENCY ?? 5),
})
export class MarketplaceStockProcessor extends WorkerHost {
  private log = new Logger(MarketplaceStockProcessor.name);
  constructor(
    private db: DataSource,
    @InjectQueue(MARKETPLACE_STOCK_SYNC_QUEUE) private queue: Queue,
    @InjectRepository(MarketplaceStockSync)
    private syncs: Repository<MarketplaceStockSync>,
    @InjectRepository(MarketplaceStockDivergence)
    private divergences: Repository<MarketplaceStockDivergence>,
    private registry: MarketplaceConnectorRegistry,
    private credentials: MarketplaceCredentialProvider,
    private ml: MercadoLivreIntegrationService,
  ) {
    super();
  }
  async process(job: Job) {
    if (job.name === 'PUBLISH_OUTBOX') return this.publishOutbox();
    if (job.name === 'FANOUT') return this.fanout(job.data as StockFanoutJob);
    if (job.name === 'SYNC') return this.sync(job as Job<StockSyncJob>);
  }
  private async publishOutbox() {
    const events = await this.db.transaction(async (m) => {
      const rows = await m
        .getRepository(InventoryOutboxEvent)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where(
          "e.status IN ('PENDING','RETRYING') AND e.available_at<=now() AND e.event_type IN ('InventoryAvailabilityChanged','InventoryStockSyncRequested')",
        )
        .orderBy('e.created_at', 'ASC')
        .take(50)
        .getMany();
      for (const e of rows) {
        e.status = OutboxEventStatus.PROCESSING;
        e.attempts++;
      }
      return m.save(rows);
    });
    for (const e of events)
      try {
        const p = e.payload;
        await this.queue.add(
          'FANOUT',
          {
            inventoryEventId: e.id,
            companyId: e.companyId,
            productId: e.aggregateId,
            inventoryVersion: Number(p.inventoryVersion),
            quantity: Number(p.currentAvailable),
            correlationId: String(p.correlationId),
            source: String(p.source),
          } satisfies StockFanoutJob,
          {
            jobId: `event-${e.id}`,
            removeOnComplete: { count: 2000 },
            removeOnFail: { count: 5000 },
          },
        );
        e.status = OutboxEventStatus.PROCESSED;
        e.processedAt = new Date();
        e.lastError = null;
        await this.db.manager.save(e);
      } catch {
        e.status =
          e.attempts >= 5
            ? OutboxEventStatus.FAILED
            : OutboxEventStatus.RETRYING;
        e.availableAt = new Date(
          Date.now() + 5000 * 2 ** Math.min(e.attempts, 6),
        );
        e.lastError = 'Falha ao publicar evento de estoque.';
        await this.db.manager.save(e);
      }
    return { published: events.length };
  }
  private async fanout(data: StockFanoutJob) {
    const links = await this.db.getRepository(ProductMarketplaceLink).find({
      where: {
        companyId: data.companyId,
        productId: data.productId,
        status: ProductMarketplaceLinkStatus.ACTIVE,
      },
      relations: { listing: { connection: true, channel: true } },
    });
    let queued = 0;
    for (const link of links) {
      const listing = link.listing;
      if (!listing?.connection || !listing.channel) {
        this.log.error({
          event: 'marketplace.stock.fanout.invalid_link',
          companyId: data.companyId,
          productId: data.productId,
          productMarketplaceLinkId: link.id,
          inventoryEventId: data.inventoryEventId,
        });
        continue;
      }
      const connection = listing.connection;
      if (
        listing.companyId !== data.companyId ||
        connection.companyId !== data.companyId ||
        connection.status !== SalesChannelConnectionStatus.CONNECTED
      )
        continue;
      let sync = this.syncs.create({
        companyId: data.companyId,
        productId: data.productId,
        productMarketplaceLinkId: link.id,
        marketplaceAccountId: connection.id,
        marketplace: listing.channel.code,
        externalProductId: listing.externalItemId,
        externalVariationId: listing.externalVariationId,
        inventoryEventId: data.inventoryEventId,
        inventoryVersion: data.inventoryVersion,
        requestedQuantity: data.quantity,
        sentQuantity: null,
        externalQuantity: null,
        status: StockSyncStatus.PENDING,
        attemptCount: 0,
        source: data.source,
        correlationId: data.correlationId,
        externalRequestId: null,
        requestedAt: new Date(),
        synchronizedAt: null,
        nextRetryAt: null,
        failedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      try {
        sync = await this.syncs.save(sync);
      } catch {
        sync = await this.syncs.findOneByOrFail({
          productMarketplaceLinkId: link.id,
          inventoryVersion: data.inventoryVersion,
        });
        if (
          ![
            StockSyncStatus.PENDING,
            StockSyncStatus.PROCESSING,
            StockSyncStatus.RETRYING,
          ].includes(sync.status)
        ) {
          sync.status = StockSyncStatus.PENDING;
          sync.requestedQuantity = data.quantity;
          sync.source = data.source;
          sync.correlationId = data.correlationId;
          sync.requestedAt = new Date();
          sync.nextRetryAt = null;
          sync.failedAt = null;
          sync.lastErrorCode = null;
          sync.lastErrorMessage = null;
          await this.syncs.save(sync);
        }
      }
      const syncJobId = `${link.id}-${data.inventoryVersion}`;
      const previousJob = await this.queue.getJob(syncJobId);
      if (previousJob) {
        const state = await previousJob.getState();
        if (['active', 'waiting', 'delayed', 'prioritized'].includes(state))
          continue;
        await previousJob.remove();
      }
      await this.queue.add(
        'SYNC',
        {
          ...data,
          syncId: sync.id,
          productMarketplaceLinkId: link.id,
          marketplaceAccountId: connection.id,
          externalProductId: listing.externalItemId,
          externalVariationId: listing.externalVariationId,
        } satisfies StockSyncJob,
        {
          jobId: syncJobId,
          delay: Number(process.env.STOCK_SYNC_DEBOUNCE_MS ?? 2000),
          attempts: Number(process.env.STOCK_SYNC_MAX_ATTEMPTS ?? 5),
          backoff: {
            type: 'exponential',
            delay: Number(process.env.STOCK_SYNC_BACKOFF_MS ?? 5000),
          },
          removeOnComplete: { count: 5000 },
          removeOnFail: { count: 10000 },
        },
      );
      queued++;
    }
    return { queued };
  }
  private async sync(job: Job<StockSyncJob>) {
    const d = job.data,
      started = Date.now(),
      record = await this.syncs.findOneByOrFail({
        id: d.syncId,
        companyId: d.companyId,
      });
    record.status = StockSyncStatus.PROCESSING;
    record.attemptCount = job.attemptsMade + 1;
    await this.syncs.save(record);
    try {
      const [balance, link, connection] = await Promise.all([
        this.db
          .getRepository(InventoryBalance)
          .findOneBy({ companyId: d.companyId, productId: d.productId }),
        this.db.getRepository(ProductMarketplaceLink).findOne({
          where: { id: d.productMarketplaceLinkId, companyId: d.companyId },
          relations: { listing: true },
        }),
        this.db.getRepository(SalesChannelConnection).findOne({
          where: { id: d.marketplaceAccountId, companyId: d.companyId },
          relations: { channel: true },
        }),
      ]);
      if (
        !balance ||
        !link ||
        link.status !== ProductMarketplaceLinkStatus.ACTIVE ||
        !connection ||
        connection.status !== SalesChannelConnectionStatus.CONNECTED
      )
        throw new MarketplaceConnectorError(
          'CONNECTION_NOT_READY',
          'Vínculo ou conexão não está ativo.',
        );
      const current = Math.floor(
        Number(balance.currentQuantity) - Number(balance.reservedQuantity),
      );
      if (balance.version > d.inventoryVersion) {
        record.status = StockSyncStatus.SUPERSEDED;
        record.lastErrorCode = 'NEWER_INVENTORY_VERSION';
        record.lastErrorMessage =
          'Uma versão mais recente do estoque substituiu este envio.';
        return await this.syncs.save(record);
      }
      const token =
        connection.channel.code === SalesChannelCode.MERCADO_LIVRE
          ? await this.ml.validTokens(connection)
          : await this.credentials.get(d.companyId, connection.id);
      const result = await this.registry
        .get(connection.channel.code)
        .updateStock({
          context: {
            companyId: d.companyId,
            connectionId: connection.id,
            channelCode: connection.channel.code,
            externalAccountId: connection.externalAccountId,
            correlationId: d.correlationId,
            operationId: record.id,
            locale: 'pt-BR',
            credentials: token,
            metadata: { source: d.source },
          },
          externalProductId: d.externalProductId,
          externalVariationId: d.externalVariationId,
          sku: link.listing.externalSku ?? '',
          availableQuantity: current,
          idempotencyKey: `${link.id}:${balance.version}`,
          sourceUpdatedAt: balance.updatedAt,
        });
      record.sentQuantity = current;
      record.externalQuantity = result.acceptedQuantity;
      record.externalRequestId = result.providerRequestId;
      record.synchronizedAt = result.synchronizedAt;
      const latest = await this.db
        .getRepository(InventoryBalance)
        .findOneByOrFail({ id: balance.id, companyId: d.companyId });
      record.status =
        latest.version === balance.version
          ? StockSyncStatus.SUCCESS
          : StockSyncStatus.SUPERSEDED;
      if (result.acceptedQuantity !== current)
        await this.divergences.save(
          this.divergences.create({
            companyId: d.companyId,
            productId: d.productId,
            productMarketplaceLinkId: link.id,
            marketplaceAccountId: connection.id,
            expectedQuantity: current,
            externalQuantity: result.acceptedQuantity,
            status: StockDivergenceStatus.OPEN,
            detectedAt: new Date(),
            resolvedAt: null,
            resolvedBy: null,
            resolution: null,
            notes:
              'Quantidade confirmada pelo canal difere do estoque disponível.',
          }),
        );
      await this.syncs.save(record);
      this.log.log({
        event: 'marketplace.stock.synchronized',
        correlationId: d.correlationId,
        companyId: d.companyId,
        productId: d.productId,
        productMarketplaceLinkId: link.id,
        marketplaceAccountId: connection.id,
        marketplace: connection.channel.code,
        inventoryVersion: balance.version,
        requestedQuantity: current,
        jobId: job.id,
        attempt: record.attemptCount,
        duration: Date.now() - started,
        result: record.status,
      });
      return record;
    } catch (error) {
      const e = error instanceof MarketplaceConnectorError ? error : null,
        final =
          e?.retryable === false ||
          job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      record.status = final ? StockSyncStatus.FAILED : StockSyncStatus.RETRYING;
      record.failedAt = final ? new Date() : null;
      record.nextRetryAt = final
        ? null
        : new Date(
            Date.now() +
              Number(process.env.STOCK_SYNC_BACKOFF_MS ?? 5000) *
                2 ** job.attemptsMade,
          );
      record.lastErrorCode = e?.code ?? 'PERMANENT';
      record.lastErrorMessage = (
        e?.message ?? 'Falha ao sincronizar estoque.'
      ).slice(0, 500);
      await this.syncs.save(record);
      if (final && e?.code === 'RESOURCE_NOT_FOUND')
        await this.divergences.save(
          this.divergences.create({
            companyId: d.companyId,
            productId: d.productId,
            productMarketplaceLinkId: d.productMarketplaceLinkId,
            marketplaceAccountId: d.marketplaceAccountId,
            expectedQuantity: record.requestedQuantity,
            externalQuantity: null,
            status: StockDivergenceStatus.OPEN,
            detectedAt: new Date(),
            resolvedAt: null,
            resolvedBy: null,
            resolution: null,
            notes: 'O anúncio não foi localizado no marketplace.',
          }),
        );
      if (e && !e.retryable) return record;
      throw error;
    }
  }
}
