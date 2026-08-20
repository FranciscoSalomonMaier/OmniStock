import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import {
  InventoryMovementType,
  InventoryReferenceType,
} from '../enums/inventory.enums';
import { InventoryBalance } from './inventory-balance.entity';
@Entity('inventory_movements')
@Index(['companyId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'inventory_balance_id', type: 'uuid' })
  inventoryBalanceId: string;
  @Column({ type: 'enum', enum: InventoryMovementType })
  type: InventoryMovementType;
  @Column({ type: 'numeric', precision: 18, scale: 3 }) quantity: string;
  @Column({
    name: 'current_quantity_before',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  currentQuantityBefore: string;
  @Column({
    name: 'current_quantity_after',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  currentQuantityAfter: string;
  @Column({
    name: 'reserved_quantity_before',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  reservedQuantityBefore: string;
  @Column({
    name: 'reserved_quantity_after',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  reservedQuantityAfter: string;
  @Column({
    name: 'available_quantity_before',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  availableQuantityBefore: string;
  @Column({
    name: 'available_quantity_after',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  availableQuantityAfter: string;
  @Column({ length: 240 }) reason: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
    nullable: true,
  })
  referenceType: InventoryReferenceType | null;
  @Column({
    name: 'reference_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  referenceId: string | null;
  @Column({ name: 'idempotency_key', type: 'uuid', nullable: true })
  idempotencyKey: string | null;
  @Column({ name: 'request_hash', type: 'varchar', length: 64, nullable: true })
  requestHash: string | null;
  @Column({ name: 'performed_by_user_id', type: 'uuid', nullable: true })
  performedByUserId: string | null;
  @Column({
    name: 'reversal_of_movement_id',
    type: 'uuid',
    nullable: true,
    unique: true,
  })
  reversalOfMovementId: string | null;
  @Column({
    name: 'occurred_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  occurredAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @ManyToOne(() => InventoryBalance, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_balance_id' })
  balance: InventoryBalance;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performed_by_user_id' })
  performedBy: User | null;
}
