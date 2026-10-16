import { withProviderDeadline } from '../core/provider-request-budget';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  MarketplaceWebhookEvent,
  MarketplaceWebhookEventStatus as Status,
} from '../../orders/entities/marketplace-webhook-event.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelConnectionStatus } from '../../sales-channels/enums/sales-channel.enums';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import { MarketplaceWebhookDispatcher } from './marketplace-webhook.dispatcher';
import {
  WEBHOOK_QUEUE,
  ProcessMarketplaceWebhookJob,
} from './webhook.contracts';
@Processor(WEBHOOK_QUEUE, {
  concurrency: Number(process.env.MARKETPLACE_WEBHOOK_CONCURRENCY ?? 5),
})
export class MarketplaceWebhookWorker extends WorkerHost {
  private log = new Logger(MarketplaceWebhookWorker.name);
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private dispatcher: MarketplaceWebhookDispatcher,
  ) {
    super();
  }
  async process(job: Job<ProcessMarketplaceWebhookJob>) {
    const d = job.data,
      repo = this.db.getRepository(MarketplaceWebhookEvent);
    const e = await repo.findOneBy({
      id: d.webhookEventId,
      queueGeneration: d.generation,
      status: Status.QUEUED,
    });
    if (
      !e ||
      e.marketplace !== d.marketplace ||
      e.correlationId !== d.correlationId
    )
      return { skipped: true };
    const runner = this.db.createQueryRunner();
    await runner.connect();
    const lock = `webhook-account:${e.marketplaceAccountId}`;
    let locked = false;
    let eventLocked = false;
    try {
      const eventLockRows = (await runner.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
        [`webhook-event:${e.id}`],
      )) as Array<{ locked: boolean }>;
      eventLocked = eventLockRows[0].locked;
      if (!eventLocked) return { skipped: true };
      const rows = (await runner.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
        [lock],
      )) as { locked: boolean }[];
      locked = rows[0].locked;
      if (!locked) {
        await repo.update(
          { id: e.id, queueGeneration: d.generation, status: Status.QUEUED },
          { status: Status.RETRYING, nextRetryAt: new Date(Date.now() + 1000) },
        );
        return { deferred: true };
      }
      const cooldown = (await runner.query(
        'SELECT blocked_until FROM marketplace_webhook_account_cooldowns WHERE account_id=$1 AND blocked_until>now()',
        [e.marketplaceAccountId],
      )) as Array<{ blocked_until: Date }>;
      if (cooldown.length) {
        await repo.update(
          { id: e.id, queueGeneration: d.generation, status: Status.QUEUED },
          { status: Status.RETRYING, nextRetryAt: cooldown[0].blocked_until },
        );
        return { rateLimited: true };
      }
      const claimed = await repo.update(
        { id: e.id, queueGeneration: d.generation, status: Status.QUEUED },
        {
          status: Status.PROCESSING,
          processingStartedAt: new Date(),
          attempts: e.attempts + 1,
        },
      );
      if (!claimed.affected) return { skipped: true };
      e.attempts++;
      const start = Date.now();
      try {
        if (!this.config.get<boolean>('MARKETPLACE_WEBHOOKS_ENABLED', true))
          throw new MarketplaceConnectorError(
            'CONNECTION_DISABLED',
            'Webhooks desabilitados.',
          );
        const c = await this.db.getRepository(SalesChannelConnection).findOne({
          where: { id: e.marketplaceAccountId!, companyId: e.companyId! },
          relations: { channel: true },
        });
        if (
          !c ||
          c.status !== SalesChannelConnectionStatus.CONNECTED ||
          c.channel.code !== e.marketplace ||
          c.externalAccountId !== e.externalAccountId
        )
          throw new MarketplaceConnectorError(
            'CONNECTION_NOT_READY',
            'Conta não disponível para este evento.',
          );
        const deadline =
          start +
          this.config.get<number>(
            'MARKETPLACE_WEBHOOK_PROCESSING_TIMEOUT_MS',
            30000,
          );
        const result = await withProviderDeadline(deadline, () =>
          this.dispatcher.dispatch(e, c, deadline),
        );

        await repo.update(
          {
            id: e.id,
            queueGeneration: d.generation,
            status: Status.PROCESSING,
          },
          {
            status: Status.PROCESSED,
            eventType:
              typeof result.eventType === 'string'
                ? result.eventType
                : e.eventType,
            processedAt: new Date(),
            nextRetryAt: null,
            lastError: null,
            lastErrorCode: null,
            processingResult: result as never,
            externalOrderId: e.externalOrderId,
          },
        );
        this.log.log({
          event: 'webhook.processed',
          webhookEventId: e.id,
          correlationId: e.correlationId,
          companyId: e.companyId,
          marketplaceAccountId: e.marketplaceAccountId,
          marketplace: e.marketplace,
          eventType: e.eventType,
          jobId: job.id,
          attempt: e.attempts,
          duration: Date.now() - start,
          result: 'processed',
        });
        return result;
      } catch (error) {
        const provider =
          error instanceof MarketplaceConnectorError ? error : null;
        const retryable = provider ? provider.retryable : true;
        const max = this.config.get<number>(
          'MARKETPLACE_WEBHOOK_MAX_ATTEMPTS',
          5,
        );
        const retry = retryable && e.attempts < max;
        const delay = Math.max(
          (provider?.retryAfterSeconds ?? 0) * 1000,
          this.config.get<number>('MARKETPLACE_WEBHOOK_BACKOFF_MS', 5000) *
            2 ** Math.min(e.attempts - 1, 10) +
            Math.floor(Math.random() * 1000),
        );
        const code =
          provider?.code === 'RATE_LIMITED'
            ? 'RATE_LIMIT'
            : provider?.code === 'REAUTH_REQUIRED'
              ? 'AUTHENTICATION_ERROR'
              : provider?.code === 'RESOURCE_NOT_FOUND'
                ? 'RESOURCE_NOT_FOUND'
                : provider?.code === 'CONNECTION_NOT_READY'
                  ? 'ACCOUNT_INACTIVE'
                  : provider?.code === 'VALIDATION_ERROR'
                    ? 'VALIDATION_ERROR'
                    : retryable
                      ? 'TRANSIENT_API_ERROR'
                      : 'PERMANENT_ERROR';
        if (provider?.code === 'RATE_LIMITED')
          await runner.query(
            `INSERT INTO marketplace_webhook_account_cooldowns(account_id,blocked_until) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET blocked_until=GREATEST(marketplace_webhook_account_cooldowns.blocked_until,EXCLUDED.blocked_until)`,
            [e.marketplaceAccountId, new Date(Date.now() + delay)],
          );
        // Provider messages may contain account data; persist only the classified code and HTTP status.
        await repo.update(
          {
            id: e.id,
            queueGeneration: d.generation,
            status: Status.PROCESSING,
          },
          {
            status: retry ? Status.RETRYING : Status.DEAD_LETTER,
            nextRetryAt: retry ? new Date(Date.now() + delay) : null,
            failedAt: retry ? null : new Date(),
            lastErrorCode: code,
            lastError: `${code}${provider?.providerStatus ? ` (HTTP ${provider.providerStatus})` : ''}`,
            processingResult: { durationMs: Date.now() - start },
          },
        );
        this.log.warn({
          event: 'webhook.failed',
          webhookEventId: e.id,
          correlationId: e.correlationId,
          attempt: e.attempts,
          jobId: job.id,
          result: retry ? 'retrying' : 'dead_letter',
          code,
        });
        return { retrying: retry };
      }
    } finally {
      if (locked)
        await runner.query(
          'SELECT pg_advisory_unlock(hashtextextended($1,0))',
          [lock],
        );
      if (eventLocked)
        await runner.query(
          'SELECT pg_advisory_unlock(hashtextextended($1,0))',
          [`webhook-event:${e.id}`],
        );
      await runner.release();
    }
  }
}
@Injectable()
export class MarketplaceWebhookPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private log = new Logger(MarketplaceWebhookPublisher.name);
  constructor(
    private db: DataSource,
    private config: ConfigService,
    @InjectQueue(WEBHOOK_QUEUE) private queue: Queue,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.flush(), 2000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async flush() {
    if (
      this.running ||
      !this.config.get<boolean>('MARKETPLACE_WEBHOOKS_ENABLED', true)
    )
      return;
    this.running = true;
    try {
      const jobs = await this.db.transaction(async (m) => {
        const jobs: ProcessMarketplaceWebhookJob[] = [];
        const rows = await m
          .getRepository(MarketplaceWebhookEvent)
          .createQueryBuilder('e')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where(
            `(e.status IN ('RECEIVED','RETRYING') AND (e.next_retry_at IS NULL OR e.next_retry_at<=now())) OR (e.status IN ('QUEUED','PROCESSING') AND e.updated_at < :stale)`,
            {
              stale: new Date(
                Date.now() -
                  this.config.get<number>(
                    'MARKETPLACE_WEBHOOK_STALE_MINUTES',
                    10,
                  ) *
                    60000,
              ),
            },
          )
          .orderBy('e.received_at', 'ASC')
          .take(50)
          .getMany();
        for (const e of rows) {
          if (e.status === Status.PROCESSING) {
            const locks = await m.query<Array<{ locked: boolean }>>(
              'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked',
              [`webhook-account:${e.marketplaceAccountId}`],
            );
            if (!locks[0].locked) continue;
            e.lastErrorCode = 'STALE_PROCESSING';
            e.lastError = 'Execução interrompida; recuperação automática.';
          }
          if (
            e.attempts >=
            this.config.get<number>('MARKETPLACE_WEBHOOK_MAX_ATTEMPTS', 5)
          ) {
            e.status = Status.DEAD_LETTER;
            e.failedAt = new Date();
            e.nextRetryAt = null;
            await m.save(e);
            continue;
          }
          e.queueGeneration++;
          const data: ProcessMarketplaceWebhookJob = {
            webhookEventId: e.id,
            marketplace: e.marketplace,
            correlationId: e.correlationId,
            generation: e.queueGeneration,
          };
          jobs.push(data);
          e.status = Status.QUEUED;
          e.queuedAt = new Date();
          e.nextRetryAt = null;
          await m.save(e);
        }
        return jobs;
      });
      for (const data of jobs) {
        try {
          await this.queue.add('PROCESS_WEBHOOK', data, {
            jobId: `webhook-${data.webhookEventId}-${data.generation}`,
            attempts: 1,
            removeOnComplete: { count: 2000 },
            removeOnFail: { count: 5000 },
          });
        } catch {
          await this.db.getRepository(MarketplaceWebhookEvent).update(
            {
              id: data.webhookEventId,
              queueGeneration: data.generation,
              status: Status.QUEUED,
            },
            {
              status: Status.RETRYING,
              nextRetryAt: new Date(Date.now() + 2000),
              lastErrorCode: 'QUEUE_UNAVAILABLE',
              lastError: 'Publicação pendente; evento preservado.',
            },
          );
        }
      }
    } catch {
      this.log.warn({
        event: 'webhook.publisher.unavailable',
        result: 'durable_events_retained',
      });
    } finally {
      this.running = false;
    }
  }
}
