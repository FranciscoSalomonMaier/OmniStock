import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import {
  MarketplaceNotification,
  NotificationStatus,
} from './entities/marketplace-notification.entity';
import {
  MarketplaceSyncRun,
  SyncRunStatus,
} from './entities/marketplace-sync-run.entity';
import { MercadoLivreNotificationDto } from './dto/mercado-livre-notification.dto';
import {
  MERCADO_LIVRE_QUEUE,
  MercadoLivreJobPayload,
} from './mercado-livre.jobs';
@Injectable()
export class MercadoLivreWebhookService {
  constructor(
    @InjectRepository(MarketplaceNotification)
    private readonly notifications: Repository<MarketplaceNotification>,
    @InjectRepository(MarketplaceSyncRun)
    private readonly runs: Repository<MarketplaceSyncRun>,
    @InjectRepository(SalesChannelConnection)
    private readonly connections: Repository<SalesChannelConnection>,
    @InjectQueue(MERCADO_LIVRE_QUEUE)
    private readonly queue: Queue<MercadoLivreJobPayload>,
  ) {}
  async receive(dto: MercadoLivreNotificationDto) {
    const hash = createHash('sha256')
      .update(
        [
          dto._id ?? '',
          dto.resource,
          dto.topic,
          String(dto.user_id),
          String(dto.application_id),
          dto.sent ?? '',
        ].join('|'),
      )
      .digest('hex');
    if (await this.notifications.exists({ where: { payloadHash: hash } }))
      return { received: true, duplicate: true };
    const connection = await this.connections
      .createQueryBuilder('connection')
      .innerJoinAndSelect('connection.channel', 'channel')
      .where('connection.externalAccountId = :user', {
        user: String(dto.user_id),
      })
      .andWhere('channel.code = :code', {
        code: SalesChannelCode.MERCADO_LIVRE,
      })
      .getOne();
    const notification = await this.notifications.save(
      this.notifications.create({
        payloadHash: hash,
        applicationId: String(dto.application_id),
        externalUserId: String(dto.user_id),
        topic: dto.topic,
        resource: dto.resource,
        attempts: dto.attempts ?? null,
        sentAt: dto.sent ? new Date(dto.sent) : null,
        receivedAt: new Date(),
        status: connection
          ? NotificationStatus.QUEUED
          : NotificationStatus.IGNORED,
        companyId: connection?.companyId ?? null,
        connectionId: connection?.id ?? null,
        processedAt: connection ? null : new Date(),
        errorCode: connection ? null : 'CONNECTION_NOT_FOUND',
        errorMessage: connection ? null : 'Notificação de conta não conectada.',
      }),
    );
    if (connection) {
      const correlationId = randomUUID(),
        run = await this.runs.save(
          this.runs.create({
            companyId: connection.companyId,
            connectionId: connection.id,
            operation: 'PROCESS_NOTIFICATION',
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
        'PROCESS_NOTIFICATION',
        {
          companyId: connection.companyId,
          connectionId: connection.id,
          operation: 'PROCESS_NOTIFICATION',
          correlationId,
          syncRunId: run.id,
          notificationId: notification.id,
          cursor: null,
          attemptNumber: 1,
        },
        {
          jobId: `notification-${notification.id}`,
          attempts: 4,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
      notification.status = NotificationStatus.QUEUED;
      await this.notifications.save(notification);
    }
    return { received: true, duplicate: false };
  }
}
