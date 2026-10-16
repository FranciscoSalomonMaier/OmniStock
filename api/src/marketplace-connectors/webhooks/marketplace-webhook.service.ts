import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import {
  MarketplaceWebhookEvent,
  MarketplaceWebhookEventStatus as Status,
} from '../../orders/entities/marketplace-webhook-event.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelCredential } from '../../sales-channels/entities/sales-channel-credential.entity';
import { SalesChannelConnectionStatus } from '../../sales-channels/enums/sales-channel.enums';
import { MercadoLivreWebhookAdapter } from './mercado-livre-webhook.adapter';
import {
  MarketplaceWebhookRequest,
  MarketplaceWebhookEventType as Type,
} from './webhook.contracts';
@Injectable()
export class MarketplaceWebhookService {
  private log = new Logger(MarketplaceWebhookService.name);
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private adapter: MercadoLivreWebhookAdapter,
  ) {}
  async receive(request: MarketplaceWebhookRequest) {
    if (!this.config.get<boolean>('MARKETPLACE_WEBHOOKS_ENABLED', true))
      throw new ServiceUnavailableException('Notificações indisponíveis.');
    await this.adapter.validateRequest(request);
    const n = await this.adapter.normalize(request);
    const candidates = await this.db
      .getRepository(SalesChannelConnection)
      .find({
        where: { externalAccountId: n.externalAccountId },
        relations: { channel: true },
      });
    const matching = candidates.filter(
      (c) =>
        c.channel.code === n.marketplace &&
        c.status === SalesChannelConnectionStatus.CONNECTED,
    );
    const connection = matching.length === 1 ? matching[0] : null;
    const hasCredential = connection
      ? await this.db.getRepository(SalesChannelCredential).existsBy({
          companyId: connection.companyId,
          connectionId: connection.id,
        })
      : false;
    const known = n.eventType !== Type.UNKNOWN,
      processable = Boolean(connection && hasCredential && known);
    const identity = n.externalEventId
      ? ['ID', n.marketplace, n.externalAccountId, n.externalEventId]
      : [
          'HASH',
          n.marketplace,
          n.externalAccountId,
          n.topic,
          n.resource,
          n.occurredAt?.toISOString() ?? null,
        ];
    const hash = createHash('sha256')
      .update(JSON.stringify(identity))
      .digest('hex');
    const correlationId = randomUUID();
    const repo = this.db.getRepository(MarketplaceWebhookEvent);
    const event = repo.create({
      companyId: connection?.companyId ?? null,
      marketplaceAccountId: connection?.id ?? null,
      marketplace: n.marketplace,
      externalEventId: n.externalEventId,
      externalAccountId: n.externalAccountId,
      eventType: n.eventType,
      resource: n.resource,
      topic: n.topic,
      externalResourceId: n.externalResourceId,
      externalOrderId: n.externalOrderId,
      externalProductId: n.externalProductId,
      externalShipmentId: n.externalShipmentId,
      payload: n.payload,
      payloadHash: hash,
      headersMetadata: {
        ...(/^[a-zA-Z0-9_-]{1,120}$/.test(
          String(request.headers?.['x-request-id'] ?? ''),
        )
          ? { 'x-request-id': String(request.headers?.['x-request-id']) }
          : {}),
      },
      correlationId,
      occurredAt: n.occurredAt,
      status: processable ? Status.RECEIVED : Status.IGNORED,
      attempts: 0,
      receivedAt: n.receivedAt,
      nextRetryAt: processable ? new Date() : null,
      processedAt: processable ? null : new Date(),
      lastErrorCode: !connection
        ? 'ACCOUNT_NOT_FOUND'
        : !hasCredential
          ? 'AUTHENTICATION_ERROR'
          : !known
            ? 'UNSUPPORTED_TOPIC'
            : null,
      lastError: processable
        ? null
        : !connection
          ? 'Conta não resolvida de forma única.'
          : !hasCredential
            ? 'Credenciais indisponíveis.'
            : 'Tópico não suportado.',
      duplicateCount: 0,
      queueGeneration: 0,
      adminActions: [],
    });
    const inserted = await repo
      .createQueryBuilder()
      .insert()
      .values(event as never)
      .orIgnore()
      .returning(['id'])
      .execute();
    const insertedRows = inserted.raw as Array<{ id: string }>;
    if (!insertedRows.length) {
      const existing = await repo.findOne({
        where: [
          {
            marketplace: n.marketplace,
            externalAccountId: n.externalAccountId,
            payloadHash: hash,
          },
          ...(n.externalEventId
            ? [
                {
                  marketplace: n.marketplace,
                  externalAccountId: n.externalAccountId,
                  externalEventId: n.externalEventId,
                },
              ]
            : []),
        ],
      });
      if (!existing)
        throw new ServiceUnavailableException('Notificação não registrada.');
      await repo.increment({ id: existing.id }, 'duplicateCount', 1);
      this.log.log({
        event: 'webhook.duplicate',
        webhookEventId: existing.id,
        correlationId: existing.correlationId,
      });
      return { received: true };
    }
    this.log.log({
      event: 'webhook.received',
      webhookEventId: insertedRows[0].id,
      correlationId,
      marketplace: n.marketplace,
      eventType: n.eventType,
      result: processable ? 'received' : 'ignored',
    });
    return { received: true };
  }
  async action(
    companyId: string,
    id: string,
    userId: string,
    action: 'retry' | 'ignore',
  ) {
    return this.db.transaction(async (m) => {
      const repo = m.getRepository(MarketplaceWebhookEvent),
        e = await repo
          .createQueryBuilder('e')
          .setLock('pessimistic_write')
          .where('e.id=:id AND e.company_id=:companyId', { id, companyId })
          .getOne();
      if (!e) throw new NotFoundException('Evento não encontrado.');
      if (
        ![Status.FAILED, Status.DEAD_LETTER, Status.IGNORED].includes(e.status)
      )
        throw new ConflictException(
          'Evento não pode ser alterado neste estado.',
        );
      const previous = {
        status: e.status,
        attempts: e.attempts,
        lastErrorCode: e.lastErrorCode,
      };
      if (action === 'retry') {
        if (!e.marketplaceAccountId || e.eventType === String(Type.UNKNOWN))
          throw new ConflictException('Evento não processável.');
        const c = await m.findOneBy(SalesChannelConnection, {
          id: e.marketplaceAccountId,
          companyId,
          status: SalesChannelConnectionStatus.CONNECTED,
        });
        if (!c) throw new ConflictException('Conta não conectada.');
        e.status = Status.RECEIVED;
        e.attempts = 0;
        e.queueGeneration++;
        e.nextRetryAt = new Date();
        e.failedAt = null;
        e.processedAt = null;
        e.lastError = null;
        e.lastErrorCode = null;
      } else {
        e.status = Status.IGNORED;
        e.nextRetryAt = null;
        e.processedAt = new Date();
      }
      e.adminActions = [
        ...e.adminActions,
        { action, userId, at: new Date().toISOString(), previous },
      ].slice(-100);
      await repo.save(e);
      return { id: e.id, status: e.status };
    });
  }
}
