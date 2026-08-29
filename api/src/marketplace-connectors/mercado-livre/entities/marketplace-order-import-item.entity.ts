import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('marketplace_order_import_items')
@Index(
  ['companyId', 'orderImportId', 'externalItemId', 'externalVariationId'],
  { unique: true },
)
export class MarketplaceOrderImportItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'marketplace_order_import_id', type: 'uuid' })
  orderImportId: string;
  @Column({ name: 'external_item_id', type: 'varchar', length: 80 })
  externalItemId: string;
  @Column({
    name: 'external_variation_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalVariationId: string | null;
  @Column({
    name: 'external_sku',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  externalSku: string | null;
  @Column({ type: 'varchar', length: 240 }) title: string;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ name: 'unit_price', type: 'numeric', precision: 18, scale: 2 })
  unitPrice: number;
  @Column({ name: 'total_price', type: 'numeric', precision: 18, scale: 2 })
  totalPrice: number;
  @Column({ type: 'varchar', length: 3 }) currency: string;
}
