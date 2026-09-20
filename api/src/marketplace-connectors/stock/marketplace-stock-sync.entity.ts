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
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { Product } from '../../products/entities/product.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';

export enum StockSyncStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  RETRYING = 'RETRYING',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  SUPERSEDED = 'SUPERSEDED',
  CANCELLED = 'CANCELLED',
}
export enum StockDivergenceStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

@Entity('marketplace_stock_syncs')
@Index(['productMarketplaceLinkId', 'inventoryVersion'], { unique: true })
@Index(['companyId', 'status', 'createdAt'])
export class MarketplaceStockSync {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'product_marketplace_link_id', type: 'uuid' })
  productMarketplaceLinkId: string;
  @Column({ name: 'marketplace_account_id', type: 'uuid' })
  marketplaceAccountId: string;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @ManyToOne(() => SalesChannelConnection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'marketplace_account_id' })
  account: SalesChannelConnection;
  @Column({ type: 'enum', enum: SalesChannelCode })
  marketplace: SalesChannelCode;
  @Column({ name: 'external_product_id', length: 80 })
  externalProductId: string;
  @Column({
    name: 'external_variation_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalVariationId: string | null;
  @Column({ name: 'inventory_event_id', type: 'uuid' })
  inventoryEventId: string;
  @Column({ name: 'inventory_version', type: 'integer' })
  inventoryVersion: number;
  @Column({ name: 'requested_quantity', type: 'integer' })
  requestedQuantity: number;
  @Column({ name: 'sent_quantity', type: 'integer', nullable: true })
  sentQuantity: number | null;
  @Column({ name: 'external_quantity', type: 'integer', nullable: true })
  externalQuantity: number | null;
  @Column({ type: 'enum', enum: StockSyncStatus }) status: StockSyncStatus;
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;
  @Column({ length: 60 }) source: string;
  @Column({ name: 'correlation_id', type: 'uuid' }) correlationId: string;
  @Column({
    name: 'external_request_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  externalRequestId: string | null;
  @Column({ name: 'requested_at', type: 'timestamptz' }) requestedAt: Date;
  @Column({ name: 'synchronized_at', type: 'timestamptz', nullable: true })
  synchronizedAt: Date | null;
  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;
  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;
  @Column({
    name: 'last_error_code',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  lastErrorCode: string | null;
  @Column({
    name: 'last_error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lastErrorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('marketplace_stock_divergences')
@Index(['companyId', 'status', 'detectedAt'])
export class MarketplaceStockDivergence {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'product_marketplace_link_id', type: 'uuid' })
  productMarketplaceLinkId: string;
  @Column({ name: 'marketplace_account_id', type: 'uuid' })
  marketplaceAccountId: string;
  @Column({ name: 'expected_quantity', type: 'integer' })
  expectedQuantity: number;
  @Column({ name: 'external_quantity', type: 'integer', nullable: true })
  externalQuantity: number | null;
  @Column({
    type: 'enum',
    enum: StockDivergenceStatus,
    default: StockDivergenceStatus.OPEN,
  })
  status: StockDivergenceStatus;
  @Column({ name: 'detected_at', type: 'timestamptz' }) detectedAt: Date;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy:
    string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) resolution:
    string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
