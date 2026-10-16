import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelConnectionStatus } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceConnectorRegistry } from '../core/marketplace-connector.registry';
import { ConnectorContext } from '../core/marketplace-types';
import { MercadoLivreIntegrationService } from '../mercado-livre/mercado-livre-integration.service';
import { OrderImportService } from '../../orders/order-import.service';
import { OrderProcessingService } from '../../orders/order-processing.service';
import {
  MarketplaceWebhookEvent,
  MarketplaceWebhookEventStatus,
} from '../../orders/entities/marketplace-webhook-event.entity';
import {
  ImportMarketplaceOrderJob,
  MARKETPLACE_ORDER_DEAD_LETTER_QUEUE,
  MARKETPLACE_ORDER_IMPORT_QUEUE,
} from './marketplace-order.jobs';
@Processor(MARKETPLACE_ORDER_IMPORT_QUEUE, {
  concurrency: Number(process.env.ORDER_IMPORT_CONCURRENCY ?? 5),
})
export class MarketplaceOrderProcessor extends WorkerHost {
  private log = new Logger(MarketplaceOrderProcessor.name);
  constructor(
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
    @InjectRepository(MarketplaceWebhookEvent)
    private events: Repository<MarketplaceWebhookEvent>,
    private registry: MarketplaceConnectorRegistry,
    private mlTokens: MercadoLivreIntegrationService,
    private importer: OrderImportService,
    private processing: OrderProcessingService,
    @InjectQueue(MARKETPLACE_ORDER_DEAD_LETTER_QUEUE) private dead: Queue,
  ) {
    super();
  }
  async process(job: Job<ImportMarketplaceOrderJob>) {
    const started = Date.now(),
      d = job.data,
      event = d.webhookEventId
        ? await this.events.findOneBy({ id: d.webhookEventId })
        : null;
    if (event && event.queueGeneration > 0) return { skipped: true };
    try {
      const connection = await this.connections.findOne({
        where: { id: d.marketplaceAccountId, companyId: d.companyId },
        relations: { channel: true },
      });
      if (
        !connection ||
        connection.status !== SalesChannelConnectionStatus.CONNECTED
      )
        throw new Error('Conexão de marketplace indisponível.');
      if (event) {
        event.status = MarketplaceWebhookEventStatus.PROCESSING;
        event.attempts = job.attemptsMade + 1;
        await this.events.save(event);
      }
      const order = await this.ingest(
        connection,
        d.externalOrderId,
        d.correlationId,
        d.source,
        String(job.id),
      );
      if (event) {
        event.status = MarketplaceWebhookEventStatus.PROCESSED;
        event.processedAt = new Date();
        event.lastError = null;
        await this.events.save(event);
      }
      this.log.log({
        event: 'marketplace.order.processed',
        correlationId: d.correlationId,
        companyId: d.companyId,
        marketplace: connection.channel.code,
        marketplaceAccountId: connection.id,
        externalOrderId: d.externalOrderId,
        orderId: order.id,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        duration: Date.now() - started,
        result: 'success',
      });
      return { orderId: order.id };
    } catch (error) {
      const final = job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1),
        message =
          error instanceof Error ? error.message : 'Falha ao importar pedido.';
      if (event) {
        event.status = final
          ? MarketplaceWebhookEventStatus.DEAD_LETTER
          : MarketplaceWebhookEventStatus.RETRYING;
        event.failedAt = final ? new Date() : null;
        event.lastError = message.slice(0, 500);
        await this.events.save(event);
      }
      if (final)
        await this.dead.add(
          'FAILED_ORDER',
          { ...d, error: message.slice(0, 500) },
          { jobId: `dead-${job.id}`, removeOnComplete: { count: 5000 } },
        );
      this.log.error({
        event: 'marketplace.order.failed',
        correlationId: d.correlationId,
        companyId: d.companyId,
        marketplaceAccountId: d.marketplaceAccountId,
        externalOrderId: d.externalOrderId,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        duration: Date.now() - started,
        result: final ? 'dead_letter' : 'retry',
      });
      throw error;
    }
  }
  async ingest(
    connection: SalesChannelConnection,
    externalOrderId: string,
    correlationId: string,
    source: string,
    operationId: string,
  ) {
    const credentials = await this.mlTokens.validTokens(connection),
      context: ConnectorContext = {
        companyId: connection.companyId,
        connectionId: connection.id,
        channelCode: connection.channel.code,
        externalAccountId: connection.externalAccountId,
        correlationId,
        operationId: operationId,
        locale: 'pt-BR',
        credentials,
        metadata: { source },
      },
      external = await this.registry
        .get(connection.channel.code)
        .getOrder({ context, externalOrderId }),
      order = await this.importer.ingestMarketplace(
        connection,
        external,
        source === 'MANUAL',
      );
    await this.processing.process(
      connection.companyId,
      order.id,
      correlationId,
    );
    return order;
  }
  @OnWorkerEvent('failed') failed() {
    /* state is persisted by process; hook keeps an instrumentation point */
  }
}
