import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
export enum MarketplaceWebhookEventStatus {
  RECEIVED = 'RECEIVED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  IGNORED = 'IGNORED',
  RETRYING = 'RETRYING',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}
@Entity('marketplace_webhook_events')
@Index(['marketplace', 'externalAccountId', 'externalEventId'], {
  unique: true,
  where: '"external_event_id" IS NOT NULL',
})
@Index(['marketplace', 'externalAccountId', 'payloadHash'], { unique: true })
export class MarketplaceWebhookEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid', nullable: true }) companyId:
    string | null;
  @Column({ name: 'marketplace_account_id', type: 'uuid', nullable: true })
  marketplaceAccountId: string | null;
  @Column({ type: 'enum', enum: SalesChannelCode })
  marketplace: SalesChannelCode;
  @Column({
    name: 'external_event_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  externalEventId: string | null;
  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType: string;
  @Column({ type: 'varchar', length: 500 }) resource: string;
  @Column({
    name: 'external_order_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalOrderId: string | null;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ name: 'payload_hash', type: 'varchar', length: 64 })
  payloadHash: string;
  @Column({ type: 'enum', enum: MarketplaceWebhookEventStatus })
  status: MarketplaceWebhookEventStatus;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ name: 'received_at', type: 'timestamptz' }) receivedAt: Date;
  @Column({ name: 'queued_at', type: 'timestamptz', nullable: true })
  queuedAt: Date | null;
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
  @Column({ name: 'external_account_id', type: 'varchar', length: 80 })
  externalAccountId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) topic: string | null;
  @Column({
    name: 'external_resource_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalResourceId: string | null;
  @Column({
    name: 'external_product_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalProductId: string | null;
  @Column({
    name: 'external_shipment_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalShipmentId: string | null;
  @Column({ name: 'headers_metadata', type: 'jsonb', default: {} })
  headersMetadata: Record<string, unknown>;
  @Column({ name: 'correlation_id', type: 'uuid' }) correlationId: string;
  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt: Date | null;
  @Column({
    name: 'processing_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  processingStartedAt: Date | null;
  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;
  @Column({
    name: 'last_error_code',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  lastErrorCode: string | null;
  @Column({ name: 'duplicate_count', type: 'integer', default: 0 })
  duplicateCount: number;
  @Column({ name: 'queue_generation', type: 'integer', default: 0 })
  queueGeneration: number;
  @Column({ name: 'admin_actions', type: 'jsonb', default: [] })
  adminActions: Array<Record<string, unknown>>;
  @Column({ name: 'processing_result', type: 'jsonb', nullable: true })
  processingResult: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('marketplace_order_sync_states')
@Index(['companyId', 'marketplaceAccountId'], { unique: true })
export class MarketplaceOrderSyncState {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'marketplace_account_id', type: 'uuid' })
  marketplaceAccountId: string;
  @Column({ name: 'last_successful_at', type: 'timestamptz', nullable: true })
  lastSuccessfulAt: Date | null;
  @Column({ type: 'text', nullable: true }) cursor: string | null;
  @Column({ name: 'lock_until', type: 'timestamptz', nullable: true })
  lockUntil: Date | null;
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
