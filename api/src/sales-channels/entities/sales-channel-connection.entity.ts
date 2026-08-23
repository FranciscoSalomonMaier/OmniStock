import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalesChannelConnectionStatus } from '../enums/sales-channel.enums';
import { SalesChannel } from './sales-channel.entity';
@Entity('sales_channel_connections')
@Index(['companyId', 'salesChannelId'])
export class SalesChannelConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'sales_channel_id', type: 'uuid' }) salesChannelId: string;
  @Column({ name: 'display_name', length: 140 }) displayName: string;
  @Column({
    name: 'external_account_id',
    type: 'varchar',
    nullable: true,
    length: 160,
  })
  externalAccountId: string | null;
  @Column({
    name: 'external_account_name',
    type: 'varchar',
    nullable: true,
    length: 180,
  })
  externalAccountName: string | null;
  @Column({
    type: 'enum',
    enum: SalesChannelConnectionStatus,
    default: SalesChannelConnectionStatus.PENDING,
  })
  status: SalesChannelConnectionStatus;
  @Column({ name: 'connected_at', type: 'timestamptz', nullable: true })
  connectedAt: Date | null;
  @Column({ name: 'disconnected_at', type: 'timestamptz', nullable: true })
  disconnectedAt: Date | null;
  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;
  @Column({
    name: 'granted_scopes',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  grantedScopes: string[];
  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;
  @Column({
    name: 'last_successful_sync_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastSuccessfulSyncAt: Date | null;
  @Column({ name: 'last_error_at', type: 'timestamptz', nullable: true })
  lastErrorAt: Date | null;
  @Column({
    name: 'last_error_code',
    type: 'varchar',
    nullable: true,
    length: 80,
  })
  lastErrorCode: string | null;
  @Column({
    name: 'last_error_message',
    type: 'varchar',
    nullable: true,
    length: 500,
  })
  lastErrorMessage: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @Column({ name: 'created_by_user_id', type: 'uuid' }) createdByUserId: string;
  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;
  @ManyToOne(() => SalesChannel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_channel_id' })
  channel: SalesChannel;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
