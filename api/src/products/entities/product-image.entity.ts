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
import { Product } from './product.entity';
@Entity('product_images')
@Index(['companyId', 'productId'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'storage_key' }) storageKey: string;
  @Column({ name: 'original_name' }) originalName: string;
  @Column({ name: 'mime_type', length: 50 }) mimeType: string;
  @Column({ type: 'integer' }) size: number;
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
  @Column({ name: 'is_primary', default: false }) isPrimary: boolean;
  @ManyToOne(() => Product, (p) => p.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
