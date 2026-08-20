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
import {
  InventoryReferenceType,
  InventoryReservationStatus,
} from '../enums/inventory.enums';
import { InventoryBalance } from './inventory-balance.entity';
@Entity('inventory_reservations')
@Index(['companyId', 'productId', 'referenceType', 'referenceId'], {
  unique: true,
})
export class InventoryReservation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'inventory_balance_id', type: 'uuid' })
  inventoryBalanceId: string;
  @Column({ type: 'numeric', precision: 18, scale: 3 }) quantity: string;
  @Column({
    type: 'enum',
    enum: InventoryReservationStatus,
    default: InventoryReservationStatus.ACTIVE,
  })
  status: InventoryReservationStatus;
  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
  })
  referenceType: InventoryReferenceType;
  @Column({ name: 'reference_id', length: 160 }) referenceId: string;
  @Column({ type: 'varchar', nullable: true, length: 240 }) reason:
    string | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;
  @ManyToOne(() => InventoryBalance, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_balance_id' })
  balance: InventoryBalance;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
