import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('marketplace_order_imports')
@Index(['companyId', 'connectionId', 'externalOrderId'], { unique: true })
export class MarketplaceOrderImport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'connection_id', type: 'uuid' }) connectionId: string;
  @Column({ name: 'external_order_id', type: 'varchar', length: 80 })
  externalOrderId: string;
  @Column({ type: 'varchar', length: 60 }) status: string;
  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  paymentStatus: string | null;
  @Column({
    name: 'shipping_status',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  shippingStatus: string | null;
  @Column({
    name: 'buyer_nickname',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  buyerNickname: string | null;
  @Column({ name: 'purchased_at', type: 'timestamptz' }) purchasedAt: Date;
  @Column({ name: 'external_updated_at', type: 'timestamptz' })
  externalUpdatedAt: Date;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 2 })
  totalAmount: number;
  @Column({ name: 'shipment_id', type: 'varchar', length: 80, nullable: true })
  shipmentId: string | null;
  @Column({ name: 'last_synced_at', type: 'timestamptz' }) lastSyncedAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
