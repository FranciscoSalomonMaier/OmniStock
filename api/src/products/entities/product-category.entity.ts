import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
@Entity('product_categories')
@Index(['companyId', 'normalizedName'], { unique: true })
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ length: 120 }) name: string;
  @Column({ name: 'normalized_name', length: 120 }) normalizedName: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @OneToMany(() => Product, (p) => p.category) products: Product[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
