import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import {
  ImportMarketplaceOrderJob,
  MARKETPLACE_ORDER_IMPORT_QUEUE,
  MARKETPLACE_ORDER_RECONCILIATION_QUEUE,
  MarketplaceOrderJobSource,
  ReconcileMarketplaceOrdersJob,
} from './marketplace-order.jobs';
@Injectable()
export class MarketplaceOrderQueueService {
  constructor(
    @InjectQueue(MARKETPLACE_ORDER_IMPORT_QUEUE)
    private imports: Queue<ImportMarketplaceOrderJob>,
    @InjectQueue(MARKETPLACE_ORDER_RECONCILIATION_QUEUE)
    private reconciliations: Queue<ReconcileMarketplaceOrdersJob>,
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
  ) {}
  async enqueueOrder(
    companyId: string,
    accountId: string,
    externalOrderId: string,
    source: MarketplaceOrderJobSource,
    options: {
      webhookEventId?: string;
      requestedByUserId?: string;
      correlationId?: string;
    } = {},
  ) {
    await this.connection(companyId, accountId);
    const correlationId = options.correlationId ?? randomUUID(),
      job = await this.imports.add(
        'IMPORT_ORDER',
        {
          companyId,
          marketplaceAccountId: accountId,
          externalOrderId,
          source,
          correlationId,
          webhookEventId: options.webhookEventId,
          requestedByUserId: options.requestedByUserId,
        },
        {
          jobId: `${accountId}-${externalOrderId}-${source}-${options.webhookEventId ?? correlationId}`,
          attempts: Number(process.env.ORDER_IMPORT_MAX_ATTEMPTS ?? 5),
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      );
    return { jobId: String(job.id), correlationId, status: 'QUEUED' };
  }
  async enqueueReconciliation(
    companyId: string,
    accountId: string,
    requestedByUserId?: string,
  ) {
    await this.connection(companyId, accountId);
    const correlationId = randomUUID(),
      job = await this.reconciliations.add(
        'RECONCILE_ACCOUNT',
        {
          companyId,
          marketplaceAccountId: accountId,
          correlationId,
          requestedByUserId,
        },
        {
          jobId: `${accountId}-${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      );
    return { jobId: String(job.id), correlationId, status: 'QUEUED' };
  }
  private async connection(companyId: string, id: string) {
    return this.connections.findOneByOrFail({ id, companyId });
  }
}
