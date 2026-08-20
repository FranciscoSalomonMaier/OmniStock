import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
@Entity('inventory_balances')
@Index(['companyId', 'productId'], { unique: true })
export class InventoryBalance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({
    name: 'current_quantity',
    type: 'numeric',
    precision: 18,
    scale: 3,
    default: '0',
  })
  currentQuantity: string;
  @Column({
    name: 'reserved_quantity',
    type: 'numeric',
    precision: 18,
    scale: 3,
    default: '0',
  })
  reservedQuantity: string;
  @VersionColumn() version: number;
  @OneToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
