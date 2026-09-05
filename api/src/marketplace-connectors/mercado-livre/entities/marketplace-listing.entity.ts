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
import { SalesChannelConnection } from '../../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannel } from '../../../sales-channels/entities/sales-channel.entity';
@Entity('marketplace_listings')
@Index(['companyId', 'connectionId', 'externalItemId', 'externalVariationId'], {
  unique: true,
})
export class MarketplaceListing {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'connection_id', type: 'uuid' }) connectionId: string;
  @Column({ name: 'sales_channel_id', type: 'uuid' }) salesChannelId: string;
  @Column({ name: 'external_item_id', type: 'varchar', length: 80 })
  externalItemId: string;
  @Column({
    name: 'external_variation_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalVariationId: string | null;
  @Column({ name: 'external_seller_id', type: 'varchar', length: 80 })
  externalSellerId: string;
  @Column({
    name: 'external_sku',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  externalSku: string | null;
  @Column({ type: 'varchar', length: 240 }) title: string;
  @Column({ type: 'varchar', length: 60 }) status: string;
  @Column({ type: 'numeric', precision: 18, scale: 2 }) price: number;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'available_quantity', type: 'integer', nullable: true })
  availableQuantity: number | null;
  @Column({ name: 'sold_quantity', type: 'integer', nullable: true })
  soldQuantity: number | null;
  @Column({ name: 'thumbnail_url', type: 'text', nullable: true })
  thumbnailUrl: string | null;
  @Column({ name: 'last_synced_at', type: 'timestamptz' }) lastSyncedAt: Date;
  @ManyToOne(() => SalesChannelConnection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connection_id' })
  connection: SalesChannelConnection;
  @ManyToOne(() => SalesChannel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_channel_id' })
  channel: SalesChannel;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
