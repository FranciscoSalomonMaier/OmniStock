import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { SalesChannelsService } from '../../sales-channels/sales-channels.service';
import { MarketplaceConnectorRegistry } from '../core/marketplace-connector.registry';
import {
  MarketplaceSyncRun,
  SyncRunStatus,
} from './entities/marketplace-sync-run.entity';
import {
  MERCADO_LIVRE_QUEUE,
  MercadoLivreJobOperation,
  MercadoLivreJobPayload,
} from './mercado-livre.jobs';
@Injectable()
export class MercadoLivreSyncService {
  constructor(
    @InjectQueue(MERCADO_LIVRE_QUEUE)
    private readonly queue: Queue<MercadoLivreJobPayload>,
    @InjectRepository(MarketplaceSyncRun)
    private readonly runs: Repository<MarketplaceSyncRun>,
    private readonly connections: SalesChannelsService,
    private readonly registry: MarketplaceConnectorRegistry,
  ) {}
  async enqueue(
    companyId: string,
    connectionId: string,
    operation: Extract<
      MercadoLivreJobOperation,
      'IMPORT_LISTINGS' | 'IMPORT_ORDERS'
    >,
  ) {
    const connection = await this.connections.get(companyId, connectionId),
      connector = this.registry.get(connection.channel.code),
      cap = connector.getCapabilities();
    const implemented =
      operation === 'IMPORT_LISTINGS'
        ? cap.productImport.implemented
        : cap.orderImport.implemented;
    if (!implemented) throw new Error('CONNECTOR_NOT_IMPLEMENTED');
    const correlationId = randomUUID(),
      run = await this.runs.save(
        this.runs.create({
          companyId,
          connectionId,
          operation,
          status: SyncRunStatus.PENDING,
          correlationId,
          startedAt: null,
          finishedAt: null,
          processedCount: 0,
          successCount: 0,
          failureCount: 0,
          cursor: null,
          errorCode: null,
          errorMessage: null,
        }),
      );
    await this.queue.add(
      operation,
      {
        companyId,
        connectionId,
        operation,
        correlationId,
        syncRunId: run.id,
        notificationId: null,
        cursor: null,
        attemptNumber: 1,
      },
      {
        jobId: run.id,
        attempts: 4,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    return { syncRunId: run.id, status: run.status };
  }
  listRuns(companyId: string, connectionId: string) {
    return this.runs.find({
      where: { companyId, connectionId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
