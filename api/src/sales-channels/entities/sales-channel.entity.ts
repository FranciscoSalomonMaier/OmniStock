import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  SalesChannelCode,
  SalesChannelType,
} from '../enums/sales-channel.enums';
@Entity('sales_channels')
export class SalesChannel {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'enum', enum: SalesChannelCode, unique: true })
  code: SalesChannelCode;
  @Column({ length: 100 }) name: string;
  @Column({ type: 'enum', enum: SalesChannelType }) type: SalesChannelType;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'icon_key', type: 'varchar', nullable: true, length: 60 })
  iconKey: string | null;
  @Column({ name: 'supports_oauth', default: false }) supportsOAuth: boolean;
  @Column({ name: 'supports_products', default: false })
  supportsProducts: boolean;
  @Column({ name: 'supports_orders', default: false }) supportsOrders: boolean;
  @Column({ name: 'supports_stock', default: false }) supportsStock: boolean;
  @Column({ name: 'supports_prices', default: false }) supportsPrices: boolean;
  @Column({ name: 'supports_invoices', default: false })
  supportsInvoices: boolean;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'configuration_schema', type: 'jsonb', nullable: true })
  configurationSchema: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
