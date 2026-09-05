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
import { MarketplaceListing } from '../../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import {
  ProductMarketplaceLinkSource,
  ProductMarketplaceLinkStatus,
  ProductMarketplaceLinkValidationStatus,
  ProductMarketplaceMatchedByField,
} from '../enums/product-marketplace-link.enums';

@Entity('product_marketplace_links')
@Index(['companyId'])
@Index(['productId'])
@Index(['marketplaceListingId'])
@Index(['companyId', 'status'])
export class ProductMarketplaceLink {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'marketplace_listing_id', type: 'uuid' })
  marketplaceListingId: string;
  @Column({ type: 'enum', enum: ProductMarketplaceLinkStatus })
  status: ProductMarketplaceLinkStatus;
  @Column({
    name: 'link_source',
    type: 'enum',
    enum: ProductMarketplaceLinkSource,
  })
  linkSource: ProductMarketplaceLinkSource;
  @Column({
    name: 'match_confidence',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  matchConfidence: string | null;
  @Column({
    name: 'matched_by_field',
    type: 'enum',
    enum: ProductMarketplaceMatchedByField,
    nullable: true,
  })
  matchedByField: ProductMarketplaceMatchedByField | null;
  @Column({ name: 'linked_by_user_id', type: 'uuid' }) linkedByUserId: string;
  @Column({ name: 'unlinked_by_user_id', type: 'uuid', nullable: true })
  unlinkedByUserId: string | null;
  @Column({ name: 'linked_at', type: 'timestamptz' }) linkedAt: Date;
  @Column({ name: 'unlinked_at', type: 'timestamptz', nullable: true })
  unlinkedAt: Date | null;
  @Column({
    name: 'unlink_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  unlinkReason: string | null;
  @Column({ name: 'last_validated_at', type: 'timestamptz', nullable: true })
  lastValidatedAt: Date | null;
  @Column({
    name: 'last_validation_status',
    type: 'enum',
    enum: ProductMarketplaceLinkValidationStatus,
    nullable: true,
  })
  lastValidationStatus: ProductMarketplaceLinkValidationStatus | null;
  @Column({
    name: 'last_validation_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lastValidationMessage: string | null;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @ManyToOne(() => MarketplaceListing, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'marketplace_listing_id' })
  listing: MarketplaceListing;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'linked_by_user_id' })
  linkedBy: User;
  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unlinked_by_user_id' })
  unlinkedBy: User | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
