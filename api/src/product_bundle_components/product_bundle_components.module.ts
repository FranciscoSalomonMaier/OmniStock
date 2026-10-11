import { CompaniesModule } from '../companies/companies.module';
import { ProductBundlesModule } from '../product_bundles/product_bundles.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductBundleComponent } from './entities/product_bundle_component.entity';
import { ProductBundle } from '../product_bundles/entities/product_bundle.entity';
import { Product } from '../products/entities/product.entity';
import { ProductBundleComponentsController } from './product_bundle_components.controller';
import { ProductBundleComponentsService } from './product_bundle_components.service';

@Module({
  imports: [
    CompaniesModule,
    ProductBundlesModule,
    TypeOrmModule.forFeature([ProductBundle, ProductBundleComponent, Product]),
  ],
  controllers: [ProductBundleComponentsController],
  providers: [ProductBundleComponentsService],
})
export class ProductBundleComponentsModule {}
