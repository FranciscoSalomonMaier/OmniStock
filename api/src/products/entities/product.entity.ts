import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ProductStatus,
  UnitOfMeasure,
  MerchandiseOrigin,
} from '../enums/product.enums';
import { ProductCategory } from './product-category.entity';
import { ProductImage } from './product-image.entity';
@Entity('products')
@Index(['companyId', 'sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'category_id', type: 'uuid', nullable: true }) categoryId:
    string | null;
  @Column({ length: 64 }) sku: string;
  @Column({ length: 180 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', nullable: true, length: 32 }) barcode:
    string | null;
  @Column({ name: 'unit_of_measure', type: 'enum', enum: UnitOfMeasure })
  unitOfMeasure: UnitOfMeasure;
  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  costPrice: string | null;
  @Column({ name: 'sale_price', type: 'decimal', precision: 15, scale: 2 })
  salePrice: string;
  @Column({ type: 'varchar', nullable: true, length: 8 }) ncm: string | null;
  @Column({ type: 'varchar', nullable: true, length: 7 }) cest: string | null;
  @Column({ name: 'default_cfop', type: 'varchar', nullable: true, length: 4 })
  defaultCfop: string | null;
  @Column({
    name: 'merchandise_origin',
    type: 'enum',
    enum: MerchandiseOrigin,
    nullable: true,
  })
  merchandiseOrigin: MerchandiseOrigin | null;
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true }) weight:
    string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) height:
    string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) width:
    string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) length:
    string | null;
  @Column({
    name: 'minimum_stock',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: '0',
  })
  minimumStock: string;
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;
  @ManyToOne(() => ProductCategory, (c) => c.products, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory | null;
  @OneToMany(() => ProductImage, (i) => i.product) images: ProductImage[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
