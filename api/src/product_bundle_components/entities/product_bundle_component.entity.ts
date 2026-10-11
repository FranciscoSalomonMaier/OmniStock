import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ProductBundle } from '../../product_bundles/entities/product_bundle.entity';
import { Product } from '../../products/entities/product.entity';

@Unique(['bundleId', 'componentProductId'])
@Entity('product_bundle_components')
@Check('"quantity" > 0')
export class ProductBundleComponent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;

  @Column({ name: 'bundle_id', type: 'uuid' }) bundleId: string;
  @ManyToOne(() => ProductBundle, { nullable: false })
  @JoinColumn({ name: 'bundle_id' })
  bundle: ProductBundle;

  @Column({ name: 'component_product_id', type: 'uuid' })
  componentProductId: string;
  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'component_product_id' })
  componentProduct: Product;

  @Column({ name: 'active', type: 'boolean', default: true }) active: boolean;

  @Column({ name: 'quantity', type: 'integer' }) quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
