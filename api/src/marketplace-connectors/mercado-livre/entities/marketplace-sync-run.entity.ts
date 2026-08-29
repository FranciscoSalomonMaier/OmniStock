import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
export enum SyncRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}
@Entity('marketplace_sync_runs')
@Index(['companyId', 'connectionId', 'createdAt'])
export class MarketplaceSyncRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'connection_id', type: 'uuid' }) connectionId: string;
  @Column({ type: 'varchar', length: 50 }) operation: string;
  @Column({ type: 'enum', enum: SyncRunStatus }) status: SyncRunStatus;
  @Column({ name: 'correlation_id', type: 'uuid' }) correlationId: string;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
  @Column({ name: 'processed_count', type: 'integer', default: 0 })
  processedCount: number;
  @Column({ name: 'success_count', type: 'integer', default: 0 })
  successCount: number;
  @Column({ name: 'failure_count', type: 'integer', default: 0 })
  failureCount: number;
  @Column({ type: 'text', nullable: true }) cursor: string | null;
  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode: string | null;
  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
