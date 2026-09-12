import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import {
  MarketplaceWebhookEvent,
  MarketplaceWebhookEventStatus,
} from '../../orders/entities/marketplace-webhook-event.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceOrderQueueService } from '../orders/marketplace-order-queue.service';
import { MercadoLivreNotificationDto } from './dto/mercado-livre-notification.dto';

@Injectable()
export class MercadoLivreWebhookService {
  constructor(
    @InjectRepository(MarketplaceWebhookEvent)
    private events: Repository<MarketplaceWebhookEvent>,
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
    private queue: MarketplaceOrderQueueService,
    private config: ConfigService,
  ) {}
  async receive(dto: MercadoLivreNotificationDto) {
    if (
      String(dto.application_id) !==
      this.config.getOrThrow<string>('MERCADO_LIVRE_CLIENT_ID')
    )
      throw new BadRequestException('Notificação inválida.');
    const orderId = /^\/orders\/(\d+)$/.exec(dto.resource)?.[1] ?? null;
    if (dto.topic !== 'orders_v2' || !orderId)
      return { received: true, ignored: true };
    const identity = {
        _id: dto._id ?? null,
        resource: dto.resource,
        topic: dto.topic,
        user_id: String(dto.user_id),
        application_id: String(dto.application_id),
      },
      relevant = {
        ...identity,
        attempts: dto.attempts ?? null,
        sent: dto.sent ?? null,
      },
      payloadHash = createHash('sha256')
        .update(JSON.stringify(identity))
        .digest('hex');
    let event = await this.events.findOne({
      where: [
        { marketplace: SalesChannelCode.MERCADO_LIVRE, payloadHash },
        ...(dto._id
          ? [
              {
                marketplace: SalesChannelCode.MERCADO_LIVRE,
                externalEventId: dto._id,
              },
            ]
          : []),
      ],
    });
    if (
      event &&
      [
        MarketplaceWebhookEventStatus.PROCESSED,
        MarketplaceWebhookEventStatus.QUEUED,
        MarketplaceWebhookEventStatus.PROCESSING,
      ].includes(event.status)
    )
      return { received: true, duplicate: true, eventId: event.id };
    const connection = await this.connections
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.channel', 'channel')
      .where('c.externalAccountId=:user', { user: String(dto.user_id) })
      .andWhere('channel.code=:code', { code: SalesChannelCode.MERCADO_LIVRE })
      .getOne();
    if (!event)
      event = this.events.create({
        companyId: connection?.companyId ?? null,
        marketplaceAccountId: connection?.id ?? null,
        marketplace: SalesChannelCode.MERCADO_LIVRE,
        externalEventId: dto._id ?? null,
        eventType: dto.topic,
        resource: dto.resource,
        externalOrderId: orderId,
        payload: relevant,
        payloadHash,
        status: connection
          ? MarketplaceWebhookEventStatus.RECEIVED
          : MarketplaceWebhookEventStatus.IGNORED,
        attempts: 0,
        receivedAt: new Date(),
        queuedAt: null,
        processedAt: connection ? null : new Date(),
        failedAt: null,
        lastError: connection ? null : 'Conta de marketplace não encontrada.',
      });
    try {
      event = await this.events.save(event);
    } catch (error) {
      const duplicate = await this.events.findOneBy({
        marketplace: SalesChannelCode.MERCADO_LIVRE,
        payloadHash,
      });
      if (!duplicate) throw error;
      event = duplicate;
    }
    if (!connection)
      return { received: true, ignored: true, eventId: event.id };
    try {
      const result = await this.queue.enqueueOrder(
        connection.companyId,
        connection.id,
        orderId,
        'WEBHOOK',
        { webhookEventId: event.id },
      );
      event.status = MarketplaceWebhookEventStatus.QUEUED;
      event.queuedAt = new Date();
      event.lastError = null;
      await this.events.save(event);
      return {
        received: true,
        duplicate: false,
        eventId: event.id,
        jobId: result.jobId,
      };
    } catch (error) {
      event.status = MarketplaceWebhookEventStatus.FAILED;
      event.failedAt = new Date();
      event.lastError = 'Não foi possível enfileirar o evento.';
      await this.events.save(event);
      throw error;
    }
  }
}
