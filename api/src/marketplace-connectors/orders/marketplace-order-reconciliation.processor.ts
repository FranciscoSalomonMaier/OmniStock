import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelConnectionStatus } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceOrderSyncState } from '../../orders/entities/marketplace-webhook-event.entity';
import { MarketplaceConnectorRegistry } from '../core/marketplace-connector.registry';
import { ConnectorContext } from '../core/marketplace-types';
import { MercadoLivreIntegrationService } from '../mercado-livre/mercado-livre-integration.service';
import {
  MARKETPLACE_ORDER_RECONCILIATION_QUEUE,
  ReconcileMarketplaceOrdersJob,
} from './marketplace-order.jobs';
import { MarketplaceOrderQueueService } from './marketplace-order-queue.service';
@Injectable()
export class MarketplaceOrderScheduleService implements OnModuleInit {
  constructor(
    @InjectQueue(MARKETPLACE_ORDER_RECONCILIATION_QUEUE) private queue: Queue,
    private config: ConfigService,
  ) {}
  async onModuleInit() {
    if (!(this.config.get<boolean>('ORDER_SYNC_ENABLED') ?? true)) return;
    await this.queue.upsertJobScheduler(
      'scheduled-order-reconciliation',
      {
        pattern: this.config.get<string>('ORDER_SYNC_CRON') ?? '*/5 * * * *',
      },
      {
        name: 'SCHEDULED_SCAN',
        data: {},
        opts: { removeOnComplete: { count: 100 } },
      },
    );
  }
}
@Processor(MARKETPLACE_ORDER_RECONCILIATION_QUEUE, { concurrency: 1 })
export class MarketplaceOrderReconciliationProcessor extends WorkerHost {
  constructor(
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
    @InjectRepository(MarketplaceOrderSyncState)
    private states: Repository<MarketplaceOrderSyncState>,
    private registry: MarketplaceConnectorRegistry,
    private tokens: MercadoLivreIntegrationService,
    private queueService: MarketplaceOrderQueueService,
  ) {
    super();
  }
  async process(job: Job<ReconcileMarketplaceOrdersJob>) {
    if (job.name === 'SCHEDULED_SCAN') {
      const active = await this.connections.find({
        where: { status: SalesChannelConnectionStatus.CONNECTED },
        relations: { channel: true },
      });
      for (const c of active)
        if (c.channel.supportsOrders)
          await this.queueService.enqueueReconciliation(c.companyId, c.id);
      return { accounts: active.length };
    }
    const d = job.data,
      connection = await this.connections.findOne({
        where: {
          id: d.marketplaceAccountId,
          companyId: d.companyId,
          status: SalesChannelConnectionStatus.CONNECTED,
        },
        relations: { channel: true },
      });
    if (!connection) throw new Error('Conexão não encontrada.');
    let state = await this.states.findOneBy({
      companyId: d.companyId,
      marketplaceAccountId: connection.id,
    });
    state ??= this.states.create({
      companyId: d.companyId,
      marketplaceAccountId: connection.id,
      lastSuccessfulAt: null,
      cursor: null,
      lockUntil: null,
      lastError: null,
    });
    if (state.lockUntil && state.lockUntil > new Date())
      return { locked: true };
    state.lockUntil = new Date(Date.now() + 4 * 60 * 1000);
    state = await this.states.save(state);
    try {
      const overlap = Number(process.env.ORDER_SYNC_OVERLAP_MINUTES ?? 10),
        updatedSince = state.lastSuccessfulAt
          ? new Date(state.lastSuccessfulAt.getTime() - overlap * 60000)
          : null,
        credentials = await this.tokens.validTokens(connection),
        context: ConnectorContext = {
          companyId: d.companyId,
          connectionId: connection.id,
          channelCode: connection.channel.code,
          externalAccountId: connection.externalAccountId,
          correlationId: d.correlationId,
          operationId: String(job.id),
          locale: 'pt-BR',
          credentials,
          metadata: { source: 'PERIODIC_SYNC' },
        };
      let cursor = state.cursor,
        count = 0,
        pages = 0;
      do {
        const result = await this.registry
          .get(connection.channel.code)
          .importOrders({
            context,
            cursor,
            updatedSince,
            status: null,
            pageSize: 50,
          });
        for (const order of result.items) {
          await this.queueService.enqueueOrder(
            d.companyId,
            connection.id,
            order.externalId,
            'PERIODIC_SYNC',
            { correlationId: undefined },
          );
          count++;
        }
        cursor = result.nextCursor;
        state.cursor = cursor;
        await this.states.save(state);
        pages++;
      } while (cursor && pages < 100);
      state.lastSuccessfulAt = new Date();
      state.cursor = null;
      state.lockUntil = null;
      state.lastError = null;
      await this.states.save(state);
      return { count, pages };
    } catch (error) {
      state.lockUntil = null;
      state.lastError = (
        error instanceof Error ? error.message : 'Falha na reconciliação.'
      ).slice(0, 500);
      await this.states.save(state);
      throw error;
    }
  }
}
