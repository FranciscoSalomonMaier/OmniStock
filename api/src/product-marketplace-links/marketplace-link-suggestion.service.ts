import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeSku } from '../common/utils/normalize-sku';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product.enums';
import { ProductMarketplaceMatchedByField } from './enums/product-marketplace-link.enums';

export interface MarketplaceLinkSuggestion {
  productId: string;
  sku: string;
  name: string;
  matchedBy: ProductMarketplaceMatchedByField;
  confidence: number;
}

@Injectable()
export class MarketplaceLinkSuggestionService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async forListing(companyId: string, listing: MarketplaceListing) {
    const sku = normalizeSku(listing.externalSku);
    if (!sku) return null;
    const candidates = await this.products
      .createQueryBuilder('product')
      .where('product.companyId = :companyId', { companyId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('UPPER(BTRIM(product.sku)) = :sku', { sku })
      .take(2)
      .getMany();
    if (candidates.length !== 1) return null;
    const product = candidates[0];
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      matchedBy: ProductMarketplaceMatchedByField.SKU,
      confidence: 1,
    } satisfies MarketplaceLinkSuggestion;
  }
}
