import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import {
  InventoryOutboxEvent,
  OutboxEventStatus,
} from '../../inventory/entities/inventory-outbox-event.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductMarketplaceLink } from '../../product-marketplace-links/entities/product-marketplace-link.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import {
  MARKETPLACE_STOCK_SYNC_QUEUE,
  StockFanoutJob,
} from './marketplace-stock.jobs';
import {
  MarketplaceStockDivergence,
  MarketplaceStockSync,
  StockDivergenceStatus,
  StockSyncStatus,
} from './marketplace-stock-sync.entity';

@Injectable()
export class MarketplaceStockSyncService {
  constructor(
    private db: DataSource,
    @InjectQueue(MARKETPLACE_STOCK_SYNC_QUEUE) private queue: Queue,
    @InjectRepository(MarketplaceStockSync)
    private syncs: Repository<MarketplaceStockSync>,
    @InjectRepository(MarketplaceStockDivergence)
    private divergences: Repository<MarketplaceStockDivergence>,
  ) {}
  async requestProduct(companyId: string, productId: string, userId: string) {
    const event = await this.db.transaction(async (m) => {
      const product = await m.findOneBy(Product, { id: productId, companyId });
      if (!product) throw new NotFoundException('Produto não encontrado.');
      const balance = await m
        .getRepository(InventoryBalance)
        .createQueryBuilder('b')
        .setLock('pessimistic_read')
        .where('b.company_id=:companyId AND b.product_id=:productId', {
          companyId,
          productId,
        })
        .getOne();
      if (!balance)
        throw new NotFoundException('Saldo do produto não encontrado.');
      const quantity = Math.floor(
        Number(balance.currentQuantity) - Number(balance.reservedQuantity),
      );
      return m.save(
        InventoryOutboxEvent,
        m.create(InventoryOutboxEvent, {
          companyId,
          aggregateType: 'INVENTORY',
          aggregateId: productId,
          eventType: 'InventoryStockSyncRequested',
          payload: {
            companyId,
            productId,
            currentAvailable: quantity,
            inventoryVersion: balance.version,
            correlationId: randomUUID(),
            source: 'MANUAL',
            requestedByUserId: userId,
          },
          status: OutboxEventStatus.PENDING,
          attempts: 0,
          availableAt: new Date(),
          processedAt: null,
          lastError: null,
        }),
      );
    });
    return { eventId: event.id, status: 'PENDING' };
  }
  async list(companyId: string, status?: StockSyncStatus) {
    const qb = this.syncs
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.product', 'product')
      .leftJoinAndSelect('s.account', 'account')
      .where('s.company_id=:companyId', { companyId });
    if (status) qb.andWhere('s.status=:status', { status });
    return qb
      .select([
        's',
        'product.id',
        'product.sku',
        'product.name',
        'account.id',
        'account.displayName',
        'account.externalAccountName',
      ])
      .orderBy('s.created_at', 'DESC')
      .take(200)
      .getMany();
  }
  async retry(companyId: string, id: string, userId: string) {
    const sync = await this.syncs.findOneBy({ id, companyId });
    if (!sync) throw new NotFoundException('Sincronização não encontrada.');
    if (
      ![
        StockSyncStatus.FAILED,
        StockSyncStatus.SKIPPED,
        StockSyncStatus.SUPERSEDED,
      ].includes(sync.status)
    )
      throw new ConflictException(
        'Esta sincronização não pode ser repetida agora.',
      );
    return this.requestProduct(companyId, sync.productId, userId);
  }
  async reconcileAccount(companyId: string, accountId: string, userId: string) {
    const account = await this.db
      .getRepository(SalesChannelConnection)
      .findOneBy({ id: accountId, companyId });
    if (!account)
      throw new NotFoundException('Conta de marketplace não encontrada.');
    const rows: Array<{ productId: string }> = await this.db
      .getRepository(ProductMarketplaceLink)
      .createQueryBuilder('link')
      .innerJoin('link.listing', 'listing')
      .select('DISTINCT link.product_id', 'productId')
      .where(
        'link.company_id=:companyId AND listing.connection_id=:accountId AND link.status=:status',
        { companyId, accountId, status: 'ACTIVE' },
      )
      .getRawMany();
    const events: Array<{ eventId: string; status: string }> = [];
    for (const row of rows)
      events.push(await this.requestProduct(companyId, row.productId, userId));
    return {
      status: 'PENDING',
      products: events.length,
      eventIds: events.map((x) => x.eventId),
    };
  }
  listDivergences(companyId: string) {
    return this.divergences.find({
      where: { companyId },
      order: { detectedAt: 'DESC' },
      take: 200,
    });
  }
  async resolveDivergence(
    companyId: string,
    id: string,
    userId: string,
    notes?: string,
  ) {
    const d = await this.divergences.findOneBy({ id, companyId });
    if (!d) throw new NotFoundException('Divergência não encontrada.');
    d.status = StockDivergenceStatus.RESOLVED;
    d.resolvedAt = new Date();
    d.resolvedBy = userId;
    d.resolution = 'MANUAL';
    d.notes = notes ?? null;
    return this.divergences.save(d);
  }
  async enqueueFanout(data: StockFanoutJob) {
    const job = await this.queue.add('FANOUT', data, {
      jobId: `event-${data.inventoryEventId}`,
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 5000 },
    });
    return { jobId: String(job.id) };
  }
}
