import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductMarketplaceLinkEvent } from '../enums/product-marketplace-link.enums';

@Entity('product_marketplace_link_audits')
@Index(['companyId', 'createdAt'])
@Index(['companyId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class ProductMarketplaceLinkAudit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'link_id', type: 'uuid', nullable: true }) linkId:
    string | null;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId:
    string | null;
  @Column({ name: 'marketplace_listing_id', type: 'uuid', nullable: true })
  marketplaceListingId: string | null;
  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null;
  @Column({ name: 'channel_code', type: 'varchar', length: 40, nullable: true })
  channelCode: string | null;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'enum', enum: ProductMarketplaceLinkEvent })
  event: ProductMarketplaceLinkEvent;
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  idempotencyKey: string | null;
  @Column({ name: 'request_hash', type: 'varchar', length: 64, nullable: true })
  requestHash: string | null;
  @Column({ type: 'jsonb', nullable: true }) details: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'jsonb', nullable: true }) response: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
