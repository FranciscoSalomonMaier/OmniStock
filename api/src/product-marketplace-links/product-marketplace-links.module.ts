import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { Product } from '../products/entities/product.entity';
import { MarketplaceLinkSuggestionService } from './marketplace-link-suggestion.service';
import { ProductMarketplaceLinkAudit } from './entities/product-marketplace-link-audit.entity';
import { ProductMarketplaceLink } from './entities/product-marketplace-link.entity';
import {
  MarketplaceListingsLinksController,
  ProductMarketplaceLinksByProductController,
  ProductMarketplaceLinksController,
} from './product-marketplace-links.controller';
import { ProductMarketplaceLinksService } from './product-marketplace-links.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductMarketplaceLink,
      ProductMarketplaceLinkAudit,
      MarketplaceListing,
      Product,
    ]),
    CompaniesModule,
  ],
  controllers: [
    ProductMarketplaceLinksController,
    MarketplaceListingsLinksController,
    ProductMarketplaceLinksByProductController,
  ],
  providers: [ProductMarketplaceLinksService, MarketplaceLinkSuggestionService],
  exports: [ProductMarketplaceLinksService],
})
export class ProductMarketplaceLinksModule {}
