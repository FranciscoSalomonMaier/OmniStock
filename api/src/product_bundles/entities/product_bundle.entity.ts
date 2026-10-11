import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('product_bundles')
export class ProductBundle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'bundle_product_id', type: 'uuid' }) bundleProductId: string;

  //product_bundles.bundle_product_id → products.id
  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'bundle_product_id' })
  bundleProduct: Product;

  @Column({ name: 'active', type: 'boolean', default: true }) active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
