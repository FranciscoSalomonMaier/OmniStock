import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  RETRYING = 'RETRYING',
  FAILED = 'FAILED',
}

@Entity('outbox_events')
@Index(['status', 'availableAt'])
@Index(['companyId', 'aggregateId', 'createdAt'])
export class InventoryOutboxEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'aggregate_type', length: 60 }) aggregateType: string;
  @Column({ name: 'aggregate_id', type: 'uuid' }) aggregateId: string;
  @Column({ name: 'event_type', length: 100 }) eventType: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({
    type: 'enum',
    enum: OutboxEventStatus,
    default: OutboxEventStatus.PENDING,
  })
  status: OutboxEventStatus;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ name: 'available_at', type: 'timestamptz' }) availableAt: Date;
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
