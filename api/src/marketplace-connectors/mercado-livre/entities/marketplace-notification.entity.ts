import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export enum NotificationStatus {
  RECEIVED = 'RECEIVED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  IGNORED = 'IGNORED',
  FAILED = 'FAILED',
}
@Entity('marketplace_notifications')
export class MarketplaceNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true })
  @Column({ name: 'payload_hash', type: 'varchar', length: 64 })
  payloadHash: string;
  @Column({
    name: 'application_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  applicationId: string | null;
  @Column({
    name: 'external_user_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalUserId: string | null;
  @Column({ type: 'varchar', length: 80 }) topic: string;
  @Column({ type: 'varchar', length: 500 }) resource: string;
  @Column({ type: 'integer', nullable: true }) attempts: number | null;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;
  @Column({ name: 'received_at', type: 'timestamptz' }) receivedAt: Date;
  @Column({ type: 'enum', enum: NotificationStatus })
  status: NotificationStatus;
  @Column({ name: 'company_id', type: 'uuid', nullable: true }) companyId:
    string | null;
  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null;
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
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
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
