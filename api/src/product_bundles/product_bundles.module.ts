import { CompaniesModule } from '../companies/companies.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBalance } from '../inventory/entities/inventory-balance.entity';
import { ProductBundleComponent } from '../product_bundle_components/entities/product_bundle_component.entity';
import { Product } from '../products/entities/product.entity';
import { ProductBundle } from './entities/product_bundle.entity';
import { BundlesCompositionService } from './bundles-composition/bundles-composition.service';
import { ProductBundlesController } from './product_bundles.controller';
import { ProductBundlesService } from './product_bundles.service';

@Module({
  imports: [
    CompaniesModule,
    TypeOrmModule.forFeature([
      ProductBundle,
      ProductBundleComponent,
      Product,
      InventoryBalance,
    ]),
  ],
  controllers: [ProductBundlesController],
  providers: [ProductBundlesService, BundlesCompositionService],
  exports: [BundlesCompositionService],
})
export class ProductBundlesModule {}
